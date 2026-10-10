import { normalizeMessage } from '../web/messages.mjs';

// Executed in the verified, already logged-in PC renderer. Read cached identity
// and type constants only; never initialize a store or change the active chat.
export function pcDescriptor() {
  if (location.protocol !== 'file:' || typeof globalThis.$zelectron?.openDevTool !== 'function') throw Error('PC_RENDERER_REQUIRED');
  let r;
  const key = 'team-pc-import-' + Date.now();
  const chunk = [[key], { [key]: (m, e, q) => { r = q; } }, [[key]]];
  if (!Array.isArray(globalThis.webpackJsonp)) throw Error('PC_NOT_READY');
  try { webpackJsonp.push(chunk); }
  finally {
    if (r) { delete r.c[key]; delete r.m[key]; }
    const index = webpackJsonp.indexOf(chunk); if (index >= 0) webpackJsonp.splice(index, 1);
  }
  const cached = id => r?.c[id]?.exports;
  const accountId = String(cached('dThN')?.default?.userId || '');
  if (!/^\d+$/.test(accountId) || accountId !== String(cached('fdn9')?.a?.userId)) throw Error('PC_IDENTITY_NOT_READY');
  const constants = Object.entries(cached('1pet') || {}).filter(([k, v]) => /^MSG_/.test(k) && typeof v === 'number');
  if (!constants.length) throw Error('PC_TYPES_NOT_READY');
  return { accountId, constants };
}

export function projectPcPage(snapshot, descriptor) {
  if (snapshot.sourceAccountId !== descriptor.accountId) throw Error('PC_ACCOUNT_CHANGED');
  // MSG_SUBTYPE_* and MSG_BUBBLE_LAYOUT_* reuse message-kind numbers.
  // Match the Web adapter's explicit kind allowlist, never every MSG_* constant.
  const typeNames = new Set(['MSG_TEXT','MSG_PHOTO','MSG_PHOTO_2','MSG_POLL','MSG_STICKER','MSG_STICKER_2','MSG_STICKER_GROUP',
    'MSG_VIDEO','MSG_GIF','MSG_VOICE','MSG_FILE','MSG_CONTACT','MSG_LINK_CLIENT','MSG_ARTICLE','MSG_UNDO','MSG_DEL_EVERYONE',
    'MSG_INFO','MSG_INFO_CHAT','MSG_GROUP_NOTI','MSG_LOCATION','MSG_TODO','MSG_OA','MSG_E2EE_DECRYPT_FAILED','MSG_E2EE_PENDING_DATA','MSG_SYNCING','MSG_SYNCING_OUT_OF_RANGE']);
  const labels = new Map(descriptor.constants.filter(([name]) => typeNames.has(name)).map(([name, value]) => [value, name]));
  const profiles = new Map([snapshot.ownProfile, ...snapshot.profiles].map(p => [p.userId, p]));
  return snapshot.messages.map(row => {
    if (!/^[\w.:-]{1,200}$/.test(String(row.msgId)) || !Number.isSafeInteger(Number(row.sendDttm)) || Number(row.sendDttm) < 1e12) throw Error('PC_MESSAGE_IDENTITY_INVALID');
    const senderId = String(row.fromUid) === '0' ? descriptor.accountId : String(row.fromUid ?? '');
    const sender = profiles.get(senderId);
    const react = row.reacts || {};
    const message = normalizeMessage({
      id: String(row.msgId), clientId: String(row.cliMsgId || ''), time: Number(row.sendDttm),
      type: labels.get(Number(row.msgType)) || `PC_${row.msgType}`, message: row.message,
      mine: senderId === descriptor.accountId,
      sender: { id: senderId, name: sender?.displayName || sender?.dName || row.dName || 'Người dùng Zalo', avatarSrc: sender?.avatar },
      quote: row.quote, mentions: row.mentions,
      mentionNames: Object.fromEntries([...profiles].map(([id, p]) => [id, p.displayName || p.dName || ''])),
      reactions: react.reactions, currentReaction: react.currentIcon, lastReaction: react.lastReactIcon,
      lastReactionMine: ['0', descriptor.accountId].includes(String(react.lastSender)),
      reactionUsers: Object.fromEntries([...profiles].map(([id, p]) => [id, { id, name: p.displayName || p.dName || '', mine: id === descriptor.accountId }])),
    });
    // The Web normalizer labels an unavailable media URL as unsupported. Keep
    // the attachment so a locally cached file can still be attached by importer.
    if (message.attachments.length && message.kind === 'unsupported') {
      message.kind = 'media'; message.text = '';
    }
    return { ...message, canRecall: false, archived: true, archiveOrigin: 'pc', archiveProjection: 2 };
  });
}

