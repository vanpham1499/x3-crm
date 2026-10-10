export function validMessageSearch(v) {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).every((k) =>
      ["query", "sender", "days", "before"].includes(k),
    ) &&
    typeof v.query === "string" &&
    (v.query.trim().length > 0 || v.sender !== 'all' || v.days !== 0) &&
    v.query.length <= 100 &&
    typeof v.sender === "string" &&
    /^(all|me|others|[0-9]{1,30})$/.test(v.sender) &&
    [0, 7, 30, 90].includes(v.days) &&
    (v.before === undefined ||
      (v.before &&
        Object.keys(v.before).sort().join(",") === "id,time" &&
        typeof v.before.id === "string" &&
        /^[\w-]{1,80}$/.test(v.before.id) &&
        typeof v.before.time === "string" &&
        /^\d{1,16}$/.test(v.before.time)))
  );
}
export async function searchInPage({ expectedId, conversationId, search }) {
  let require;
  const id = "zalo-team-search-" + Date.now();
  const chunk = [
    [id],
    {
      [id]: (m, e, r) => {
        require = r;
      },
    },
    [[id]],
  ];
  if (!Array.isArray(globalThis.webpackJsonp))
    throw Error("WEB_SEARCH_NOT_READY");
  globalThis.webpackJsonp.push(chunk);
  if (!require) throw Error("WEB_SEARCH_NOT_READY");
  delete require.c[id];
  delete require.m[id];
  globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
  const get = (k) => require.c[k]?.exports;
  if (String(get("dThN")?.default?.userId || "") !== expectedId)
    throw Error("WEB_IDENTITY_MISMATCH");
  const visible = get("jDHv")
    ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
    ?.getList({ key: get("3xbP")?.c });
  if (
    !Array.isArray(visible) ||
    (!visible.includes(conversationId) &&
      !globalThis.__zaloTeamPhonePeers?.allows(expectedId, conversationId))
  )
    throw Error("WEB_CONVERSATION_NOT_FOUND");
  const db = get("XS0u")?.default,
    formatter = get("P6UB")?.default,
    users = get("UiPd")?.default,
    kinds = get("1pet"),
    deletion = get("mlG1")?.d;
  if (
    !db?.getMessageFromConversationByLimit ||
    !formatter?.getPlainText ||
    !deletion?.isDeleteMessage ||
    !deletion?.isDeletingInConversation
  )
    throw Error("WEB_SEARCH_ADAPTER_CHANGED");
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  const query = norm(search.query.trim()),
    since = search.days ? Date.now() - search.days * 86400000 : 0,
    deadline = Date.now() + 20000;
  const text = (m) => {
    let plain = "";
    try {
      plain = formatter.getPlainText(m) || "";
    } catch {}
    return (
      plain ||
      (typeof m.message === "string"
        ? m.message
        : m.message?.title || m.message?.fileName || m.message?.name || "")
    );
  };
  const author = (m) =>
    String(m.fromUid === "0" || m.fromUid === 0 ? expectedId : m.fromUid || "");
  const predicate = (m) =>
    m &&
    !deletion.isDeletingInConversation(m) &&
    !deletion.isDeleteMessage(conversationId, m) &&
    m.msgType !== kinds?.MSG_UNDO &&
    Number(m.sendDttm) >= since &&
    (search.sender === "all" ||
      (search.sender === "me"
        ? author(m) === expectedId
        : search.sender === "others"
          ? author(m) !== expectedId
          : author(m) === search.sender)) &&
    norm(text(m)).includes(query);
  let timer;
  try {
    const rows = await Promise.race([
      db.getMessageFromConversationByLimit(conversationId, 51, {
        fromMsg: search.before
          ? { msgId: search.before.id, sendDttm: search.before.time }
          : undefined,
        include: false,
        fPredicate: predicate,
        fIsAbort: () => Date.now() > deadline,
        validKey: id,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error("WEB_SEARCH_TIMEOUT")), 20000);
      }),
    ]);
    if (Date.now() > deadline) throw Error("WEB_SEARCH_TIMEOUT");
    if (!Array.isArray(rows)) throw Error("WEB_SEARCH_ADAPTER_CHANGED");
    const ordered = rows
      .filter(predicate)
      .sort(
        (a, b) =>
          Number(b.sendDttm) - Number(a.sendDttm) ||
          String(b.msgId).localeCompare(String(a.msgId)),
      );
    const items = ordered
      .slice(0, 50)
      .map((m) => ({
        id: String(m.msgId),
        time: Number(m.sendDttm),
        text: String(text(m)).slice(0, 4000),
        sender: {
          id: author(m),
          name:
            author(m) === expectedId
              ? "Bạn"
              : users?.getDName?.(author(m)) || "Thành viên",
        },
        kind: m.msgType === kinds?.MSG_FILE ? "file" : "text",
      }));
    const last = items.at(-1);
    return {
      items,
      cursor:
        ordered.length > 50 && last
          ? { id: last.id, time: String(last.time) }
          : null,
      scope: "web-history",
    };
  } finally {
    clearTimeout(timer);
  }
}
export async function searchMessages(page, expectedId, body) {
  if (!validMessageSearch(body.search)) throw Error("INVALID_SEARCH");
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_SEARCH_NOT_READY");
  return frame.evaluate(searchInPage, {
    expectedId,
    conversationId: body.conversationId,
    search: body.search,
  });
}
