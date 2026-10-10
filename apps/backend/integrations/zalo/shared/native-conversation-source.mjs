/**
 * Read-only native models for a shared Zalo PC chat renderer.
 *
 * The caller must authorize the source account/conversation and verify the
 * installed bundle before evaluating this adapter. This is not an auth API.
 * We read initialized cache objects, the local Message.getAll boundary and
 * missing group profiles via native FriendsInfo/Friend.getMultiIfExists,
 * and source reactions via the initialized reaction cache/local database reader.
 * No selection, loader, initializer, receipt, download,
 * storage write or native controller method is called here.
 */
export const NATIVE_CONVERSATION_SOURCE_BUILD = Object.freeze({
  version: "26.9.10",
  sha256: "9cb9e2a9f45461d8e986a10dfad7c0edbe91577b16e2cb451ae6704028632c50",
});

export async function readNativeConversation(options) {
  if (options.version !== "26.9.10" || options.sha256 !== "9cb9e2a9f45461d8e986a10dfad7c0edbe91577b16e2cb451ae6704028632c50")
    throw new Error("CONVERSATION_SOURCE_BUILD_UNSUPPORTED");
  const validId = value => typeof value === "string" && /^\d{1,128}$/.test(value);
  if (!validId(options.expectedAccountId) || !validId(options.threadId) ||
      !/^account-[1-9]\d{0,2}$/.test(options.accountSlot || "") ||
      !["user", "group"].includes(options.threadType))
    throw new Error("CONVERSATION_SOURCE_INPUT_INVALID");
  if (globalThis.location?.protocol !== "file:" || typeof globalThis.$zelectron?.openDevTool !== "function")
    throw new Error("NATIVE_ZALO_REQUIRED");
  const chunks = globalThis.webpackJsonp;
  if (!Array.isArray(chunks) || chunks.push === Array.prototype.push)
    throw new Error("WEBPACK_RUNTIME_UNAVAILABLE");
  let registry;
  const marker = `x3-conversation-source-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record = [[marker], { [marker]: (module, exports, require) => { registry = require; } }, [[marker]]];
  try { chunks.push(record); }
  finally {
    if (registry?.c) delete registry.c[marker];
    if (registry?.m) delete registry.m[marker];
    const index = chunks.indexOf(record);
    if (index >= 0) chunks.splice(index, 1);
  }
  if (!registry?.c) throw new Error("WEBPACK_CACHE_UNAVAILABLE");
  const cached = id => registry.c[id]?.exports;
  const expected = options.expectedAccountId;
  const nativeId = options.threadType === "group" ? `g${options.threadId}` : options.threadId;
  const identity = value => (typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value))) ? String(value) : "";
  const own = (object, key) => {
    if (!object || typeof object !== "object") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  };
  const ensureAccount = () => {
    if (identity(cached("dThN")?.default?.userId) !== expected || identity(cached("fdn9")?.a?.userId) !== expected)
      throw new Error("CONVERSATION_SOURCE_ACCOUNT_MISMATCH");
  };
  const ensureVisible = () => {
    // EFQ6.isThreadHidden calls _initStore(), which may load/write localStorage.
    // Inspect its already initialized store directly and never read its PIN.
    const manager = cached("EFQ6")?.a;
    const store = own(manager, "_store");
    if (!store) {
      if (cached("NDmK")?.default?.enable_hidden_chat !== 0)
        throw new Error("CONVERSATION_SOURCE_HIDDEN_STATE_UNAVAILABLE");
    } else if (identity(own(store, "userId")) !== expected) {
      throw new Error("CONVERSATION_SOURCE_ACCOUNT_MISMATCH");
    }
    if (own(own(store, "_threadsHidden"), nativeId) || own(own(manager, "_threadsHidden"), nativeId))
      throw new Error("CONVERSATION_SOURCE_HIDDEN_THREAD");
  };
  ensureAccount();
  ensureVisible();
  const managers = cached("QPNp")?.a;
  const conversationMap = managers?._convInfoManager?.data;
  const cachedConversation = conversationMap instanceof Map ? conversationMap.get(nativeId) : null;
  // My Documents can exist in the catalog before its first message. The pinned
  // vendor factory is pure; never insert this empty model into a native store.
  const emptyFactory=managers?._convInfoManager?.getEmptyConv;
  const emptySelf=!cachedConversation&&options.threadType==='user'&&nativeId===expected&&conversationMap instanceof Map;
  if(emptySelf&&String(emptyFactory)!=='getEmptyConv(e){return{userId:e,isGroup:e.startsWith(ee.GROUPID_PREFIX),numMsg:0,respondedByMe:!1,pinned:0,label:null,outside:null,infoCheckSearch:null,topOut:null}}')
    throw new Error('CONVERSATION_SOURCE_EMPTY_FACTORY_CHANGED');
  const conversation = cachedConversation || (emptySelf ? emptyFactory.call(managers._convInfoManager,nativeId) : null);
  if (!conversation || identity(own(conversation, "userId")) !== nativeId)
    throw new Error("CONVERSATION_SOURCE_THREAD_NOT_CACHED");
  const collection = cached("fsN4")?.default?.instance?.Core?.Message;
  const bounds = cached("mE25"), direction = cached("wH4e")?.c?.PREV;
  if (typeof collection?.getAll !== "function" || !bounds?.a || !bounds?.b || direction === undefined)
    throw new Error("CONVERSATION_SOURCE_DATABASE_UNAVAILABLE");
  const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 50)));
  let upperTime = String(bounds.b), upperId = String(bounds.a), exclusive = false;
  if (options.cursor != null) {
    if (!/^\d{1,20}$/.test(String(options.cursor?.sendDttm || "")) ||
        !/^[\w.-]{1,128}$/.test(String(options.cursor?.msgId || "")))
      throw new Error("CONVERSATION_SOURCE_CURSOR_INVALID");
    upperTime = String(options.cursor.sendDttm);
    upperId = String(options.cursor.msgId);
    exclusive = true;
  }
  let rows;
  try {
    rows = await collection.getAll({
      from: [nativeId, "", ""], to: [nativeId, upperTime, upperId], excludeFrom: false, excludeTo: exclusive,
    }, { index: "userId_sendDttm_msgId", direction, limit: limit + 1, partition: nativeId, useLGKeyRange: true });
  } catch {
    ensureAccount();
    throw new Error("CONVERSATION_SOURCE_DATABASE_FAILED");
  }
  ensureAccount();
  ensureVisible();
  if (conversationMap.get(nativeId) !== cachedConversation || identity(own(conversation, "userId")) !== nativeId)
    throw new Error("CONVERSATION_SOURCE_THREAD_CHANGED");
  if (!Array.isArray(rows) || rows.length > limit + 1)
    throw new Error("CONVERSATION_SOURCE_DATABASE_RESULT_INVALID");

  // Only data properties are copied: no model getters, methods, toJSON or
  // arbitrary profile fields cross this boundary. Message text is literal.
  const forbidden = /^(?:__proto__|prototype|constructor|uin|userUIN|accountUIN|pin|password|passwd|cookie|cookies|authorization|credential(?:s)?|token|access[_-]?token|refresh[_-]?token|session(?:[_-]?(?:Id|Key|Token))?|secret|key|iv|aes[_-]?key|private[_-]?key|public[_-]?key|decrypt[_-]?key|encrypt[_-]?key|encryption[_-]?key|auth[_-]?(?:Key|Token)|e2ee?session|zpw_sek|zpw_enk)$/i;
  // Native attachment paths belong to the source account's private resolver,
  // not the shared renderer. These fields also occur in nested params/cache
  // metadata; excluding only the top-level Message.localPath is insufficient.
  const privatePath = /^(?:path|localPath|folderPath|autoDownloadPath|cachePath|filePath|imageLocalPath|checkedLocalPath|oriPath|savePath|srcPath|saveDir)$/i;
  let nodes = 0;
  const clean = (value, depth = 0, key = "") => {
    if (++nodes > 100000 || depth > 10) throw new Error("CONVERSATION_SOURCE_PAYLOAD_LIMIT");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") {
      if (value.length > 65536) throw new Error("CONVERSATION_SOURCE_PAYLOAD_LIMIT");
      if (/^\s*(?:https?:\/\/|file:|javascript:|data:|e2ee?:)/i.test(value) && !["message", "text", "title", "description"].includes(key)) {
        try {
          const url = new URL(value);
          let decoded = value;
          try { decoded = decodeURIComponent(value); } catch {}
          // e2esession embeds AES key/IV/tag; its media must use a separate
          // authorized native-cache resolver, never this cross-renderer JSON.
          // Zalo avatar CDN's `key` signs one image URL; it is not an account
          // session or encryption key. Keep it only for these display fields
          // on the pinned avatar/cover hosts, as ephemeral native presentation.
          const signedProfileImage = ["avatar","avatar_120","avatar_240","bgavatar","cover"].includes(key) &&
            /^(?:[a-z0-9-]*ava-talk|cover-talk)\.zadn\.vn$/i.test(url.hostname);
          if (url.protocol !== "https:" || url.username || url.password || /[?&#]e2ee?session(?:=|&|#|$)/i.test(decoded) ||
              [...url.searchParams.keys()].some(name => forbidden.test(name) && !(signedProfileImage && name === "key"))) return undefined;
        } catch { return undefined; }
      }
      // Some native rich messages encode structured metadata as JSON strings.
      // Preserve shape while removing credentials inside that structure too.
      if (["params", "metadata", "extraInfo", "attach"].includes(key) && /^[\[{]/.test(value.trim())) {
        try { return JSON.stringify(clean(JSON.parse(value), depth + 1)); }
        catch (error) { if (error?.message === "CONVERSATION_SOURCE_PAYLOAD_LIMIT") throw error; return undefined; }
      }
      return value;
    }
    if (!value || typeof value !== "object") return undefined;
    if (Array.isArray(value)) {
      if (value.length > 1024) throw new Error("CONVERSATION_SOURCE_PAYLOAD_LIMIT");
      const result = [];
      for (let index = 0; index < value.length; index++) {
        const entry = clean(own(value, String(index)), depth + 1);
        result.push(entry === undefined ? null : entry);
      }
      return result;
    }
    const result = {};
    const keys = Object.keys(value);
    if (keys.length > 256) throw new Error("CONVERSATION_SOURCE_PAYLOAD_LIMIT");
    for (const name of keys) {
      if (forbidden.test(name) || privatePath.test(name)) continue;
      const entry = clean(own(value, name), depth + 1, name);
      if (entry !== undefined) result[name] = entry;
    }
    return result;
  };
  const project = (value, keys) => {
    const result = {};
    for (const key of keys) {
      const entry = clean(own(value, key), 0, key);
      if (entry !== undefined) result[key] = entry;
    }
    return result;
  };
  const conversationFields = ["userId", "displayName", "zaloName", "name", "avatar", "isGroup", "type", "subType", "lastMessageTime", "lastActive", "lastSmsLocalId", "lastMsgId", "lastMsgTime", "creatorId", "groupId", "memberCount", "totalMember", "isBlocked", "isFriend", "isStranger", "isOfficial", "isOA", "isValid", "isActive", "disabled", "status", "members", "groupType", "groupSetting", "ttl", "readOnly"];
  const messageFields = ["msgId", "cliMsgId", "fromUid", "toUid", "msgType", "message", "content", "sendDttm", "ts", "status", "subState", "subType", "type", "src", "quote", "quoteMsg", "quoteType", "quoteInfo", "mentions", "mentionInfo", "styles", "style", "reacts", "reactions", "attach", "attachments", "params", "paramsExt", "propertyExt", "properties", "ext", "e2eeStatus", "urgency", "ttl", "noTTL", "expireTime", "isGroup", "isForward", "forwardInfo", "recall", "recalled", "isDeleted", "deleteTime", "isEdited", "editTime", "revision", "fileSize", "fileName", "fileType", "fileUrl", "url", "href", "thumb", "thumbUrl", "oriUrl", "width", "height", "duration", "isGif", "action", "actions", "description", "title", "phoneBook", "media", "reference", "refMessage", "isNotify", "notify", "isBubble", "isSystem", "extra", "stickerId", "cateId", "clientTime", "serverTime", "act", "eventInfo", "updateMemberIds", "msgText", "actionText", "textArguments"];
  const profileFields = ["userId", "displayName", "zaloName", "dName", "name", "avatar", "avatar_120", "avatar_240", "bgavatar", "cover", "isGroup", "groupId", "type", "subType", "isFriend", "isFr", "isBlocked", "isOfficial", "isOA", "isValid", "isActive", "memberCount", "totalMember", "creatorId", "setting", "topMember", "groupType"];
  const validMessage = row => row && identity(own(row, "toUid")) === nativeId &&
    // Native local group events also use dotted IDs, e.g. .timestamp_001.
    /^[\w.-]{1,128}$/.test(identity(own(row, "msgId"))) && /^\d{1,20}$/.test(identity(own(row, "sendDttm"))) &&
    (validId(identity(own(row, "fromUid"))) || own(row, "fromUid") === null) &&
    (typeof own(row, "msgType") === "number" || typeof own(row, "msgType") === "string");
  const compareInteger = (left, right) => {
    const a = String(left).replace(/^0+(?=\d)/, ""), b = String(right).replace(/^0+(?=\d)/, "");
    return a.length - b.length || a.localeCompare(b);
  };
  const compareMessages = (a, b) => compareInteger(own(a, "sendDttm"), own(b, "sendDttm")) || compareInteger(own(a, "msgId"), own(b, "msgId"));
  const byId = new Map();
  let skipped = 0, cacheMessages = 0;
  for (const row of rows) {
    if (validMessage(row)) byId.set(identity(own(row, "msgId")), row);
    else skipped++;
  }
  // Read the initialized cache without LRU .get(), active setters or loaders.
  const cacheMap = cached("MPLC")?.b?.messageCache?._cache?._map;
  const cacheOwner = cached("MPLC")?.b?.userId;
  if (!exclusive && cacheMap instanceof Map && identity(cacheOwner) === expected) {
    const messages = own(cacheMap.get(nativeId), "_messages");
    if (Array.isArray(messages)) {
      if (messages.length > 10000) throw new Error("CONVERSATION_SOURCE_CACHE_LIMIT");
      for (const row of messages) {
        if (validMessage(row)) { byId.set(identity(own(row, "msgId")), row); cacheMessages++; }
      }
    }
  }
  const sorted = [...byId.values()].sort((a, b) => compareMessages(b, a));
  const selected = sorted.slice(0, limit);
  let boundaryScanned = 0, albumBoundaryAdded = 0;
  if (options.completeAlbums === true && selected.length === limit) {
    const edge = selected[selected.length-1];
    const album = row => {
      if (![2,18].includes(Number(own(row,'msgType')))) return null;
      try {
        const p=JSON.parse(own(own(row,'message'),'params'));
        return p?.is_group_layout===1 && /^\d{1,32}$/.test(String(p.group_layout_id)) &&
          Number.isSafeInteger(p.total_item_in_group) && p.total_item_in_group>=2 && p.total_item_in_group<=100 ? p : null;
      } catch {return null;}
    };
    const meta=album(edge);
    const same = row => {const p=album(row);return p && String(p.group_layout_id)===String(meta?.group_layout_id) &&
      p.total_item_in_group===meta?.total_item_in_group && own(row,'fromUid')===own(edge,'fromUid') && own(row,'toUid')===nativeId;};
    const missing=meta ? meta.total_item_in_group-selected.filter(same).length : 0;
    if (missing>0 && missing<100) {
      // The initial limit is a page boundary, not an album boundary. Read only
      // enough older rows to complete that one album, still in this source DB.
      const older=await collection.getAll({from:[nativeId,'',''],to:[nativeId,String(own(edge,'sendDttm')),String(own(edge,'msgId'))],excludeFrom:false,excludeTo:true},
        {index:'userId_sendDttm_msgId',direction,limit:missing+1,partition:nativeId,useLGKeyRange:true});
      ensureAccount();ensureVisible();
      if (conversationMap.get(nativeId)!==cachedConversation || !Array.isArray(older) || older.length>missing+1)
        throw Error('CONVERSATION_SOURCE_DATABASE_RESULT_INVALID');
      boundaryScanned=older.length;
      const seen=new Set(selected.map(row=>identity(own(row,'msgId'))));
      for (const row of older) {
        if (!validMessage(row)) {skipped++;break;}
        if (!same(row) || compareMessages(row,edge)>=0 || seen.has(identity(own(row,'msgId'))) || albumBoundaryAdded===missing) break;
        selected.push(row);seen.add(identity(own(row,'msgId')));albumBoundaryAdded++;
      }
      selected.sort((a,b)=>compareMessages(b,a));
    }
  }
  const messages = selected.slice().reverse().map(row => project(row, messageFields));
  // Reactions live in a separate native cache/DB. Never read the UI host's
  // reaction store for a projected chat from a different account.
  const reactionCache=cached('ofhN')?.b;
  if(identity(reactionCache?.userId)===expected&&typeof reactionCache.getMessageReactions==='function'){
    try{
      const reactions=await reactionCache.getMessageReactions(messages.map(row=>String(row.msgId)));
      ensureAccount();ensureVisible();
      for(const row of messages){const react=reactions?.[String(row.msgId)];
        if(react&&String(react.idTo)===nativeId&&String(react.rMsgId)===String(row.msgId)&&String(react.rClientMsgId)===String(row.cliMsgId))row.reacts=clean(react);
      }
    }catch{ensureAccount();ensureVisible();}
  }
  const friends = cached("JWY6")?.a;
  const groups = cached("8apa")?.a;
  const localProfiles = new Map();
  const profile = id => {
    const cachedProfile=own(friends?._cacheProfileInfo, id) || own(groups?._cacheGroupInfo, id);
    const cachedFields = project(cachedProfile, profileFields), localFields = project(localProfiles.get(id), profileFields);
    const result = {...localFields, ...cachedFields};
    // A lightweight cache entry can have a name but no avatar/cover. Fill each
    // missing display field from this account's DB without replacing its alias
    // or writing a foreign profile into any native store.
    for (const name of profileFields) if ((result[name] == null || result[name] === "") && localFields[name] != null) result[name] = localFields[name];
    result.userId = id;
    const alias = own(friends?._aliasName, id), phonebook = own(friends?._phonebookName, id);
    const name = (typeof alias === "string" && alias) || (typeof phonebook === "string" && phonebook) ||
      [result.displayName, result.dName, result.zaloName, result.name].find(value => typeof value === "string" && value) || null;
    if (name) result.displayName = clean(name);
    return result;
  };
  const profileIds = new Set([nativeId]);
  for (const row of messages) if (validId(identity(row.fromUid)) && row.fromUid !== "0" && identity(row.fromUid) !== expected) profileIds.add(identity(row.fromUid));
  // Native JWY6.getMiniInfo also falls back to DiYL/ej3F's mini-profile
  // cache. Read initialized entries directly: its public getter can migrate
  // localStorage and flush the database, which an observer must not trigger.
  const miniOwner=cached('DiYL')?.a, storage=cached('igA5')?.default?.instance;
  const prefix=own(storage,'userScopedPrefix'),miniCache=own(cached('ej3F')?.b,'_memCache');
  if(identity(own(miniOwner,'userId'))===expected && typeof prefix==='string' && prefix.length>0 && prefix.length<256){
    for(const id of [...profileIds,expected]){
      const raw=own(miniCache,`${prefix}_${id}`);
      if(typeof raw!=='string'||raw.length>16384)continue;
      let value;try{value=JSON.parse(raw);}catch{continue;}
      if(!value||typeof value!=='object'||Array.isArray(value))continue;
      const safe=project(value,profileFields);
      if(!safe.displayName)safe.displayName=clean(own(value,'dName')||own(value,'zName'));
      localProfiles.set(id,{...safe,userId:id});
    }
  }
  const topMembers=own(own(groups?._cacheGroupInfo,nativeId),'topMember');
  if(Array.isArray(topMembers))for(const member of topMembers.slice(0,1000)){
    const id=identity(own(member,'id')||own(member,'userId'));
    if(!profileIds.has(id))continue;
    const prior=localProfiles.get(id)||{},next=project(member,profileFields);
    for(const name of profileFields)if(prior[name]==null||prior[name]==='')prior[name]=next[name];
    localProfiles.set(id,{...prior,userId:id});
  }
  // Background contexts load friends at startup, but group participants can
  // remain only in FriendsInfo. Use the same native DB read as +wp8/JWY6,
  // without its cache writes, profile fetches or active-conversation loaders.
  const missing = [...profileIds, expected].filter(id => {
    if (!validId(id)) return false;
    const value = profile(id);
    return !value.displayName || !value.avatar || (options.threadType === 'user' && id === nativeId && !value.cover);
  });
  if (missing.length) {
    const core = cached("fsN4")?.default?.instance?.Core;
    for (const collection of [core?.FriendsInfo, core?.Friend]) {
      if (typeof collection?.getMultiIfExists !== "function") continue;
      let records;
      try { records = await collection.getMultiIfExists(missing); }
      catch { throw new Error("CONVERSATION_SOURCE_PROFILE_DATABASE_FAILED"); }
      ensureAccount(); ensureVisible();
      if (!Array.isArray(records) || records.length > missing.length) throw new Error("CONVERSATION_SOURCE_PROFILE_DATABASE_INVALID");
      for (const record of records) {
        const id = identity(own(record, "userId"));
        if (missing.includes(id)) {
          const next = project(record, profileFields), prior = localProfiles.get(id) || {};
          for (const name of profileFields) if (prior[name] == null || prior[name] === "") prior[name] = next[name];
          localProfiles.set(id, prior);
        }
      }
    }
  }
  // A participant may have left the group and have no retained local profile.
  // Keep the conversation and all messages readable with an explicit unknown
  // name; never borrow that identity's profile from the host account.
  if(options.threadType==='group')for(const id of profileIds){
    if(validId(id)&&!profile(id).displayName)localProfiles.set(id,{...localProfiles.get(id),userId:id,displayName:'Thành viên chưa có tên'});
  }
  // Group cards reference records outside Message. Read only the source DB;
  // never ask the host account's poll/reminder managers for foreign records.
  if (options.threadType === 'group') {
    const core = cached('fsN4')?.default?.instance?.Core;
    for (const row of messages) {
      let record, kind, reference;
      try {
        if (Number(row.msgType) === 26) {
          reference = JSON.parse(row.message?.params || '{}').pollId;
          if (Number.isSafeInteger(reference) && reference > 0 && typeof core?.Poll?.get === 'function') {
            record = await core.Poll.get(reference); kind = 'poll';
            if (record && (String(record.group_id) !== options.threadId || Number(record.poll_id) !== reference)) record = null;
          }
        } else if (Number(row.msgType) === 25) {
          const actions = row.message?.params?.actions;
          if (actions?.length === 1 && actions[0].actionId === 'action.open.reminder') {
            const envelope = JSON.parse(actions[0].data), data = JSON.parse(envelope.data);
            reference = data.topicId;
            if (validId(reference) && typeof core?.Topic?.get === 'function') {
              record = await core.Topic.get([options.threadId, reference]); kind = 'reminder';
              if (record && (String(record.groupId) !== options.threadId || String(record.id) !== reference)) record = null;
            }
          }
        }
      } catch { /* The original notification remains readable if detail is absent. */ }
      ensureAccount(); ensureVisible();
      if (record) row.sourceBoard = { kind, sourceAccountId: expected, conversationId: nativeId, reference: String(reference), data: clean(record) };
    }
  }
  const oldest = selected[selected.length - 1];
  const lastScanned = rows[rows.length - 1];
  const cursorRow = oldest || lastScanned;
  const more = rows.length > limit || sorted.length > limit;
  const result = {
    schemaVersion: 1, version: options.version, accountSlot: options.accountSlot,
    sourceAccountId: expected, threadId: options.threadId, threadType: options.threadType,
    nativeConversationId: nativeId, conversation: project(conversation, conversationFields),
    ownProfile: profile(expected), profiles: [...profileIds].map(profile), messages,
    nextCursor: more && cursorRow && /^\d{1,20}$/.test(identity(own(cursorRow, "sendDttm"))) && /^[\w.-]{1,128}$/.test(identity(own(cursorRow, "msgId")))
      ? { sendDttm: identity(own(cursorRow, "sendDttm")), msgId: identity(own(cursorRow, "msgId")) } : null,
    coverage: { source: "native-local-db-and-cache", nativeModels: true, unsupportedFieldsDropped: true,
      hiddenConversations: false, scanned: rows.length + boundaryScanned, skipped, cacheMessages, albumBoundaryAdded },
  };
  ensureAccount();
  ensureVisible();
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 2 * 1024 * 1024)
    throw new Error("CONVERSATION_SOURCE_PAYLOAD_LIMIT");
  return result;
}

export function nativeConversationSourceExpression(options) {
  const allowed = {
    version: options.version, sha256: options.sha256, expectedAccountId: options.expectedAccountId,
    accountSlot: options.accountSlot, threadId: options.threadId, threadType: options.threadType,
    limit: options.limit, cursor: options.cursor == null ? null : { sendDttm: options.cursor.sendDttm, msgId: options.cursor.msgId },
    completeAlbums: options.completeAlbums === true,
  };
  return `(${readNativeConversation.toString()})(${JSON.stringify(allowed)})`;
}
