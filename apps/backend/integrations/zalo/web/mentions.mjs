// Native mention policy/catalog, isolated from the client's current composer.
export async function readMentions(page, expectedId, body) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_ACCOUNT_OFFLINE");
  try {
    return await frame.evaluate(
      async ({ expectedId, conversationId }) => {
        let req;
        const key = "zt-mentions-" + crypto.randomUUID();
        const chunk = [
          [key],
          {
            [key]: (m, e, r) => {
              req = r;
            },
          },
          [[key]],
        ];
        globalThis.webpackJsonp.push(chunk);
        delete req.c[key];
        delete req.m[key];
        globalThis.webpackJsonp.splice(
          globalThis.webpackJsonp.indexOf(chunk),
          1,
        );
        const get = (k) => req.c[k]?.exports;
        if (String(get("dThN")?.default?.userId) !== expectedId)
          throw Error("WEB_IDENTITY_MISMATCH");
        const visible = get("jDHv")
          ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
          ?.getList({ key: get("3xbP")?.c });
        if (!visible?.includes(conversationId))
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        if (!conversationId.startsWith("g")) return { members: [] };
        const Helper = get("TsEa")?.e,
          groups = get("Gm1y")?.default;
        if (!Helper || !groups?.getFullInfoGroupById)
          throw Error("WEB_MENTION_ADAPTER_CHANGED");
        let timer;
        let info;
        try {
          info = await Promise.race([
            groups.getFullInfoGroupById(conversationId),
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(Error("WEB_MENTION_TIMEOUT")),
                15000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        const helper = new Helper(conversationId);
        helper.initState(expectedId);
        const members = helper.getListSuggestMention("@", 1, {
          groupId: conversationId,
          creatorId: info.creatorId,
          topMember: info.topMember,
        });
        return {
          members: members
            .filter((m) => !m.isCmd)
            .map((m) => ({
              id: String(m.id),
              name: m.isMentionAll ? "All" : String(m.dName || ""),
              all: !!m.isMentionAll,
              avatarSrc:
                typeof m.avatar === "string" && /^https:\/\//.test(m.avatar)
                  ? m.avatar
                  : undefined,
            })),
        };
      },
      { expectedId, conversationId: body.conversationId },
    );
  } catch (e) {
    throw Error(
      String(e?.message || "").match(/\bWEB_[A-Z_]+\b/)?.[0] ||
        "WEB_MENTION_ADAPTER_CHANGED",
    );
  }
}

export function validMentions(mentions, text) {
  if (
    typeof text !== "string" ||
    !Array.isArray(mentions) ||
    mentions.length > 100
  )
    return false;
  let end = 0;
  const ids = new Set();
  return mentions.every((m) => {
    if (
      !m ||
      typeof m !== "object" ||
      Object.keys(m).sort().join() !== "len,pos,type,uid" ||
      !Number.isSafeInteger(m.pos) ||
      !Number.isSafeInteger(m.len) ||
      m.pos < end ||
      m.len < 2 ||
      m.pos + m.len > text.length ||
      text[m.pos] !== "@" ||
      /[\r\n]/.test(text.slice(m.pos, m.pos + m.len)) ||
      typeof m.uid !== "string" ||
      !(m.type === 0
        ? /^\d{1,30}$/.test(m.uid)
        : m.type === 1 && m.uid === "-1") ||
      ids.has(m.uid)
    )
      return false;
    end = m.pos + m.len;
    ids.add(m.uid);
    return true;
  });
}

// Native names are viewer-specific. Rebase ranges together with names, including
// RTF endpoints, instead of applying wire offsets to getPlainText's renamed text.
export function displayMentions(text, mentions, names = {}, styles = []) {
  if (!validMentions(mentions, text))
    return { text, mentions: undefined, styles };
  let result = "",
    last = 0;
  const replacements = [],
    tags = [];
  for (const tag of mentions) {
    const name = names[tag.uid] || (tag.type === 1 ? "All" : "");
    const replacement = name
      ? "@" + name
      : text.slice(tag.pos, tag.pos + tag.len);
    result += text.slice(last, tag.pos);
    tags.push({ ...tag, pos: result.length, len: replacement.length });
    replacements.push({
      start: tag.pos,
      end: tag.pos + tag.len,
      length: replacement.length,
    });
    result += replacement;
    last = tag.pos + tag.len;
  }
  result += text.slice(last);
  const map = (offset, end) => {
    let delta = 0;
    for (const r of replacements) {
      if (offset <= r.start) break;
      if (offset < r.end) return r.start + delta + (end ? r.length : 0);
      delta += r.length - (r.end - r.start);
    }
    return offset + delta;
  };
  return {
    text: result,
    mentions: tags,
    styles: styles
      .map((s) => ({
        ...s,
        start: map(s.start, false),
        len: map(s.start + s.len, true) - map(s.start, false),
      }))
      .filter((s) => s.len > 0),
  };
}
