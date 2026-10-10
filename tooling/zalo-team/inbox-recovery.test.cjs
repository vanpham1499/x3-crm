const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = path.resolve(__dirname, '../../apps/frontend/src', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] || (name.startsWith('.') ? load(path.join(path.dirname(relative),name+'.ts'),mocks) : require(name)), module, module.exports);
  return module.exports;
}
const { inboxNotice, inboxRetryDelay } = load('features/zalo-team/inbox-notice.ts');
const healthy = { listError: '', liveDisconnected: false, archiveError: '', tagsError: '', unavailable: [], hasRows: false };
test('a shared outage produces one clear diagnosis while keeping all failures available', () => {
  const notice = inboxNotice({ ...healthy, listError: 'Không tải được', liveDisconnected: true, archiveError: 'Mất kết nối', tagsError: 'Mất kết nối', unavailable: ['Tài khoản mẫu'] });
  assert.equal(notice.title, 'Chưa kết nối được Zalo Team');
  assert.equal(notice.details.length, 5);
  assert.equal(notice.showAccounts, false);
  assert.equal(inboxNotice(healthy), null);
});
test('an expired CRM session is not masked by follow-on stream and archive failures', () => {
  const notice = inboxNotice({ ...healthy, listError: 'Bạn cần đăng nhập CRM để xem danh sách.', liveDisconnected: true, archiveError: 'Lỗi', unavailable: ['Tài khoản mẫu'] });
  assert.equal(notice.title, 'Phiên CRM cần đăng nhập lại');
  assert.equal(notice.showAccounts, false);
});
test('individual failures retain the correct action and explain that loaded chats remain available', () => {
  assert.equal(inboxNotice({ ...healthy, tagsError: 'Lỗi' }).title, 'Chưa cập nhật được phân loại');
  assert.equal(inboxNotice({ ...healthy, unavailable: ['Mẫu'] }).showAccounts, true);
  assert.match(inboxNotice({ ...healthy, archiveError: 'Lỗi', hasRows: true }).description, /vẫn được giữ/);
  assert.equal(inboxNotice({ ...healthy, searchError: 'Lỗi' }).title, 'Kết quả tìm kiếm chưa đầy đủ');
});

test('authenticated inbox failures do not tell the user to relink the account', () => {
  const failed = inboxNotice({ ...healthy, listUnavailable: ['New account'] });
  assert.equal(failed.title, 'Chưa tải được danh sách trò chuyện');
  assert.equal(failed.showAccounts, false);
  assert.match(failed.description, /đã kết nối/);
  const preparing = inboxNotice({ ...healthy, preparing: ['New account'] });
  assert.equal(preparing.title, 'Một tài khoản đang chờ dữ liệu');
  assert.equal(preparing.showAccounts, false);
  assert.equal(inboxNotice({ ...healthy, preparing: ['New'], unavailable: ['Expired'] }).showAccounts, true);
});

test('cold inbox retries use capped backoff and stop on recovery or identity/protocol failure', () => {
  const pending = [{ state: 'connected', error: 'WEB_CONVERSATIONS_NOT_READY' }];
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => inboxRetryDelay(pending, i)), [2000, 4000, 8000, 15000, 30000, 30000, 30000]);
  assert.equal(inboxRetryDelay([{ state: 'connecting', error: null }], 0), 2000);
  assert.equal(inboxRetryDelay([{ state: 'connected', error: null }], 1), null);
  for (const error of ['WEB_IDENTITY_MISMATCH', 'WEB_CONVERSATIONS_ADAPTER_CHANGED'])
    assert.equal(inboxRetryDelay([{ state: 'connected', error }], 0), null);
  assert.equal(inboxRetryDelay([{ state: 'expired', error: null }], 0), null);
  assert.equal(inboxRetryDelay([], 0), null);
});
test('retry replaces the shared read stream, ignores late failures and preserves subscribers', async () => {
  const original = global.fetch;
  const calls = [], received = [[], []];
  const flush = () => new Promise(resolve => setImmediate(resolve));
  global.fetch = (_, options) => new Promise(resolve => calls.push({ options, resolve }));
  const live = load('features/zalo-team/live.ts', { './request': { teamFetch: (...args) => fetch(...args), teamApiPolicy: {eventBatch: 5} } });
  const off1 = live.subscribeChanges(event => received[0].push(event));
  const off2 = live.subscribeChanges(event => received[1].push(event));
  try {
    assert.equal(calls.length, 1);
    live.reconnectChanges();
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.signal.aborted, true);
    calls[0].resolve(Response.json({ error: 'late error' }, { status: 503 }));
    await flush();
    assert.equal(received[0].length, 0);
    let stream;
    calls[1].resolve(new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { 'Content-Type': 'application/x-ndjson' } }));
    stream.enqueue(new TextEncoder().encode('{"resync":true}\n'));
    await flush();
    assert.deepEqual(received, [[], []]); // Initial handshake is not a data change.
    off1();
    assert.equal(calls[1].options.signal.aborted, false);
    stream.enqueue(new TextEncoder().encode('{"revision":2}\n'));
    await new Promise(r => setTimeout(r, 15));
    assert.equal(received[0].length, 0);
    assert.equal(received[1].length, 1);
    off2();
    assert.equal(calls[1].options.signal.aborted, true);
    stream.close();
    await flush();
    live.reconnectChanges();
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => JSON.parse(call.options.body).action === 'events'));
  } finally { off1(); off2(); global.fetch = original; }
});
test('tag reads report connectivity; uncertain writes keep their safety warning and are not replayed', async () => {
  const original = global.fetch;
  let attempts = 0;
  global.fetch = async () => { attempts++; throw Error('offline'); };
  const { POST } = load('app/api/zalo-team/tags/route.ts', { '../service': { zaloBackend: async () => ({ url: 'http://test/api', headers: {} }) } });
  const request = kind => new Request('http://localhost:3000/api/zalo-team/tags', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
  try {
    const read = await POST(request('read'));
    assert.equal(read.status, 503);
    assert.match((await read.json()).message, /kết nối/);
    const write = await POST(request('create'));
    assert.equal(write.status, 503);
    assert.match((await write.json()).message, /Chưa xác nhận được kết quả/);
    assert.equal(attempts, 2);
  } finally { global.fetch = original; }
});
test('startup only enables the tunnel for the configured local VPS endpoint', () => {
  const { localVpsUrl, needsTunnel } = require('./service/ensure-tunnel.cjs');
  assert.equal(localVpsUrl('http://127.0.0.1:9340/api'), true);
  assert.equal(localVpsUrl('http://localhost:9340/api'), true);
  for (const value of ['', undefined, 'http://127.0.0.1:4000/api', 'https://crm.example/api', 'http://other-host:9340/api']) assert.equal(localVpsUrl(value), false);
  assert.equal(needsTunnel(__dirname, {}), false);
  assert.equal(needsTunnel(__dirname, { ZALO_TEAM_API_URL: 'https://crm.example/api' }), false);
  assert.equal(needsTunnel(__dirname, { ZALO_TEAM_REMOTE_API_URL: 'http://127.0.0.1:9340/api' }), true);
});
