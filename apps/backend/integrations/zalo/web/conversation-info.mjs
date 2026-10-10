import { normalizeMessage } from "./messages.mjs";
import { channel } from "./transport.mjs";

// Native sidebar services, read-only. Never select the native chat or send a seen receipt.
export async function readConversationInfo(
  page,
  expectedId,
  conversationId,
  section = "overview",
  cursor,
  emit,
) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_INFO_NOT_READY");
  const wire = await channel(page, (data) => emit?.(normalizeInfo(data)));
  try {
    const result = await frame.evaluate(
      async ({ expectedId, conversationId, section, cursor, wireId }) => {
        let require;
        const id = "zalo-team-info-" + Date.now();
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
          throw Error("WEB_INFO_NOT_READY");
        globalThis.webpackJsonp.push(chunk);
        if (!require) throw Error("WEB_INFO_NOT_READY");
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
        const ids = container
          ?.resolve(get("iZzu")?.ConvListController)
          ?.getList({ key: get("3xbP")?.c });
        if ((!Array.isArray(ids) || !ids.includes(conversationId)) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))
          throw Error("WEB_CONVERSATION_NOT_FOUND");
        const users = get("UiPd")?.default,
          groups = get("Gm1y")?.default;
        const loaderModule = get("dEOl"),
          loader = loaderModule?.default;
        const managerType = get("EYv5")?.a;
        const manager = managerType && container.resolve(managerType);
        const bounded = async (promise, ms = 12000) => {
          let timer;
          try {
            return await Promise.race([
              promise,
              new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error("WEB_INFO_TIMEOUT")), ms);
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        };
        const safeUrl = (v) =>
          typeof v === "string" && /^https:\/\//.test(v) ? v : undefined;
        const label = (v) => (typeof v === "string" ? v.slice(0, 500) : "");
        const group = conversationId.startsWith("g");
        let info = group ? groups?.getGroupByIdSync(conversationId) : null;
        let metadataError = null;
        try {
          if (group && (!info || section === "members"))
            info = await bounded(groups.getFullInfoGroupById(conversationId));
          else if (!group && !users?.getDName(conversationId))
            await bounded(users.getProfileFriendByIds([conversationId]));
        } catch {
          metadataError = "WEB_INFO_INCOMPLETE";
        }
        const ownerId = String(info?.creatorId || "");
        const adminIds = Array.isArray(info?.topMember)
          ? info.topMember.filter((m) => m.isAdmin).map((m) => String(m.id))
          : (info?.adminIds || []).map(String);
        const memberIds = [
          ...new Set((info?.memberIds || []).map(String)),
        ].sort(
          (a, b) =>
            (a === ownerId ? 0 : adminIds.includes(a) ? 1 : 2) -
            (b === ownerId ? 0 : adminIds.includes(b) ? 1 : 2),
        );
        const selfRole =
          ownerId === expectedId
            ? "owner"
            : adminIds.includes(expectedId)
              ? "admin"
              : "member";
        const joined = memberIds.includes(expectedId) && !metadataError;
        const memberOffset = section === "members" ? Number(cursor || 0) : 0;
        const selectedMembers = memberIds.slice(
          memberOffset,
          memberOffset + (section === "members" ? 50 : 8),
        );
        let profiles = {};
        try {
          const missing = selectedMembers.filter(
            (uid) => !users?.getDName(uid),
          );
          if (missing.length)
            profiles =
              (await bounded(users.getProfileFriendByIds(missing))) || {};
        } catch {
          metadataError = "WEB_INFO_INCOMPLETE";
        }
        const member = (uid) => ({
          id: uid,
          self: uid === expectedId,
          actions: !joined
            ? []
            : uid === expectedId
              ? ["leave"]
              : uid === ownerId
                ? []
                : [
                    ...(selfRole === "owner" && !users?.isZaloBot?.(uid)
                      ? [adminIds.includes(uid) ? "demote" : "promote"]
                      : []),
                    ...(selfRole === "owner" ||
                    (selfRole === "admin" && !adminIds.includes(uid))
                      ? ["remove"]
                      : []),
                  ],
          name: label(
            users?.getDName(uid) ||
              profiles[uid]?.displayName ||
              profiles[uid]?.zaloName,
          ),
          avatarSrc: safeUrl(users?.getAvatar(uid) || profiles[uid]?.avatar),
          role:
            String(info?.creatorId) === uid
              ? "owner"
              : adminIds.includes(uid)
                ? "admin"
                : "member",
        });
        const metadata = {
          name: label(
            group ? info?.displayName : users?.getDName(conversationId),
          ),
          avatarSrc: safeUrl(
            group ? info?.avatar : users?.getAvatar(conversationId),
          ),
          group,
          selfId: expectedId,
          selfRole,
          canLeave: group && joined,
          canAdd:
            group &&
            joined &&
            (!info?.setting?.addMemberOnly || selfRole !== "member"),
          memberCount: group
            ? Math.max(
                memberIds.length,
                Number(
                  info?.totalMember ||
                    groups?.getTotalMember(conversationId) ||
                    0,
                ),
              )
            : null,
          members: selectedMembers.map(member),
          memberCursor:
            memberIds.length > memberOffset + selectedMembers.length
              ? String(memberOffset + selectedMembers.length)
              : null,
          error: metadataError,
        };
        if (section === "members") return { metadata, sections: {} };
        const protectedContent =
          get("czzM")
            ?.b?.GetModule?.()
            ?.isContentProtected?.(conversationId) === true;
        const sections = {};
        const publish = () =>
          globalThis.__zaloTeamPacket(wireId, {
            metadata,
            sections,
            partial: true,
          });
        await publish();
        const types =
          section === "overview" ? ["images", "files", "links"] : [section];
        await Promise.all(
          types.map(async (type) => {
            let previewFailed = false;
            let presenting = Promise.resolve();
            let closed = false;
            const enqueue = (value) => {
              if (closed) return presenting;
              presenting = presenting
                .catch(() => {})
                .then(() => present(value));
              return presenting;
            };
            const limit =
              section === "overview" ? (type === "images" ? 8 : 3) : 24;
            try {
              if (protectedContent) throw Error("WEB_CONTENT_PROTECTED");
              if (!manager?.getMediaFromConversation || !loader?.getChatMedia)
                throw Error("WEB_INFO_ADAPTER_CHANGED");
              const page = await bounded(
                loader.getChatMedia(
                  conversationId,
                  type,
                  cursor || null,
                  limit + 1,
                  {
                    inFullMode: false,
                    loadMediaFromCloudMessages: !cursor,
                    handleSuccess: (value) => {
                      void enqueue(value).catch(() => {});
                    },
                  },
                ),
              );
              await enqueue(page);
              // Native loader skips cloud for inactive conversations in some
              // versions. Preserve read-only access without selecting that chat.
              if (
                !cursor &&
                page.items.length < limit &&
                loader.supportServer(conversationId) &&
                loader._activeConvId !== conversationId
              ) {
                try {
                  await bounded(
                    loader.loadMiniPreview(
                      conversationId,
                      loaderModule.MEDIA_TYPE[type],
                    ),
                  );
                  await enqueue(
                    await bounded(
                      loader.getChatMedia(
                        conversationId,
                        type,
                        null,
                        limit + 1,
                        { inFullMode: false },
                      ),
                    ),
                  );
                } catch {
                  previewFailed = true;
                  if (sections[type])
                    sections[type].error = "WEB_INFO_INCOMPLETE";
                  await publish();
                }
              }
            } catch (e) {
              closed = true;
              await presenting.catch(() => {});
              sections[type] = {
                items: sections[type]?.items || [],
                cursor: sections[type]?.cursor || null,
                error:
                  e.message === "WEB_CONTENT_PROTECTED"
                    ? e.message
                    : "WEB_INFO_UNAVAILABLE",
              };
              await publish();
            } finally {
              closed = true;
              await presenting.catch(() => {});
            }
            async function present(page) {
              if (!Array.isArray(page?.items))
                throw Error("WEB_INFO_ADAPTER_CHANGED");
              const unique = [
                ...new Map(
                  page.items
                    .filter(
                      (m) => m && String(m.msgId || m.cliMsgId) !== cursor,
                    )
                    .map((m) => [String(m.msgId || m.cliMsgId), m]),
                ).values(),
              ];
              unique.sort(
                (a, b) =>
                  Number(b.sendDttm) - Number(a.sendDttm) ||
                  String(b.msgId).length - String(a.msgId).length ||
                  String(b.msgId).localeCompare(String(a.msgId)),
              );
              const rows = unique.slice(0, limit);
              const authorId = (m) =>
                String(m.fromUid) === "0"
                  ? expectedId
                  : String(m.fromUid || "");
              let mediaProfiles = {};
              const missingSenders = [...new Set(rows.map(authorId))].filter(
                (uid) => uid && !users?.getDName(uid),
              );
              if (missingSenders.length) {
                try {
                  mediaProfiles =
                    (await bounded(
                      users.getProfileFriendByIds(missingSenders),
                    )) || {};
                } catch {
                  /* Media remains available when a sender profile is unavailable. */
                }
              }
              const items = rows.map((m) => ({
                id: String(m.msgId || m.cliMsgId),
                clientId: String(m.cliMsgId || ""),
                time: Number(m.sendDttm || 0),
                type:
                  type === "files"
                    ? "MSG_FILE"
                    : type === "links"
                      ? "MSG_LINK_CLIENT"
                      : m.subType === get("1pet")?.MSG_SUBTYPE_MEDIA_VIDEO
                        ? "MSG_VIDEO"
                        : "MSG_PHOTO",
                message: get("Q8nW")?.o?.(m.message) || m.message,
                sender: {
                  id: authorId(m),
                  name: label(
                    users?.getDName(authorId(m)) ||
                      mediaProfiles[authorId(m)]?.displayName ||
                      mediaProfiles[authorId(m)]?.zaloName,
                  ),
                },
                mine: false,
              }));
              sections[type] = {
                items,
                cursor:
                  unique.length > limit && rows.length
                    ? String(rows.at(-1).msgId || rows.at(-1).cliMsgId)
                    : null,
                error: previewFailed ? "WEB_INFO_INCOMPLETE" : null,
              };
              await publish();
            }
          }),
        );
        return { metadata, sections };
      },
      { expectedId, conversationId, section, cursor, wireId: wire.id },
    );
    return normalizeInfo(result);
  } finally {
    wire.close();
  }
}
function normalizeInfo(result) {
  for (const value of Object.values(result.sections)) {
    value.items = value.items.flatMap((raw) =>
      normalizeMessage(raw).attachments.map((attachment, index) => ({
        ...attachment,
        id: `${raw.id}:${index}`,
        messageId: raw.id,
        time: raw.time,
        sender: raw.sender,
      })),
    );
  }
  return result;
}
