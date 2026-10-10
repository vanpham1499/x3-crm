import {
  privacyKinds,
  validPrivacy,
  conversationPrivacy,
} from "./conversation-privacy.mjs";
export function validSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (privacyKinds.includes(value.kind)) return validPrivacy(value);
  if (value.kind === "read") return keys === "kind";
  if (value.kind === "unread")
    return keys === "kind,unread" && typeof value.unread === "boolean";
  if (value.kind === "rename")
    return (
      keys === "kind,name" &&
      typeof value.name === "string" &&
      value.name.length <= 50 &&
      !/[\r\n\x00-\x1f]/.test(value.name)
    );
  if (value.kind === "mute")
    return keys === "kind,mode" && [0, 1, 2, 3, 4].includes(value.mode);
  return (
    value.kind === "pin" &&
    keys === "kind,pinned" &&
    typeof value.pinned === "boolean"
  );
}

export async function conversationSettings(page, expectedId, body) {
  const { conversationId, settings } = body;
  if (!validSettings(settings)) throw Error("INVALID_REQUEST");
  if (privacyKinds.includes(settings.kind))
    return conversationPrivacy(page, expectedId, body);
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_SETTINGS_NOT_READY");
  return frame.evaluate(
    async ({ expectedId, conversationId, settings }) => {
      let require;
      const id = "zalo-team-settings-" + Date.now();
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
        throw Error("WEB_SETTINGS_NOT_READY");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_SETTINGS_NOT_READY");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (key) => require.c[key]?.exports;
      if (String(get("dThN")?.default?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const ids = get("jDHv")
        ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if ((!Array.isArray(ids) || !ids.includes(conversationId)) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      const users = get("UiPd")?.default,
        managers = get("QPNp")?.a;
      const pin = managers?.PinDataManager,
        mute = managers?.MuteDataManager;
      const self =
        conversationId === expectedId ||
        conversationId === String(get("NDmK")?.default?.sendToMeId);
      if (!users?.getDName || !pin?.isPinned || !mute?.isMuted)
        throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
      const marks = get("PGx3"), unreadManager = managers.UnreadDataManager;
      const isUnread = () => !!marks?.b?.(conversationId) ||
        Number(unreadManager?.getUnreadByConvIdSync?.(conversationId)?.smsUnreadCount || 0) > 0;
      const canMarkUnread = !self && typeof marks?.d === "function" &&
        typeof marks?.b === "function" && typeof unreadManager?.onClearUnreadConversations === "function";
      if (settings.kind === "unread") {
        if (!canMarkUnread) throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
        const conv = managers.ConvInfoDataManager?.getConvByIdSync(conversationId);
        if (!conv) throw Error("WEB_CONVERSATION_NOT_FOUND");
        const target = { ...conv, userId: conversationId };
        if (settings.unread && !isUnread()) await marks.d(target);
        if (!settings.unread && isUnread()) unreadManager.onClearUnreadConversations([target]);
        // Native read clearing finishes asynchronously; inspect state without repeating the mutation.
        for (let i = 0; i < 30 && isUnread() !== settings.unread; i++)
          await new Promise(resolve => setTimeout(resolve, 100));
        if (isUnread() !== settings.unread) throw Error("WEB_ACTION_UNKNOWN");
      }
      if (settings.kind === "rename") {
        if (self) throw Error("WEB_SETTINGS_SELF_RENAME_UNSUPPORTED");
        if (conversationId.startsWith("g")) {
          if (!settings.name.trim()) throw Error("INVALID_REQUEST");
          const core = get("dThN")?.default;
          if (!core?.changeGroupName)
            throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
          await core.changeGroupName(conversationId, settings.name.trim());
        } else {
          if (!users.setAliasName) throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
          await users.setAliasName(conversationId, settings.name.trim());
        }
      } else if (settings.kind === "mute") {
        if (!mute.onMute || !mute.onUnMute)
          throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
        if (settings.mode === 0) await mute.onUnMute(conversationId);
        else await mute.onMute(conversationId, settings.mode);
      } else if (
        settings.kind === "pin" &&
        !!pin.isPinned(conversationId) !== settings.pinned
      ) {
        if (!pin.pin || !pin.unpin) throw Error("WEB_SETTINGS_ADAPTER_CHANGED");
        if (
          settings.pinned &&
          pin.getTotalPinnedConversation(0) >= pin.getLimitPinnedConversation(0)
        )
          throw Error("WEB_PIN_LIMIT");
        await (settings.pinned
          ? pin.pin([conversationId])
          : pin.unpin([conversationId]));
      }
      return {
        name: conversationId.startsWith("g")
          ? get("Gm1y")?.default?.getGroupByIdSync(conversationId)
              ?.displayName ||
            (settings.kind === "rename" ? settings.name.trim() : "")
          : users.getDName(conversationId) || "",
        alias: users.getAliasName?.(conversationId) || "",
        muted: !!mute.isMuted(conversationId),
        pinned: !!pin.isPinned(conversationId),
        canRename: !self,
        unread: isUnread(),
        canMarkUnread,
      };
    },
    { expectedId, conversationId, settings },
  );
}
