// Vendor modules verified in the Web bundles loaded on 30/09/2026.
// Read existing client managers only: never open a chat or mark messages read.
import { normalizeInline } from "./inline.mjs";
// A frame belongs to one authenticated profile. Cache only identity strings;
// never share mappings between accounts or retain closed browser frames.
const groupIdentities = new WeakMap();
export async function readConversations(page, expectedId) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_CONVERSATIONS_NOT_READY:frame_loading");
  let identity = groupIdentities.get(frame);
  if (
    !identity ||
    identity.expected !== expectedId ||
    identity.expires <= Date.now()
  ) {
    identity = {
      expected: expectedId,
      ids: {},
      retryAt: 0,
      expires: Date.now() + 300000,
    };
    groupIdentities.set(frame, identity);
  }
  const rows = await frame.evaluate(
    async ({ expected, cachedIds, resolveMissing }) => {
      let require;
      const id = "zalo-team-list-" + Date.now();
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
        throw Error("WEB_CONVERSATIONS_NOT_READY:modules_loading");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_CONVERSATIONS_NOT_READY:modules_loading");
      delete require.c[id];
      delete require.m[id];
      const index = globalThis.webpackJsonp.indexOf(chunk);
      if (index >= 0) globalThis.webpackJsonp.splice(index, 1);
      const get = (key) => require.c[key]?.exports;
      if (String(get("dThN")?.default?.userId || "") !== expected)
        throw Error("WEB_IDENTITY_MISMATCH");
      const managers = get("QPNp")?.a;
      const container = get("jDHv")?.ModuleContainer;
      const previewType = get("yzMR")?.PreviewDataManager;
      const formatter = get("sh7v");
      const users = get("UiPd")?.default;
      const hidden = get("EFQ6")?.a;
      if (!hidden?.isThreadHidden)
        throw Error("WEB_CONVERSATIONS_NOT_READY:privacy_loading");
      const groups = get("Gm1y")?.default;
      const visibility = get("RojW")?.ConvList;
      const listType = get("iZzu")?.ConvListController;
      const mainWindow = get("3xbP")?.c;
      if (
        !managers ||
        !container ||
        !previewType ||
        !listType ||
        mainWindow == null ||
        !formatter?.a ||
        !formatter?.b ||
        !visibility?.getVisibleConv
      )
        throw Error("WEB_CONVERSATIONS_ADAPTER_CHANGED");
      const previews = container.resolve(previewType);
      const list = container.resolve(listType);
      if (!list?.getList || !list?.isPreviewLoaded)
        throw Error("WEB_CONVERSATIONS_ADAPTER_CHANGED");
      if (previews.doneLoadDB === false)
        throw Error("WEB_CONVERSATIONS_NOT_READY:database_loading");
      if (!list.isPreviewLoaded())
        throw Error("WEB_CONVERSATIONS_NOT_READY:preview_loading");
      // ConvInfo includes retained contacts/groups whose previews have rolled
      // out of the Web inbox. Use the same visible ID list as the native inbox,
      // independent of its selected unread/label filter; never invent a cutoff.
      const visibleIds = list.getList({ key: mainWindow });
      if (!Array.isArray(visibleIds))
        throw Error("WEB_CONVERSATIONS_ADAPTER_CHANGED");
      const lang = get("c51z")?.default;
      const kinds = get("1pet");
      // Match the vendor's 8W5D preview hook. The formatter's second argument
      // is sync state, NOT the conversation record. Omitting these flags makes
      // MSG_SYNCING appear as an out-of-range message even for recent chats.
      let syncOptions = null;
      try {
        const configType = get("Qx9e")?.SyncConfigService;
        const sync = get("V4WO");
        if (configType && sync?.SyncController) {
          const config = container.resolve(configType);
          const controller = container.resolve(sync.SyncController);
          if (config?.isFeatureEnabled && controller?.getItem)
            syncOptions = {
              isSyncEnabled: !!config.isFeatureEnabled(),
              isSyncing:
                controller.getItem({ key: "state" })?.state ===
                sync.SyncStatus.Syncing,
            };
        }
      } catch {
        // Unknown sync state must not be represented as an empty history.
      }
      const text = (value) =>
        typeof value === "string" ? value.slice(0, 1000) : "";
      const safeImage = (value) =>
        typeof value === "string" && /^https:\/\//.test(value)
          ? value
          : undefined;
      const previewTokens = (content, sender) => {
        if (!content) return [];
        try {
          const parser = get("P6UB");
          const config = get("NDmK")?.default;
          const tokens = parser.default.parseMessage({
            message: content,
            shouldParseKeyword: false,
            parseLink: false,
          });
          const sprite = new URL(
            get("z0WU").default.getEmojiSrc(""),
            "https://chat.zalo.me/",
          ).href;
          const inline = tokens.map((token) => {
            const value =
              typeof token === "string"
                ? token
                : String(token.text || token.value || "");
            const key = String(token.value || value).toLowerCase();
            const emoji = [
              parser.TokenTypes.EMOJI_TOKEN,
              parser.TokenTypes.EMOJI_TOKEN_V2,
            ].includes(token.type);
            const position = config?.emojiMapPos?.[key];
            return emoji && position
              ? { text: value, sprite, position }
              : { text: value };
          });
          // Preserve sender labels and all original characters, including links.
          if (inline.map((token) => token.text).join("") !== content) return [];
          return sender ? [{ text: sender + ": " }, ...inline] : inline;
        } catch {
          return [];
        }
      };
      const rows = [];
      for (const value of new Set(visibleIds)) {
        const conversationId = String(value || "");
        if (!/^g?\d+$/.test(conversationId)) continue;
        if (hidden.isThreadHidden(conversationId)) continue;
        const conv = visibility.getVisibleConv(conversationId);
        if (!conv) continue;
        const preview = previews.getPreviewByIDSync(conversationId);
        const group = conversationId.startsWith("g");
        const info = group ? groups?.getGroupByIdSync(conversationId) : null;
        const self =
          conversationId === String(get("NDmK")?.default?.sendToMeId);
        const name = self
          ? "My Documents"
          : group
            ? groups?.getDName(conversationId)
            : users?.getDName(conversationId);
        let content = "",
          sender = "",
          previewError = false,
          previewState = preview ? "ready" : "unavailable";
        if (preview) {
          try {
            const pending = kinds && preview.messageType === kinds.MSG_SYNCING;
            const outOfRange =
              kinds && preview.messageType === kinds.MSG_SYNCING_OUT_OF_RANGE;
            const encryptedPending =
              kinds && preview.substate === kinds.MSG_E2EE_PRELOAD;
            if (pending) previewState = "sync_pending";
            if (outOfRange) previewState = "out_of_range";
            if (encryptedPending) previewState = "loading";
            const formatted = formatter.a(preview, syncOptions || {});
            content = text(formatted.message);
            if (formatted.isSystemicMessage && content.startsWith("STR_"))
              content = text(lang?.str(content));
            if (pending && !syncOptions) {
              content =
                text(lang?.str("STR_PREVIEW_SYNC_FAILED_W_BRACKET")) ||
                "[Tin nhắn chưa đồng bộ]";
              previewError = true;
            }
            if (encryptedPending)
              content =
                text(lang?.str("STR_PREVIEW_LOADING_TEXT")) || "Đang tải…";
            sender = text(formatter.b(preview));
          } catch {
            previewError = true;
          }
          if (!content)
            content =
              text(preview.computedMessage) ||
              text(preview.message) ||
              text(preview.message?.title);
        }
        const unread =
          managers.UnreadDataManager?.getUnreadByConvIdSync(conversationId);
        const pinTime = Number(
          managers.PinDataManager?.getPinTime(conversationId) || 0,
        );
        rows.push({
          conversationId,
          name:
            text(name) ||
            text(conv.displayName) ||
            text(conv.dName) ||
            conversationId,
          avatarMembers: group
            ? (info?.topMember || []).slice(0, 4).map((member) => {
                const uid = String(
                  typeof member === "object"
                    ? member.id || member.userId || member.uid || ""
                    : member,
                );
                return {
                  name:
                    text(users?.getDName(uid)) ||
                    text(member?.dName) ||
                    text(member?.displayName),
                  // Group mini-info carries portraits even when these users
                  // have never been hydrated into the contact cache.
                  avatarSrc:
                    safeImage(users?.getAvatar(uid)) ||
                    safeImage(member?.avatar),
                };
              })
            : undefined,
          memberCount: group
            ? Math.max(
                0,
                Number(
                  info?.totalMember ||
                    groups?.getTotalMember?.(conversationId) ||
                    0,
                ),
              )
            : undefined,
          avatarSrc: safeImage(
            group ? info?.avatar : users?.getAvatar(conversationId),
          ),
          group,
          self,
          preview: content ? (sender ? sender + ": " : "") + content : "",
          previewInline: previewTokens(content, sender),
          previewError,
          previewState,
          messageType: preview?.messageType ?? null,
          lastMessageId: String(preview?.msgId || ""),
          updatedAt: Math.max(
            0,
            Number(preview?.messageTime || conv.lastMessageTime || 0),
          ),
          unread: Math.max(0, Number(unread?.smsUnreadCount || 0)),
          unreadMarked: !!get("PGx3")?.b?.(conversationId),
          pinned: pinTime > 0,
          muted: !!managers.MuteDataManager?.isMuted(conversationId),
          pinTime,
        });
      }
      // The worker owns the global-ID mapping. This reads its existing group
      // cache in one batch; it does not fetch group details or join/open a chat.
      // Never substitute a per-account conversation ID when mapping is missing.
      for (const row of rows)
        if (row.group && cachedIds[row.conversationId])
          row.globalGroupId = cachedIds[row.conversationId];
      const groupIds = rows
        .filter((row) => row.group && !row.globalGroupId)
        .map((row) => row.conversationId);
      if (
        resolveMissing &&
        groupIds.length &&
        typeof groups?.getGlobalIdsFromGroupIds === "function"
      ) {
        let timer;
        try {
          const identities = await Promise.race([
            groups.getGlobalIdsFromGroupIds(groupIds),
            new Promise((resolve) => {
              timer = setTimeout(() => resolve({}), 500);
            }),
          ]);
          for (const row of rows) {
            if (!row.group) continue;
            const value = identities?.[row.conversationId];
            const id =
              typeof value === "string"
                ? value
                : Number.isSafeInteger(value)
                  ? String(value)
                  : "";
            if (
              /^[A-Za-z0-9_-]{1,128}$/.test(id) &&
              !["0", "null", "undefined"].includes(id)
            )
              row.globalGroupId = id;
          }
        } catch {
          // Identity enrichment must not make the inbox unavailable.
        } finally {
          clearTimeout(timer);
        }
      }
      return rows;
    },
    {
      expected: expectedId,
      cachedIds: identity.ids,
      resolveMissing: Date.now() >= identity.retryAt,
    },
  );
  for (const row of rows)
    if (row.globalGroupId) identity.ids[row.conversationId] = row.globalGroupId;
  if (
    rows.some((row) => row.group && !row.globalGroupId) &&
    Date.now() >= identity.retryAt
  )
    identity.retryAt = Date.now() + 30000;
  return rows.map((row) => ({
    ...row,
    previewInline: normalizeInline(row.previewInline, row.preview),
  }));
}

export function mergeConversations(sources) {
  const unique = new Map();
  for (const { account, rows } of sources)
    for (const row of rows) {
      // Same group/contact in two accounts remains two explicitly owned entries.
      const id = `${account.id}:${row.conversationId}`;
      unique.set(id, {
        ...row,
        id,
        accountId: account.id,
        accountName: account.name,
      });
    }
  return [...unique.values()].sort(
    (a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      b.updatedAt - a.updatedAt ||
      a.id.localeCompare(b.id),
  );
}
