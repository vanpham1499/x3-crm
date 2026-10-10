import { validMentions, displayMentions } from "./mentions.mjs";
import { validRichStyles } from "./guards.mjs";
import { normalizeCallMessage } from "./call-message.mjs";
// Use the Web client's own loader/DB, scoped to its bound account. Never
// select a native conversation, send seen receipts, or expose browser state.
import { channel } from "./transport.mjs";
import { normalizeInline } from "./inline.mjs";
export async function readMessages(
  page,
  expectedId,
  conversationId,
  before,
  emit,
  refresh = false,
) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_MESSAGES_NOT_READY");
  const wire = await channel(page, (data) =>
    emit?.({ ...data, messages: data.messages.map(normalizeMessage) }),
  );
  try {
    const result = await frame.evaluate(
      async ({ expectedId, conversationId, before, wireId, refresh }) => {
        let require;
        const id = "zalo-team-detail-" + Date.now();
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
          throw Error("WEB_MESSAGES_NOT_READY");
        globalThis.webpackJsonp.push(chunk);
        if (!require) throw Error("WEB_MESSAGES_NOT_READY");
        delete require.c[id];
        delete require.m[id];
        globalThis.webpackJsonp.splice(
          globalThis.webpackJsonp.indexOf(chunk),
          1,
        );
        const get = (key) => require.c[key]?.exports;
        if (String(get("dThN")?.default?.userId || "") !== expectedId)
          throw Error("WEB_IDENTITY_MISMATCH");
        const container = get("jDHv")?.ModuleContainer;
        const listType = get("iZzu")?.ConvListController;
        const visible =
          listType &&
          container?.resolve(listType)?.getList({ key: get("3xbP")?.c });
        if ((!Array.isArray(visible) || !visible.includes(conversationId)) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        const parser = get("Y/Cm")?.a;
        const kinds = get("1pet");
        const users = get("UiPd")?.default;
        if (!parser?.doParse || !kinds)
          throw Error("WEB_MESSAGES_ADAPTER_CHANGED");
        const bounded = async (promise, timeout = 5000) => {
          let timer;
          try {
            return await Promise.race([
              promise,
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(Error("WEB_MESSAGES_TIMEOUT")),
                  timeout,
                );
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        };
        const NativeLoader = get("ZCU6")?.d;
        if (!NativeLoader) throw Error("WEB_MESSAGES_ADAPTER_CHANGED");
        const pinsPromise = before
          ? Promise.resolve(null)
          : bounded(
              (async () => {
                const topics = conversationId.startsWith("g")
                  ? get("jnJr")
                      ?.a?.getInstance(conversationId)
                      ?.topicStore?.getTopics(conversationId)
                  : (
                      await get("YYsv")
                        ?.j?.GetManager()
                        ?.loadPinTopics(conversationId)
                    )?.topics;
                if (!Array.isArray(topics)) return null;
                return topics
                  .flatMap((topic) => {
                    if (
                      topic.type === kinds.POLL_TOPIC &&
                      /^\d+$/.test(String(topic.id))
                    ) {
                      let p = topic.params;
                      try {
                        if (typeof p === "string") p = JSON.parse(p);
                      } catch {
                        p = {};
                      }
                      return [
                        {
                          id: `poll:${topic.id}`,
                          text: String(
                            p?.question ||
                              p?.title ||
                              topic.title ||
                              "[Bình chọn]",
                          ).slice(0, 200),
                          sender: "",
                          poll: true,
                        },
                      ];
                    }
                    let params = topic.params;
                    if (typeof params === "string") {
                      try {
                        params = JSON.parse(params);
                      } catch {
                        return [];
                      }
                    }
                    if (
                      topic.type !== kinds.MSG_TOPIC &&
                      params?.title &&
                      /^\d+$/.test(String(topic.id))
                    )
                      return [
                        {
                          id: "topic:" + topic.id,
                          text: String(params.title).slice(0, 500),
                          sender: "",
                          topic: true,
                        },
                      ];
                    const id = String(params?.global_msg_id || "");
                    return /^\d+$/.test(id)
                      ? [
                          {
                            id,
                            text: String(
                              params.title || "[Tin nhắn ghim]",
                            ).slice(0, 500),
                            sender: String(params.senderName || ""),
                          },
                        ]
                      : [];
                  })
                  .slice(0, 100);
              })(),
              5000,
            ).catch(() => null);
        // Use a native loader instance with an output sink, without selecting a
        // native chat or changing its shared Redux/seen state. Its DB/cache/cloud
        // methods remain vendor implementations, including top-page verification.
        const native = new NativeLoader(conversationId);
        let view = before ? [{ msgId: before.id, sendDttm: before.time }] : [];
        native.getState = () => ({ messages: view, msgList: {} });
        const items = new Map();
        let hasMore = true,
          warning = null,
          output = Promise.resolve(),
          latest;
        let finished = false;
        native.dispatch = (action) => {
          const payload = action?.payload;
          if (
            finished ||
            payload?.conversationId !== conversationId ||
            !Array.isArray(payload.messages)
          )
            return;
          if ("hasMoreLocal" in payload || "hasMoreCloud" in payload)
            hasMore = Boolean(payload.hasMoreLocal || payload.hasMoreCloud);
          for (const m of payload.messages)
            if (m?.msgId) items.set(String(m.msgId), m);
          view = [...items.values()].sort(
            (a, b) => Number(a.sendDttm) - Number(b.sendDttm),
          );
          const rows = [...view];
          const more = hasMore;
          output = output.then(async () => {
            latest = await project(rows, more, null);
            await globalThis.__zaloTeamPacket(wireId, {
              ...latest,
              partial: true,
            });
          });
        };
        try {
          if (refresh) {
            const constants = kinds.MessageConstants;
            const cached = await bounded(
              native.loadLastMessageLocalFrom(
                constants.MAX_MSG_ID,
                constants.MAX_SENDDTTM,
                50,
                true,
                true,
              ),
              18000,
            );
            native.dispatch({
              payload: {
                conversationId,
                messages: await bounded(
                  parser.doParse(cached.messages || [], conversationId),
                ),
                hasMoreLocal: cached.hasMore,
                hasMoreCloud: false,
              },
            });
          } else if (before)
            await bounded(native.loadTopMessagesForConversation(), 35000);
          else await bounded(native.getLastMessagesForConversation(), 35000);
        } catch {
          warning = "WEB_HISTORY_LOAD_INCOMPLETE";
        }
        finished = true;
        await output;
        return {
          ...(latest || (await project([], false, warning))),
          pins: await pinsPromise,
          warning,
        };

        async function project(rows, hasMore, warning) {
          const cursor = rows[0]
            ? { id: String(rows[0].msgId), time: String(rows[0].sendDttm) }
            : null;
          // Native initial/top dispatches are already parsed by ZCU6.
          const parsed = rows;
          const typeNames = [
            "MSG_TEXT",
            "MSG_POLL",
            "MSG_ECARD",
            "MSG_PHOTO",
            "MSG_PHOTO_2",
            "MSG_PHOTO_GROUP",
            "MSG_STICKER",
            "MSG_STICKER_2",
            "MSG_STICKER_GROUP",
            "MSG_VIDEO",
            "MSG_GIF",
            "MSG_VOICE",
            "MSG_FILE",
            "MSG_CONTACT",
            "MSG_LINK_CLIENT",
            "MSG_ARTICLE",
            "MSG_UNDO",
            "MSG_DEL_EVERYONE",
            "MSG_INFO",
            "MSG_INFO_CHAT",
            "MSG_GROUP_NOTI",
            "MSG_LOCATION",
            // MSG_TOPIC is a pinned-topic subtype (2), not a message kind.
            // Including it here overwrites MSG_PHOTO (also 2) in the map.
            "MSG_TODO",
            "MSG_OA",
            "MSG_E2EE_DECRYPT_FAILED",
            "MSG_E2EE_PENDING_DATA",
            "MSG_SYNCING",
            "MSG_SYNCING_OUT_OF_RANGE",
          ];
          const labels = new Map(
            typeNames
              .filter((key) => typeof kinds[key] === "number")
              .map((key) => [kinds[key], key]),
          );
          const safeAvatar = (uid) => users?.getAvatar?.(uid);
          const authorId = (m) =>
            String(m.fromUid) === "0" ? expectedId : String(m.fromUid);
          const reactionMap =
            (await get("ofhN")
              ?.b?.getMessageReactions(
                (parsed || rows).map((m) => String(m.msgId)),
              )
              .catch(() => ({}))) || {};
          const reactionIds = [
            ...new Set(
              Object.values(reactionMap).flatMap((r) =>
                Object.keys(r?.reactions || {}),
              ),
            ),
          ];
          const missingAuthors = [
            ...new Set([
              ...(parsed || rows).map(authorId),
              ...reactionIds.map((id) => (id === "0" ? expectedId : id)),
            ]),
          ].filter((uid) => /^\d+$/.test(uid) && !users?.getDName?.(uid));
          let profiles = {};
          if (missingAuthors.length && users?.getProfileFriendByIds) {
            try {
              profiles =
                (await bounded(users.getProfileFriendByIds(missingAuthors))) ||
                {};
            } catch {}
          }
          const projected = await Promise.all(
            (parsed || rows).map(async (m) => {
              let plainText = "",
                sticker,
                stickerAnimation;
              try {
                plainText = get("P6UB")?.default?.getPlainText(m) || "";
              } catch {}
              // Native text tokens + sprite coordinates, never vendor HTML/React trees.
              let inline = [];
              if (m.msgType === kinds.MSG_TEXT && plainText) {
                try {
                  const formatter = get("P6UB");
                  const config = get("NDmK")?.default;
                  const tokens = formatter.default.parseMessage({
                    message: plainText,
                    shouldParseKeyword: false,
                    parseLink: false,
                  });
                  const sprite = new URL(
                    get("z0WU").default.getEmojiSrc("larger"),
                    frameOrigin(),
                  ).href;
                  inline = tokens.map((t) => {
                    const value =
                      typeof t === "string"
                        ? t
                        : String(t.text || t.value || "");
                    const key = String(t.value || value).toLowerCase();
                    const isEmoji = [
                      formatter.TokenTypes.EMOJI_TOKEN,
                      formatter.TokenTypes.EMOJI_TOKEN_V2,
                    ].includes(t.type);
                    const position = config?.emojiMapPos?.[key];
                    return isEmoji && position
                      ? { text: value, sprite, position }
                      : { text: value };
                  });
                  if (inline.map((t) => t.text).join("") !== plainText)
                    inline = [];
                } catch {
                  inline = [];
                }
              }
              if (
                [kinds.MSG_STICKER, kinds.MSG_STICKER_2].includes(m.msgType) &&
                m.message?.catId != null &&
                m.message?.id != null
              ) {
                try {
                  const item = await bounded(
                    get("vSga")?.default?.getStickerIfNotExist(
                      m.message.catId,
                      m.message.id,
                    ),
                  );
                  const helper = get("Ullg")?.a?.Helper;
                  sticker =
                    helper?.getStickerThumbUrl(item, {
                      onlyUseLocal: false,
                      usingFileProtocol: false,
                    }) || item?.stickerUrl;
                  if (item)
                    stickerAnimation = {
                      url:
                        item.stickerSpriteUrl &&
                        (item.ext === 2 || item.totalFrames > 1)
                          ? item.stickerSpriteUrl
                          : item.stickerGifUrl,
                      sheet:
                        item.ext !== 2 &&
                        !!item.stickerSpriteUrl &&
                        item.totalFrames > 1,
                      frames: item.totalFrames,
                      frameMs: item.duration,
                    };
                } catch {}
              }
              let poll;
              if (m.msgType === kinds.MSG_POLL) {
                try {
                  const params =
                    typeof m.message?.params === "string"
                      ? JSON.parse(m.message.params)
                      : m.message?.params;
                  if (params?.pollId) {
                    const token =
                      get("C8zZ")?.GroupPollManager || get("lT2C")?.a;
                    const manager = token && container?.resolve(token);
                    poll =
                      manager?.getPollDetailSync(params.pollId) ||
                      (await bounded(
                        get("dThN").default.fetchPollIfNotExist(
                          conversationId.slice(1),
                          params.pollId,
                        ),
                      ));
                  }
                } catch {
                  /* Keep the native event readable if poll detail is unavailable. */
                }
              }
              let topic = m.eventInfo?.updateInfo?.rawData;
              let topicAction = m.act;
              try {
                let topicId;
                if (
                  m.msgType === kinds.MSG_INFO_CHAT &&
                  m.message?.action === "msginfo.actionlist"
                ) {
                  const data =
                    typeof m.message.params === "string"
                      ? JSON.parse(m.message.params)
                      : m.message.params;
                  const action = data?.actions?.find(
                    (a) => a.actionType === "action.open.grouptopic.detail",
                  );
                  const target =
                    typeof action?.actionData === "string"
                      ? JSON.parse(action.actionData)
                      : action?.actionData;
                  if (target?.topicId && target.topicType !== kinds.POLL_TOPIC)
                    topicId = String(target.topicId);
                }
                if (m.msgType === kinds.MSG_ECARD) {
                  const params =
                    typeof m.message?.params === "string"
                      ? JSON.parse(m.message.params)
                      : m.message?.params;
                  const action = params?.actions?.find(
                    (a) => a.actionId === "action.open.reminder",
                  );
                  const data =
                    typeof action?.data === "string"
                      ? JSON.parse(action.data)
                      : action?.data;
                  const detail =
                    typeof data?.data === "string"
                      ? JSON.parse(data.data)
                      : data?.data;
                  if (detail?.topicId) topicId = String(detail.topicId);
                }
                if (topicId) {
                  const local = await bounded(
                    get("XS0u")?.default?.getGroupTopicV2(
                      conversationId.replace(/^g/, ""),
                      topicId,
                    ),
                  );
                  topic =
                    local ||
                    (await bounded(
                      get("dThN").default.getDetailReminder(topicId),
                    ));
                  if (
                    topic?.groupId &&
                    String(topic.groupId) !== conversationId.replace(/^g/, "")
                  )
                    topic = undefined;
                  topicAction = "update_board";
                }
              } catch {
                /* Keep native event text when the topic was removed or is unavailable. */
              }
              return {
                poll,
                topic,
                topicAction,
                id: String(m.msgId || m.cliMsgId || ""),
                clientId: String(m.cliMsgId || ""),
                time: Number(m.sendDttm || 0),
                type: labels.get(m.msgType) || String(m.msgType),
                mine:
                  String(m.fromUid) === "0" || String(m.fromUid) === expectedId,
                sender: {
                  id: authorId(m),
                  name:
                    users?.getDName?.(
                      String(m.fromUid) === "0"
                        ? expectedId
                        : String(m.fromUid),
                    ) ||
                    m.dName ||
                    m.fromD ||
                    profiles[authorId(m)]?.displayName ||
                    profiles[authorId(m)]?.zaloName ||
                    "",
                  avatarSrc:
                    safeAvatar(
                      String(m.fromUid) === "0"
                        ? expectedId
                        : String(m.fromUid),
                    ) || profiles[authorId(m)]?.avatar,
                },
                // The native renderer converts non-encrypted JXL URLs to their
                // JPEG variant. Ordinary browser img tags cannot display JXL.
                message:
                  m.message &&
                  typeof m.message === "object" &&
                  !Array.isArray(m.message)
                    ? get("Q8nW")?.o?.(m.message) || m.message
                    : m.message,
                starred: !!m.staredDttm,
                canRecall:
                  ["0", expectedId].includes(String(m.fromUid)) &&
                  (get("bUXd")?.default?.getTimeNow?.() || Date.now()) -
                    Number(m.sendDttm) <
                    (get("NDmK")?.default?.recallMessageMaxTime || 0),
                reactions: reactionMap[String(m.msgId)]?.reactions || {},
                currentReaction: reactionMap[String(m.msgId)]?.currentIcon,
                lastReaction: reactionMap[String(m.msgId)]?.lastReactIcon,
                lastReactionMine: ["0", expectedId].includes(String(reactionMap[String(m.msgId)]?.lastSender)),
                reactionUsers: Object.fromEntries(
                  Object.keys(
                    reactionMap[String(m.msgId)]?.reactions || {},
                  ).map((id) => {
                    const uid = id === "0" ? expectedId : id;
                    return [
                      id,
                      {
                        id: uid,
                        name:
                          uid === expectedId
                            ? "Bạn"
                            : users?.getDName?.(uid) ||
                              profiles[uid]?.displayName ||
                              profiles[uid]?.zaloName ||
                              "",
                        mine: uid === expectedId,
                      },
                    ];
                  }),
                ),
                quote: m.quote,
                mentions: m.mentions,
                mentionNames: Object.fromEntries(
                  (Array.isArray(m.mentions) ? m.mentions : []).map((tag) => [
                    String(tag.uid),
                    users?.getDName?.(tag.uid) || "",
                  ]),
                ),
                plainText,
                inline,
                sticker,
                stickerAnimation,
              };
            }),
          );
          return {
            messages: projected,
            cursor: hasMore ? cursor : null,
            hasMore,
            warning,
          };
        }
        function frameOrigin() {
          return "https://chat.zalo.me/";
        }
      },
      {
        expectedId,
        conversationId,
        before,
        wireId: wire.id,
        refresh,
      },
    );
    return { ...result, messages: result.messages.map(normalizeMessage) };
  } finally {
    wire.close();
  }
}

const text = (value) =>
  typeof value === "string" ? value.slice(0, 50000) : "";
const url = (value) =>
  typeof value === "string" && /^https:\/\//.test(value) ? value : undefined;
const object = (value) => {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
export function normalizeMessage(raw) {
  const body = object(raw.message);
  const photoParams = object(body.params);
  const type = raw.type || "unknown";
  let kind = "text",
    content = text(raw.message),
    attachments = [];
  const media = (kind, data = body) => ({
    kind,
    name: text(data.title || data.name),
    url: url(
      data.oriUrl ||
        data.normalUrl ||
        data.href ||
        data.url ||
        data.originalUrl,
    ),
    preview: url(data.thumbUrl || data.thumb || data.thumbnail),
    size: Number(
      data.size || data.fileSize || object(data.params).fileSize || 0,
    ),
    description: text(data.description),
    width: Math.max(0, Number(data.width || object(data.params).width) || 0),
    height: Math.max(0, Number(data.height || object(data.params).height) || 0),
    hd:
      kind === "image" &&
      !!(
        object(data.params).hd ||
        object(data.params).hdUrl ||
        object(data.params).rawUrl
      ),
  });
  if (/POLL/.test(type) && raw.poll?.poll_id) {
    kind = "poll";
    const action =
      {
        create: "tạo cuộc bình chọn mới",
        vote: "tham gia cuộc bình chọn",
        update: "cập nhật cuộc bình chọn",
        close: "kết thúc cuộc bình chọn",
        share: "chia sẻ cuộc bình chọn",
      }[body.action] || "cập nhật cuộc bình chọn";
    content = `${raw.mine ? "Bạn" : text(raw.sender?.name) || "Thành viên"} ${action}: ${text(raw.poll.question)}`;
  } else if (/UNDO|DEL_EVERYONE/.test(type)) {
    kind = "recalled";
    content = "Tin nhắn đã được thu hồi";
  } else if (type === 'MSG_INFO' || /TOPIC|GROUP_NOTI|INFO_CHAT/.test(type)) {
    kind = "system";
    content = raw.plainText || text(body.title || body.text) || content;
  } else if (/E2EE|SYNCING/.test(type)) {
    kind = "system";
    content = "Tin nhắn chưa được đồng bộ trong phiên Zalo Web này";
  } else if (/PHOTO|GIF/.test(type)) {
    kind = "media";
    content = text(body.title);
    attachments = Array.isArray(body)
      ? body.map((item) => media("image", object(item.message || item)))
      : [media("image")];
    if (/GIF/.test(type))
      attachments = attachments.map((item) => ({ ...item, animated: true }));
  } else if (/STICKER/.test(type)) {
    kind = "sticker";
    content = "";
    attachments = [
      {
        ...media("sticker"),
        preview: url(raw.sticker) || media("sticker").preview,
        animation: url(raw.stickerAnimation?.url)
          ? {
              url: url(raw.stickerAnimation.url),
              sheet: raw.stickerAnimation.sheet === true,
              frames: Math.max(
                1,
                Math.min(500, Number(raw.stickerAnimation.frames) || 1),
              ),
              frameMs: Math.max(
                16,
                Math.min(2000, Number(raw.stickerAnimation.frameMs) || 250),
              ),
            }
          : undefined,
      },
    ];
  } else if (/VIDEO/.test(type)) {
    kind = "media";
    content = "";
    attachments = [media("video")];
  } else if (/VOICE/.test(type)) {
    kind = "media";
    content = "";
    attachments = [media("audio")];
  } else if (/FILE/.test(type)) {
    kind = "media";
    content = "";
    attachments = [media("file")];
  } else if (
    (/LINK|WEBCHAT|ARTICLE/.test(type) || body.action === "recommened.link") &&
    (body.href || body.url)
  ) {
    kind = "link";
    content = text(body.title || body.description);
    attachments = [media("link")];
    if (content === attachments[0].url || content === attachments[0].name)
      content = "";
  } else if (
    /CALL/.test(type) ||
    /recommened\.(misscall|calling|receivecall|calltime)/.test(
      body.action || "",
    )
  ) {
    kind = "call";
    content = text(raw.plainText) || text(body.title) || "Cuộc gọi";
  } else if (!content)
    content = text(body.text || body.content || body.title || body.description);
  if (kind === "text" && raw.plainText) content = text(raw.plainText);
  if (!content && !attachments.some((a) => a.url || a.preview)) {
    kind = "unsupported";
    content = "Loại tin nhắn này chưa hiển thị được";
  }
  const quote = object(raw.quote);
  const nativeText =
    typeof raw.message === "string" ? raw.message : text(body.title);
  const nativeStyles =
    body.action === "rtf" &&
    validRichStyles(object(body.params).styles, nativeText)
      ? object(body.params).styles
      : [];
  const displayed =
    kind === "text" &&
    raw.mentions?.length &&
    validMentions(raw.mentions, nativeText)
      ? displayMentions(
          nativeText,
          raw.mentions,
          raw.mentionNames,
          nativeStyles,
        )
      : null;
  if (displayed) content = displayed.text;
  return {
    id: raw.id,
    call: kind === "call" ? normalizeCallMessage(body) : undefined,
    topic: normalizeTopic(raw.topic, raw.topicAction),
    poll:
      kind === "poll"
        ? {
            id: String(raw.poll.poll_id),
            question: text(raw.poll.question),
            multiple: !!raw.poll.allow_multi_choices,
            anonymous: !!raw.poll.is_anonymous,
            expiredTime: Math.max(0, Number(raw.poll.expired_time) || 0),
            joined: !!raw.poll.joined,
            closed: !!raw.poll.closed,
            hideResults: !!raw.poll.is_hide_vote_preview && !raw.poll.joined,
            total:
              raw.poll.is_hide_vote_preview && !raw.poll.joined
                ? 0
                : (raw.poll.options || []).reduce(
                    (sum, o) => sum + (Number(o.votes) || 0),
                    0,
                  ),
            options: (raw.poll.options || []).map((o) => ({
              id: String(o.option_id),
              text: text(o.content),
              voted: !!o.voted,
              votes:
                raw.poll.is_hide_vote_preview && !raw.poll.joined
                  ? 0
                  : Number(o.votes) || 0,
            })),
          }
        : undefined,
    clientId: raw.clientId,
    photoGroup:
      /PHOTO/.test(type) &&
      photoParams.is_group_layout &&
      photoParams.group_layout_id
        ? {
            id: String(photoParams.group_layout_id),
            index: Number(photoParams.id_in_group) || 0,
            total: Number(photoParams.total_item_in_group) || 0,
          }
        : undefined,
    time: raw.time,
    type,
    kind,
    mine: raw.mine,
    starred: kind !== "recalled" && !!raw.starred,
    canRecall: kind !== "recalled" && !!raw.canRecall,
    currentReaction: kind === "recalled" ? null : selectedReaction(raw),
    reactions: (kind === "recalled" ? [] : [3, 5, 0, 32, 2, 20])
      .map((type) => ({
        type,
        count: Object.values(raw.reactions || {}).reduce(
          (n, r) => n + (Number(r?.[type]) || (r?.[type] ? 9000 : 0)),
          0,
        ),
        mine: Object.entries(raw.reactions || {}).some(
          ([id, r]) =>
            !!r?.[type] && (id === "0" || raw.reactionUsers?.[id]?.mine),
        ),
        users: Object.entries(raw.reactions || {})
          .filter(([, r]) => !!r?.[type])
          .map(([id]) => ({
            id: text(raw.reactionUsers?.[id]?.id) || id,
            name:
              id === "0"
                ? "Bạn"
                : text(raw.reactionUsers?.[id]?.name) || "Người dùng Zalo",
            mine: id === "0" || !!raw.reactionUsers?.[id]?.mine,
          })),
      }))
      .filter((r) => r.count > 0),
    sender: {
      id: text(raw.sender?.id),
      name: text(raw.sender?.name),
      avatarSrc: url(raw.sender?.avatarSrc),
    },
    text: content,
    mentions:
      displayed?.mentions ||
      (kind !== "recalled" && validMentions(raw.mentions, content)
        ? raw.mentions
        : undefined),
    styles: displayed
      ? displayed.styles
      : body.action === "rtf" &&
          validRichStyles(object(body.params).styles, content)
        ? object(body.params).styles
        : undefined,
    inline: normalizeInline(raw.inline, content),
    attachments,
    quote: Object.keys(quote).length
      ? {
          id: String(quote.msgId || quote.globalMsgId || ""),
          sender: text(quote.ownerName || quote.fromD || quote.name),
          text:
            text(quote.msg || quote.message || quote.content) ||
            text(object(quote.msg || quote.message).title),
          preview: url(
            object(quote.attach).thumbUrl || object(quote.attach).thumb,
          ),
        }
      : null,
  };
}

export function normalizeTopic(value, action) {
  const t = object(value),
    p = object(t.params),
    id = String(t.id || t.topicId || t.reminderId || "");
  if (
    !/^\d+$/.test(id) ||
    !p.title ||
    ![
      "update_board",
      "update_topic",
      "remind_topic",
      "create_reminder11",
      "update_reminder11",
      "remind_reminder11",
    ].includes(action)
  )
    return undefined;
  return {
    id,
    title: text(p.linkCaption || p.title).slice(0, 3000),
    startTime: Number(t.startTime) || 0,
    repeat: Number(t.repeat) || 0,
    onlyMe: !!(t.onlyMe || p.onlyMe),
    kind: Number(t.startTime) > 0 ? "reminder" : "note",
  };
}

export function selectedReaction(raw) {
  const mine = Object.entries(raw.reactions || {}).filter(([id]) => id === "0" || raw.reactionUsers?.[id]?.mine);
  const has = type => [3,5,0,32,2,20].includes(type) && mine.some(([,counts]) => !!counts?.[type]);
  // A self reaction received from another Zalo client can be newer than this client's cached currentIcon.
  if (raw.lastReactionMine && has(raw.lastReaction)) return raw.lastReaction;
  if (has(raw.currentReaction)) return raw.currentReaction;
  return [3,5,0,32,2,20].find(has) ?? null;
}