// Read-only native locators for the current PC path layout. Paths stay in the
// local exporter; only copied bytes and hashes enter the import package.
export async function pcMediaPaths(options) {
  let r;
  const key = 'team-pc-media-' + Date.now(), chunk = [[key], { [key]: (m, e, q) => { r = q; } }, [[key]]];
  try { webpackJsonp.push(chunk); }
  finally { if (r) { delete r.c[key]; delete r.m[key]; } const i = webpackJsonp.indexOf(chunk); if (i >= 0) webpackJsonp.splice(i, 1); }
  const get = id => r?.c[id]?.exports;
  const verify = () => { if (String(get('dThN')?.default?.userId) !== options.accountId || String(get('fdn9')?.a?.userId) !== options.accountId) throw Error('PC_ACCOUNT_CHANGED'); };
  verify();
  const id = options.conversationId, before = options.cursor;
  const rows = await get('fsN4').default.instance.Core.Message.getAll({ from: [id, '', ''],
    to: [id, before?.sendDttm || String(get('mE25').b), before?.msgId || String(get('mE25').a)], excludeFrom: false, excludeTo: !!before },
    { index: 'userId_sendDttm_msgId', direction: get('wH4e').c.PREV, limit: 100, partition: id, useLGKeyRange: true });
  verify();
  const allowed = new Set(options.messageIds), out = [];
  for (const m of rows) {
    if (String(m.toUid) !== id || !allowed.has(String(m.msgId))) continue;
    let found = [];
    if ([get('1pet').MSG_PHOTO,get('1pet').MSG_PHOTO_2,get('1pet').MSG_GIF].includes(m.msgType)) found = get('/8xV')?.a?.getPathsByMessageIfExistSync(options.accountId, m) || [];
    if (m.msgType === get('1pet').MSG_FILE) found = get('gKzZ')?.a?.getPathsByMessageIfExistSync(options.accountId, m) || [];
    if (m.msgType === get('1pet').MSG_VIDEO) found = get('MHb6')?.a?.getPathsByMessageIfExistSync(options.accountId, m) || [];
    if (m.msgType === get('1pet').MSG_VOICE) found = get('dXpj')?.a?.getPathsByMessageIfExistSync(options.accountId, m) || [];
    // Also inspect the message-bound download store used by native file cards.
    // Outside-root candidates are still evidence that a source exists, even
    // though the copier may refuse them. Never classify that as missing.
    const document = m.msgType === get('1pet').MSG_FILE;
    const cache = get('t77n')?.a, disk = get('C64z');
    if (document && cache?.getFileKey && cache?.get && disk?.fileExistsSyncV2) {
      const info = cache.get(cache.getFileKey(String(m.msgId)))?.extraInfo;
      for (const p of [info?.localPath, info?.autoDownloadPath, ...(['0',options.accountId].includes(String(m.fromUid)) ? [m.localPath] : [])]) {
        if (typeof p === 'string' && disk.fileExistsSyncV2(p)) found.push({type:'file',path:p});
      }
    }
    const main = found.find(p => ['oriPhoto', 'file', 'video', 'voice'].includes(p.type));
    const preview = found.find(p => p.type === 'genPhoto' && /_n$/.test(p.path)) || found.find(p => ['photoThumb', 'fileThumb', 'videoThumb'].includes(p.type));
    for (const [field, p] of [['url', main], ['preview', preview]]) {
      if (p?.path) out.push({ messageId: String(m.msgId), slot: `attachments.0.${field}`, path: p.path });
    }
    // PC stores downloaded documents in fileNoise even when the original URL
    // has expired. This is a local file envelope, not an ordinary document.
    // Pass it only to the installed native decoder; never archive raw bytes.
    if (m.msgType === get('1pet').MSG_FILE) {
      let params = m.message?.params;
      try { if (typeof params === 'string') params = JSON.parse(params); } catch { params = null; }
      const checksum = params?.checksum;
      if (typeof checksum === 'string' && checksum.length > 0 && checksum.length <= 256) {
        for (const p of found.filter(p => p.type === 'fileNoise' && p.path)) {
          out.push({ messageId: String(m.msgId), slot: 'attachments.0.url', path: p.path, encoding: 'pc-file-noise', checksum });
        }
      }
    }
    if (options.reportMissing) {
      // Only documents currently have the complete audited locator chain.
      // Other types remain unverified rather than being offered for cleanup.
      const complete = document && !!get('gKzZ')?.a?.getPathsByMessageIfExistSync && !!cache?.getFileKey && !!cache?.get && !!disk?.fileExistsSyncV2;
      for (const field of ['url','preview']) {
        const present = field === 'url' ? found.some(p => ['file','fileNoise'].includes(p.type) && p.path) : !!preview?.path;
        out.push({messageId:String(m.msgId),slot:`attachments.0.${field}`,sourceState:present ? 'found' : complete ? 'missing' : 'unverified'});
      }
    }
  }
  verify(); return out;
}

export async function pcDecodeFile(options) {
  let r;
  const key = 'team-pc-decode-' + Date.now(), chunk = [[key], { [key]: (m, e, q) => { r = q; } }, [[key]]];
  try { webpackJsonp.push(chunk); }
  finally { if (r) { delete r.c[key]; delete r.m[key]; } const i = webpackJsonp.indexOf(chunk); if (i >= 0) webpackJsonp.splice(i, 1); }
  const verify = () => {
    if (String(r?.c.dThN?.exports.default?.userId) !== options.accountId || String(r?.c.fdn9?.exports.a?.userId) !== options.accountId) throw Error('PC_ACCOUNT_CHANGED');
  };
  verify();
  if (typeof globalThis.$zcloud?.denoiseFile !== 'function') throw Error('PC_FILE_DECODER_UNAVAILABLE');
  await $zcloud.denoiseFile({ src: options.src, dest: options.dest, checksum: options.checksum });
  verify();
  return true;
}
