import { normalizeMessage } from "./normalize.mjs";

/**
 * The catalog adapter is pinned to the separately verified 26.9.10 bundle.
 * Only existing cache objects and the native local Message collection's getAll
 * operation are used. Native UI loaders, contact fetchers and selection APIs
 * are deliberately absent: even some methods named *Sync schedule API calls.
 */
export async function readNativeCatalog(options, normalize) {
  if (options.version !== "26.9.10")
    throw new Error("CATALOG_VERSION_UNSUPPORTED");
  if (
    globalThis.location?.protocol !== "file:" ||
    typeof globalThis.$zelectron?.openDevTool !== "function"
  )
    throw new Error("NATIVE_ZALO_REQUIRED");
  const chunks = globalThis.webpackJsonp;
  if (!Array.isArray(chunks) || chunks.push === Array.prototype.push)
    throw new Error("WEBPACK_RUNTIME_UNAVAILABLE");
  const marker = `x3-catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let registry;
  const record = [
    [marker],
    {
      [marker]: (module, exports, require) => {
        registry = require;
      },
    },
    [[marker]],
  ];
  try {
    chunks.push(record);
  } finally {
    if (registry?.c) delete registry.c[marker];
    if (registry?.m) delete registry.m[marker];
    const index = chunks.indexOf(record);
    if (index >= 0) chunks.splice(index, 1);
  }
  if (!registry?.c) throw new Error("WEBPACK_CACHE_UNAVAILABLE");
  const cached = (id) => registry.c[id]?.exports;
  const identity = (value) => {
    if (typeof value === "number" && !Number.isSafeInteger(value)) return "";
    const result =
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    return /^[\w-]{1,128}$/.test(result) ? result : "";
  };
  const expected = identity(options.expectedAccountId);
  const ensureAccount = () => {
    const fetcherId = identity(cached("dThN")?.default?.userId);
    const handlerId = identity(cached("fdn9")?.a?.userId);
    if (
      !expected ||
      !/^\d+$/.test(expected) ||
      fetcherId !== expected ||
      handlerId !== expected
    )
      throw new Error("CATALOG_ACCOUNT_MISMATCH");
  };
  ensureAccount();
  const str = (value, limit = 512) =>
    typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, limit)
      : "";
  const url = (value) => {
    if (typeof value !== "string" || value.length > 8192) return null;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password
        ? parsed.href
        : null;
    } catch {
      return null;
    }
  };
  const timestamp = (value) => {
    let number = Number(value);
    if (number > 0 && number < 1e12) number *= 1000;
    return Number.isFinite(number) &&
      number >= 1e12 &&
      number <= Date.now() + 240000
      ? new Date(number).toISOString()
      : null;
  };
  const managers = cached("QPNp")?.a;
  // Read initialized instances directly: the public static getters resolve and
  // may instantiate native services. Never initialize a module for this reader.
  const convManager = managers?._convInfoManager;
  const unreadManager = managers?._unreadDataManager;
  const previewManager = convManager?._pm;
  // The PC's preview formatter handles cards, calls, stickers, mentions and
  // translated system notices. Read it in the source account, never on the UI host.
  const nativePreview = preview => {
    if (!preview) return null;
    const formatter = cached('sh7v'), locale = cached('c51z')?.default;
    if (typeof formatter?.a !== 'function' || typeof formatter?.b !== 'function' || !locale) return null;
    try {
      const result = formatter.a({...preview});
      let message = result?.message;
      if (result?.isSystemicMessage && typeof message === 'string')
        message = result.systemicMessageArgs?.length ? locale.trans(message, result.systemicMessageArgs) : locale.str(message);
      if (typeof message !== 'string') return null;
      const sender = formatter.b({...preview});
      return (typeof sender === 'string' && sender ? `${sender}: ${message}` : message).slice(0, 2000);
    } catch { return null; }
  };
  const friends = cached("JWY6")?.a;
  const groups = cached("8apa")?.a;
  const profile = (id) => friends?._cacheProfileInfo?.[id] || null;
  const name = (id, source) =>
    str(
      friends?._aliasName?.[id] ||
        friends?._phonebookName?.[id] ||
        source?.displayName ||
        source?.zaloName ||
        source?.dName ||
        source?.name,
    );
  const thread = (nativeId) => {
    const id = identity(nativeId);
    // The native conversation store also contains aggregate folders such as
    // stranger_box. Only real peer/group IDs can be opened as a conversation.
    if (!/^(?:g)?\d{1,128}$/.test(id)) return null;
    const isGroup = id.startsWith("g") && /^g\d+$/.test(id);
    return {
      externalId: isGroup ? id.slice(1) : id,
      threadId: isGroup ? id.slice(1) : id,
      threadType: isGroup ? "group" : "user",
    };
  };
  if (options.operation === "avatars") {
    // Ephemeral presentation data, scoped to the caller's authorized catalog.
    // Never archive signed URLs, fetch profiles, select chats or write caches.
    if (!Array.isArray(options.threads) || options.threads.length > 10000 || options.threads.some(row =>
      !/^\d{1,128}$/.test(row?.threadId || "") || !["user", "group"].includes(row?.threadType)))
      throw new Error("CATALOG_AVATAR_SCOPE_INVALID");
    const allowedUrl = value => {
      const safe = url(value); if (!safe) return null;
      const host = new URL(safe).hostname;
      return ["zadn.vn", "zdn.vn", "zaloapp.com", "zalo.me", "zalo.vn"].some(domain => host === domain || host.endsWith(`.${domain}`)) ? safe : null;
    };
    const group = id => groups?._cacheGroupInfo?.[`g${id}`];
    const memberEntries = row => row.threadType === "group" && Array.isArray(group(row.threadId)?.topMember)
      ? group(row.threadId).topMember.slice(0, 4) : [];
    const memberId = value => identity(typeof value === "object" ? value?.id || value?.userId : value);
    const members = row => memberEntries(row).map(memberId).filter(id => /^\d+$/.test(id));
    const ids = [...new Set([expected, ...options.threads.flatMap(row => row.threadType === "user" ? [row.threadId] : members(row))])];
    const local = new Map();
    const core = cached("fsN4")?.default?.instance?.Core;
    for (const collection of [core?.FriendsInfo, core?.Friend]) {
      if (typeof collection?.getMultiIfExists !== "function") continue;
      const missing = ids.filter(id => !allowedUrl(profile(id)?.avatar) && !allowedUrl(local.get(id)?.avatar));
      for (let index = 0; index < missing.length; index += 250) {
        const batch = missing.slice(index, index + 250);
        const records = await collection.getMultiIfExists(batch);
        ensureAccount();
        if (!Array.isArray(records) || records.length > batch.length) throw new Error("CATALOG_AVATAR_DATABASE_INVALID");
        for (const record of records) if (batch.includes(identity(record?.userId)) && allowedUrl(record?.avatar)) local.set(identity(record.userId), record);
      }
    }
    const avatar = id => allowedUrl(profile(id)?.avatar) || allowedUrl(local.get(id)?.avatar);
    // CRM also retains historical/implicit rows created by older observers.
    // Only a fully loaded native catalog can establish that a chat is absent.
    // Never infer absence from a missing profile/name/avatar, or while booting.
    const conversationsLoaded = convManager?.doneLoadDB === true && convManager.data instanceof Map;
    const rows = options.threads.map(row => {
      const nativeId = row.threadType === "group" ? `g${row.threadId}` : row.threadId;
      return { ...row,
        conversationPresent: conversationsLoaded
          ? (convManager.data.has(nativeId) || (row.threadType === 'user' && row.threadId === expected)) : null,
        preview: nativePreview(previewManager?.data?.get(nativeId)),
        previewAt: timestamp(previewManager?.data?.get(nativeId)?.messageTime),
        avatarUrl: (row.threadType === "group" ? allowedUrl(group(row.threadId)?.avatar) : avatar(row.threadId)) || allowedUrl(convManager?.data?.get(nativeId)?.avatar),
        avatarMembers: memberEntries(row).map(value => allowedUrl(value?.avatar) || avatar(memberId(value))).filter(Boolean),
      };
    });
    ensureAccount();
    return { accountId: expected, conversationsLoaded, avatarUrl: avatar(expected), rows };
  }

  if (options.operation === "invariants") {
    // +Wh9.a is a bounded map wrapper; reading _map avoids invoking loaders.
    const messageCache = cached("MPLC")?.b?.messageCache?._cache?._map;
    const selectedConversationIds =
      messageCache instanceof Map
        ? [...messageCache.entries()]
            .filter(([, entry]) => entry?._active === true)
            .map(([id]) => identity(id))
            .filter(Boolean)
            .sort()
        : null;
    const unreads =
      unreadManager?.data instanceof Map
        ? [...unreadManager.data.entries()]
            .map(([id, entry]) => ({
              nativeConversationId: identity(id),
              count: Math.max(0, Number(entry?.smsUnreadCount) || 0),
              notCount: Math.max(0, Number(entry?.smsUnreadNotCount) || 0),
              lastSeenMsgId: identity(entry?.lastSeenMsgId),
              lastSeenMsgTime: str(entry?.lastSeenMsgTime, 32),
              lastProcessMsgId: identity(entry?.lastProcessMsgId),
            }))
            .sort((a, b) =>
              a.nativeConversationId.localeCompare(b.nativeConversationId),
            )
        : null;
    ensureAccount();
    return {
      accountId: expected,
      selectedConversationIds,
      unreads,
      coverage: {
        selectedChat: selectedConversationIds !== null,
        unread: unreads !== null,
      },
    };
  }

  if (options.operation === "snapshot") {
    if (!(convManager?.data instanceof Map))
      throw new Error("NATIVE_CONVERSATION_CACHE_UNAVAILABLE");
    if (
      !friends?._cacheProfileInfo ||
      !Array.isArray(friends?._cacheUidsFriends)
    )
      throw new Error("NATIVE_CONTACT_CACHE_UNAVAILABLE");
    const limit = Math.min(10000, Math.max(1, Number(options.limit) || 10000));
    const contacts = friends._cacheUidsFriends
      .slice(0, limit)
      .map((id) => {
        const value = profile(id);
        if (!value || !/^\d{1,128}$/.test(identity(id))) return null;
        return {
          externalId: identity(id),
          displayName: name(id, value) || identity(id),
          avatarUrl: url(value.avatar),
          phone: str(value.phoneNumber || value.phone, 64) || null,
        };
      })
      .filter(Boolean);
    const conversations = [...convManager.data.entries()]
      .slice(0, limit)
      .map(([nativeId, value]) => {
        const keys = thread(nativeId);
        if (!keys) return null;
        const source =
          keys.threadType === "group"
            ? groups?._cacheGroupInfo?.[nativeId]
            : profile(nativeId);
        const preview =
          previewManager?.data instanceof Map
            ? previewManager.data.get(nativeId)
            : null;
        const unread =
          unreadManager?.data instanceof Map
            ? unreadManager.data.get(nativeId)
            : null;
        return {
          ...keys,
          title:
            name(nativeId, source) ||
            str(value?.displayName || value?.name) ||
            keys.threadId,
          avatarUrl: url(source?.avatar || value?.avatar),
          contactId: keys.threadType === "user" ? keys.threadId : null,
          unreadCount: Math.max(
            0,
            Number(unread?.smsUnreadCount ?? value?.smsUnreadCount) || 0,
          ),
          lastMessageAt: timestamp(
            preview?.messageTime || value?.lastMessageTime || value?.lastActive,
          ),
          lastMessageId:
            identity(preview?.msgId || value?.lastSmsLocalId) || null,
          // Draft is never substituted for the last received/sent message.
          preview: nativePreview(preview) ?? (
            typeof preview?.message === "string"
              ? preview.message.slice(0, 2000)
              : str(preview?.message?.text || preview?.message?.title, 2000)),
        };
      })
      .filter(Boolean);
    const own = profile(expected);
    ensureAccount();
    return {
      accountId: expected,
      version: options.version,
      account: {
        externalId: expected,
        displayName: name(expected, own) || expected,
        avatarUrl: url(own?.avatar),
      },
      conversations,
      contacts,
      coverage: {
        conversationsLoaded: convManager.doneLoadDB === true,
        conversationsTruncated: convManager.data.size > limit,
        contactsCachedOnly: true,
        contactsTruncated: friends._cacheUidsFriends.length > limit,
        previewsAvailable: previewManager?.data instanceof Map,
        unreadAvailable: unreadManager?.data instanceof Map,
        history: "native-local-db",
      },
    };
  }

  if (options.operation !== "messages")
    throw new Error("CATALOG_OPERATION_UNSUPPORTED");
  const threadId = identity(options.threadId);
  if (
    !threadId ||
    !["user", "group"].includes(options.threadType) ||
    (options.threadType === "group" && !/^\d+$/.test(threadId))
  )
    throw new Error("CATALOG_INVALID_THREAD");
  const nativeId = options.threadType === "group" ? `g${threadId}` : threadId;
  const collection = cached("fsN4")?.default?.instance?.Core?.Message;
  const bounds = cached("mE25");
  const direction = cached("wH4e")?.c?.PREV;
  if (
    typeof collection?.getAll !== "function" ||
    !bounds?.a ||
    !bounds?.b ||
    direction === undefined
  )
    throw new Error("NATIVE_MESSAGE_DATABASE_UNAVAILABLE");
  const limit = Math.min(
    200,
    Math.max(1, Math.floor(Number(options.limit) || 100)),
  );
  let upperTime = String(bounds.b),
    upperId = String(bounds.a),
    exclusive = false;
  if (options.cursor != null) {
    if (
      !options.cursor ||
      !/^\d{1,20}$/.test(String(options.cursor.sendDttm)) ||
      !identity(options.cursor.msgId)
    )
      throw new Error("CATALOG_INVALID_CURSOR");
    upperTime = String(options.cursor.sendDttm);
    upperId = identity(options.cursor.msgId);
    exclusive = true;
  }
  const rows = await collection.getAll(
    {
      from: [nativeId, "", ""],
      to: [nativeId, upperTime, upperId],
      excludeFrom: false,
      excludeTo: exclusive,
    },
    {
      index: "userId_sendDttm_msgId",
      direction,
      limit: limit + 1,
      partition: nativeId,
      useLGKeyRange: true,
    },
  );
  ensureAccount();
  if (!Array.isArray(rows))
    throw new Error("NATIVE_MESSAGE_DATABASE_RESULT_INVALID");
  const constants = cached("1pet");
  const page = rows.slice(0, limit);
  const messages = page
    .map((raw) => {
      if (!raw || String(raw.toUid) !== nativeId) return null;
      let type = raw.msgType;
      if (type === constants?.MSG_TEXT) type = "webchat";
      else if (type === constants?.MSG_PHOTO || type === constants?.MSG_PHOTO_2)
        type = "chat.photo";
      else if (constants?.MSG_FILE !== undefined && type === constants.MSG_FILE)
        type = "share.file";
      else if (
        constants?.MSG_VIDEO !== undefined &&
        type === constants.MSG_VIDEO
      )
        type = "chat.video.msg";
      else if (
        constants?.MSG_VOICE !== undefined &&
        type === constants.MSG_VOICE
      )
        type = "chat.voice";
      // DB messages store the destination conversation even on incoming rows.
      // Live envelopes use destination user/group; pass explicit group status.
      const event = normalize(
        {
          msgId: raw.msgId,
          fromUid: raw.fromUid,
          toUid: nativeId,
          isGroup: options.threadType === "group",
          msgType: type,
          message: raw.message,
          content: raw.content,
          sendDttm: raw.sendDttm,
        },
        expected,
      );
      if (
        !event ||
        event.threadId !== threadId ||
        event.threadType !== options.threadType
      )
        return null;
      if (event.attachments.length) {
        const attachment = event.attachments[0];
        const exists = cached("C64z")?.fileExistsSyncV2;
        const validPath = (value) =>
          typeof value === "string" &&
          value.length <= 4096 &&
          !value.includes("\0") &&
          !/^[a-z]+:\/\//i.test(value);
        const setExistingPath = (value, source) => {
          if (!validPath(value) || typeof exists !== "function") return false;
          try {
            if (!exists(value)) return false;
            attachment.localPath = value;
            attachment.localSource = source;
            return true;
          } catch {
            return false;
          }
        };
        // Only native outgoing rows may contribute an upload path. The worker
        // still resolves the real path beneath explicit per-account media roots.
        if (event.direction === "out")
          setExistingPath(raw.localPath, "native-upload");
        if (
          !attachment.localPath &&
          event.kind === "image" &&
          identity(raw.cliMsgId)
        ) {
          const locator = cached("3tSQ")?.a;
          const quality = cached("7g0K")?.k?.oriUrl;
          if (
            typeof locator?.getPathIfExistsSync === "function" &&
            quality !== undefined
          ) {
            try {
              // Audited chain: 3tSQ path builder -> IpzU path getter ->
              // C64z fs.accessSync(F_OK). Never getEnsuredDir or a downloader.
              const found = locator.getPathIfExistsSync(
                expected,
                identity(raw.cliMsgId),
                identity(raw.fromUid),
                nativeId,
                quality,
                "",
              );
              if (validPath(found?.path)) {
                attachment.localPath = found.path;
                attachment.localSource = "native-photo-cache";
              }
            } catch {
              /* A missing cached helper/cache file leaves URL fallback. */
            }
          }
        }
        if (
          !attachment.localPath &&
          ["file", "audio", "video"].includes(event.kind)
        ) {
          const fileCache = cached("t77n")?.a;
          if (
            typeof fileCache?.getFileKey === "function" &&
            typeof fileCache?.get === "function"
          ) {
            try {
              // /5+7/znWm getFileKey/get are pure lookup/shallow-copy functions.
              const key = fileCache.getFileKey(identity(raw.msgId));
              const info = key ? fileCache.get(key)?.extraInfo : null;
              if (!setExistingPath(info?.localPath, "native-download-cache"))
                setExistingPath(
                  info?.autoDownloadPath,
                  "native-download-cache",
                );
            } catch {
              /* Do not initialize native stores to discover a path. */
            }
          }
        }
      }
      return event;
    })
    .filter(Boolean);
  const last = page[page.length - 1];
  return {
    accountId: expected,
    threadId,
    threadType: options.threadType,
    messages,
    nextCursor:
      rows.length > limit &&
      last &&
      identity(last.msgId) &&
      /^\d{1,20}$/.test(String(last.sendDttm))
        ? { sendDttm: String(last.sendDttm), msgId: identity(last.msgId) }
        : null,
    scanned: page.length,
    skipped: page.length - messages.length,
    coverage: "native-local-db",
  };
}

export function catalogExpression(options) {
  // Serialization also rejects functions; only explicitly named scalar fields
  // cross the boundary. No caller-supplied source code or method name executes.
  const allowed = {
    version: options.version,
    expectedAccountId: options.expectedAccountId,
    operation: options.operation,
    threadId: options.threadId,
    threadType: options.threadType,
    limit: options.limit,
    threads: options.threads?.map(row => ({ threadId: row.threadId, threadType: row.threadType })),
    cursor:
      options.cursor == null
        ? null
        : { sendDttm: options.cursor.sendDttm, msgId: options.cursor.msgId },
  };
  return `(${readNativeCatalog.toString()})(${JSON.stringify(allowed)}, (${normalizeMessage.toString()}))`;
}
