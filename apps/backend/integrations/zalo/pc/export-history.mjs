import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { inspectInstallation, DEFAULT_INSTALLATION } from '../shared/asar.mjs';
import { listTargets, CdpConnection } from '../shared/cdp.mjs';
import { catalogExpression } from '../shared/catalog.mjs';
import { nativeConversationSourceExpression } from '../shared/native-conversation-source.mjs';
import { pcDescriptor, projectPcPage, pcMediaPaths, pcDecodeFile } from './archive-reader.mjs';
import { copyPcAsset } from './local-assets.mjs';
import { validateIndex, planMessage } from './incremental.mjs';
import { enrichPcStickers } from './sticker-sources.mjs';

const args = process.argv.slice(2), action = args.shift();
function option(name, fallback) { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; }
async function sha(file) { const h = createHash('sha256'); for await (const b of createReadStream(file)) h.update(b); return h.digest('hex'); }
const build = inspectInstallation(option('install', DEFAULT_INSTALLATION));
if (action === 'inspect') { console.log(JSON.stringify({ version: build.version, supported: true })); process.exit(0); }
const endpoint = option('endpoint', 'http://127.0.0.1:9333');
const expected = option('account');
const thread = option('conversation');
const targets = (await listTargets(endpoint)).filter(t => /^file:/.test(t.url) && /\/pc-dist\/(?:index|main)\.html(?:[?#]|$)/.test(t.url));
if (targets.length !== 1) throw Error('PC_MAIN_WINDOW_NOT_FOUND');
const cdp = await new CdpConnection(targets[0].webSocketDebuggerUrl).connect();
try {
  const descriptor = await cdp.evaluate(`(${pcDescriptor.toString()})()`);
  if (expected && expected !== descriptor.accountId) throw Error('PC_ACCOUNT_MISMATCH');
  if (action === 'list') {
    const catalog = await cdp.evaluate(catalogExpression({ version: build.version, expectedAccountId: descriptor.accountId, operation: 'snapshot', limit: 20000 }));
    console.log(JSON.stringify({ accountId: descriptor.accountId, accountName: catalog.account?.displayName,
      conversations: catalog.conversations.map(c => ({ conversationId: (c.threadType === 'group' ? 'g' : '') + c.threadId, name: c.title })), coverage: catalog.coverage }));
  } else if (action === 'export') {
    if (!expected || !/^g?\d{1,30}$/.test(thread || '') || !option('out')) throw Error('ACCOUNT_CONVERSATION_OUT_REQUIRED');
    let index = null;
    if (option('index')) {
      const file = option('index');
      if ((await fs.stat(file)).size > 64 * 1024 * 1024) throw Error('PC_INDEX_TOO_LARGE');
      index = validateIndex(JSON.parse(await fs.readFile(file, 'utf8')), expected, thread);
    }
    const out = path.resolve(option('out'));
    // Never merge an incomplete export with a different source or overwrite one.
    await fs.mkdir(out, { recursive: false });
    await fs.mkdir(path.join(out, 'blobs'));
    const mediaRoot = option('media-root') ? await fs.realpath(option('media-root')) : null;
    const messagesFile = path.join(out, 'messages.jsonl');
    const handle = await fs.open(messagesFile, 'wx');
    const spec = { ...build, expectedAccountId: expected, accountSlot: 'account-1', threadType: thread.startsWith('g') ? 'group' : 'user', threadId: thread.replace(/^g/, ''), limit: 100 };
    let cursor = null, pages = 0, total = 0, scanned = 0, unchanged = 0, reusedFiles = 0, oldest = null, newest = null, name = '', skipped = 0;
    const assets = [], mediaChecks = [], seen = new Set(), cursors = new Set(), stickerSources = new Map();
    const localMedia = { candidates: 0, copied: 0, rejected: {} };
    const maxPages = Math.min(10000, Math.max(1, Number(option('max-pages', 1000))));
    try {
      do {
        const snapshot = await cdp.evaluate(nativeConversationSourceExpression({ ...spec, cursor }), 60000);
        const pageMessages = projectPcPage(snapshot, descriptor).filter(m => {
          if (seen.has(m.id)) return false;
          seen.add(m.id); return true;
        });
        scanned += pageMessages.length;
        const plans = new Map(pageMessages.map(m => [m.id, planMessage(m, index)]));
        const messages = pageMessages.filter(m => plans.get(m.id).emit);
        await enrichPcStickers(cdp, snapshot, descriptor, messages, stickerSources);
        unchanged += pageMessages.filter(m => !index?.recoveryIds || index.recoveryIds.includes(m.id)).length - messages.length;
        reusedFiles += pageMessages.reduce((count, m) => count + plans.get(m.id).readySlots.length, 0);
        name ||= snapshot.conversation.displayName || snapshot.profiles.find(p => p.userId === thread)?.displayName || thread;
        skipped += snapshot.coverage.skipped;
        if (mediaRoot && messages.some(m => m.attachments.length)) {
          const local = await cdp.evaluate(`(${pcMediaPaths.toString()})(${JSON.stringify({ accountId: expected, conversationId: thread, cursor, reportMissing: true, messageIds: messages.filter(m => m.attachments.length === 1).map(m => m.id) })})`, 60000);
          for (const row of local) {
            if (row.sourceState) { mediaChecks.push(row); continue; }
            const message = messages.find(m => m.id === row.messageId);
            if (!message || message.attachments.length !== 1) continue;
            if (plans.get(message.id).readySlots.includes(row.slot)) continue;
            if (assets.some(a => a.messageId === row.messageId && a.slot === row.slot)) continue;
            const candidate = row.path;
            if (!candidate) continue;
            localMedia.candidates++;
            try {
              assets.push(await copyPcAsset({ row, attachment: message.attachments[0], mediaRoot, out,
                decode: options => cdp.evaluate(`(${pcDecodeFile.toString()})(${JSON.stringify({ ...options, accountId: expected })})`, 60000) }));
              localMedia.copied++;
            } catch (error) {
              if (/PC_ACCOUNT_CHANGED|PC_FILE_DECODER_UNAVAILABLE/.test(error.message)) throw error;
              const reason = ['PC_ASSET_OUTSIDE_ROOT', 'PC_ASSET_SIZE', 'PC_ASSET_ENCODING', 'PC_ASSET_SIZE_MISMATCH', 'PC_FILE_CHANGED'].includes(error.message)
                ? error.message : ['ENOENT', 'EACCES', 'EPERM'].includes(error.code) ? error.code : 'PC_ASSET_READ_FAILED';
              localMedia.rejected[reason] = (localMedia.rejected[reason] || 0) + 1;
              // Missing/changing cache remains unresolved; never label it saved.
            }
          }
        }
        for (const message of messages) {
          total++;
          oldest = Math.min(oldest ?? message.time, message.time); newest = Math.max(newest ?? message.time, message.time);
          await handle.write(JSON.stringify(message) + '\n');
        }
        pages++; cursor = snapshot.nextCursor;
        if (cursor) {
          const key = JSON.stringify(cursor); if (cursors.has(key)) throw Error('PC_CURSOR_STALLED'); cursors.add(key);
        }
        await fs.writeFile(path.join(out, 'progress.json'), JSON.stringify({ pages, total, scanned, unchanged, reusedFiles, oldest, newest, cursor, skipped, state: cursor ? 'reading' : 'read' }));
        console.log(JSON.stringify({ pages, total, scanned, unchanged, reusedFiles, mode: index?.recoveryIds ? 'recover-files' : index ? 'reconcile-missing' : 'full-reconcile', oldest, files: assets.length, hasMore: !!cursor }));
      } while (cursor && pages < maxPages);
    } finally { await handle.close(); }
    if (cursor) throw Error('PC_PAGE_LIMIT_REACHED_EXPORT_INCOMPLETE');
    const manifest = { format: 'zalo-team-pc/1', version: build.version, accountId: expected, conversationId: thread, name,
      capturedAt: new Date().toISOString(), messages: { count: total, sha256: await sha(messagesFile), oldest, newest }, assets,
      coverage: { source: 'pc-local', skipped, complete: skipped === 0, mode: index?.recoveryIds ? 'recover-files' : index ? 'reconcile-missing' : 'full-reconcile', scanned, unchanged, reusedFiles, localMedia, mediaChecks } };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ state: 'exported', path: out, messages: total, assets: assets.length, skipped }));
  } else throw Error('USE_LIST_OR_EXPORT');
} finally { cdp.close(); }
