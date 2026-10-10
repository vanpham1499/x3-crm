const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { shouldStart } = require('./ensure-local.cjs');
function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../../apps/frontend/src/app/api/zalo-team/call', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] || require(name), module, module.exports);
  return module.exports;
}
test('startup is limited to the local Windows gateway and respects opt out', () => {
  const repo = path.resolve(__dirname, '../../..');
  const env = { ZALO_TEAM_RUNTIME: 'local', ZALO_TEAM_CALL_AUTOSTART: 'true', ZALO_TEAM_CALL_URL: 'http://127.0.0.1:9260' };
  assert.equal(shouldStart(repo, env, 'win32'), true);
  assert.equal(shouldStart(repo, env, 'linux'), false);
  for (const override of [{ ZALO_TEAM_RUNTIME: 'crm' }, { ZALO_TEAM_CALL_AUTOSTART: 'false' },
    { ZALO_TEAM_CALL_URL: 'http://example.com:9260' }, { ZALO_TEAM_CALL_URL: 'http://127.0.0.1:9261' },
    { ZALO_TEAM_CALL_URL: 'http://user:pass@localhost:9260' }])
    assert.equal(shouldStart(repo, { ...env, ...override }, 'win32'), false);
});
test('simultaneous recovery requests share one hidden process and can recover again later', async () => {
  let starts = 0, finish;
  const gateway = load('gateway.ts', {
    'node:fs/promises': { access: async () => {} },
    'node:child_process': { execFile: (file, args, options, callback) => {
      starts++; finish = callback;
      assert.equal(options.windowsHide, true);
      assert.ok(args.includes('-NonInteractive'));
      assert.match(file, /powershell.exe$/);
    } },
  });
  const url = new URL('http://127.0.0.1:9260');
  if (!gateway.canStartLocalGateway(url)) return;
  const a = gateway.ensureLocalGateway(url), b = gateway.ensureLocalGateway(url);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1); finish(null); await Promise.all([a, b]);
  const c = gateway.ensureLocalGateway(url);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 2); finish(Error('private child output'));
  await assert.rejects(c, /^Error: CALL_START_FAILED$/);
  await gateway.ensureLocalGateway(new URL('http://example.com:9260'));
  assert.equal(starts, 2);
});
test('capability recovery is authenticated, bounded and never replays call mutations', async () => {
  const oldFetch = global.fetch;
  let starts = 0, fetches = 0, deny = false;
  const route = load('route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '../access': { authenticatedAccess: async () => { if (deny) throw Error('CRM_LOGIN_REQUIRED'); return {admin:true,owner:'a'.repeat(64),userId:1,userName:'Fixture'}; }, accessCommand:async()=>Response.json({ok:true}) },
    '@/features/zalo-team/account-access': require('node:module').createRequire(__filename)('../../../apps/frontend/src/features/zalo-team/account-access.ts'),
    './gateway': { ensureLocalGateway: async () => { starts++; } },
    'node:fs/promises': { readFile: async () => 'a'.repeat(64) },
  });
  const request = (action, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/zalo-team/call', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action, accountId: 5, conversationId: '123', sessionId: 'a'.repeat(36) }),
  });
  try {
    global.fetch = async () => { fetches++; if (fetches === 1) throw Error('connection refused'); return Response.json({ callReady: true, provider: 'zrtc' }); };
    assert.equal((await route.POST(request('capabilities', 'http://other.test'))).status, 403);
    deny = true;
    assert.equal((await route.POST(request('capabilities'))).status, 401);
    assert.equal(fetches, 0); assert.equal(starts, 0); deny = false;
    assert.deepEqual(await (await route.POST(request('capabilities'))).json(), { available: true });
    assert.equal(starts, 1); assert.equal(fetches, 2);
    global.fetch = async () => Response.json({ callReady: false, provider: 'webrtc-audio' });
    assert.deepEqual(await (await route.POST(request('capabilities'))).json(), { available: false });
    assert.equal(starts, 1);
    global.fetch = async () => { fetches++; throw Error('timeout'); };
    const before = fetches;
    assert.equal((await route.POST(request('start'))).status, 503);
    assert.equal(fetches, before + 1); assert.equal(starts, 1);
    const failure = await route.POST(request('capabilities'));
    assert.equal(failure.status, 503); assert.equal(starts, 2);
    assert.equal(fetches, before + 3);
  } finally { global.fetch = oldFetch; }
});
