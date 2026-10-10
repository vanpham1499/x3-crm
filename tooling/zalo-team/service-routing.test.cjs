const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../apps/frontend/src/app/api/zalo-team', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name === '../service' ? load('service.ts') : require(name), module, module.exports);
  return module.exports;
}

test('dedicated backend cannot silently fall back to CRM or send an unconfigured key', async () => {
  const keys = ['ZALO_TEAM_RUNTIME', 'ZALO_TEAM_API_URL', 'ZALO_TEAM_SERVICE_KEY_FILE', 'NEXT_PUBLIC_API_URL'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-routing-'));
  try {
    keys.forEach(k => delete process.env[k]);
    const { zaloBackend } = load('service.ts');
    process.env.NEXT_PUBLIC_API_URL = 'https://crm.example/api';
    assert.equal((await zaloBackend()).url, 'https://crm.example/api');
    process.env.ZALO_TEAM_RUNTIME = 'crm';
    await assert.rejects(zaloBackend(), /ROUTING_REQUIRED/);
    process.env.ZALO_TEAM_RUNTIME = 'zalo';
    await assert.rejects(zaloBackend(), /NOT_CONFIGURED/);
    process.env.ZALO_TEAM_API_URL = 'http://zalo-api:8080/api';
    await assert.rejects(zaloBackend());
    process.env.ZALO_TEAM_SERVICE_KEY_FILE = path.join(root, 'key');
    fs.writeFileSync(process.env.ZALO_TEAM_SERVICE_KEY_FILE, 'a'.repeat(64));
    const target = await zaloBackend();
    assert.equal(target.url, 'http://zalo-api:8080/api');
    assert.equal(target.headers['X-Zalo-Service-Key'].length, 64);
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    fs.rmSync(root, { recursive: true });
  }
});

test('PC controls stay local while archive requests go to the dedicated VPS', async () => {
  const keys=['ZALO_TEAM_RUNTIME','ZALO_TEAM_API_URL','ZALO_TEAM_PC_API_URL','ZALO_TEAM_SERVICE_KEY_FILE'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zt-pc-routing-'));
  const originalFetch=global.fetch;
  try {
    process.env.ZALO_TEAM_RUNTIME='combined';
    process.env.ZALO_TEAM_API_URL='http://127.0.0.1:9340/api';
    process.env.ZALO_TEAM_PC_API_URL='http://localhost:4000/api';
    process.env.ZALO_TEAM_SERVICE_KEY_FILE=path.join(root,'key');fs.writeFileSync(path.join(root,'key'),'b'.repeat(64));
    const {archiveProxy}=load('archive/proxy.ts');let target;
    global.fetch=async(url,options)=>{target={url,headers:options.headers};return Response.json({ok:true});};
    const request=kind=>new Request('http://localhost:3000/api/zalo-team/archive',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({kind})});
    assert.equal((await archiveProxy(request('pc-status'))).status,200);
    assert.equal(target.url,'http://localhost:4000/api/zalo-team/archive');
    assert.equal(target.headers['X-Zalo-Service-Key'],undefined);
    assert.equal((await archiveProxy(request('file-pick'))).status,200);
    assert.equal(target.url,'http://localhost:4000/api/zalo-team/archive');
    assert.equal(target.headers['X-Zalo-Service-Key'],undefined);
    const remotePicker = new Request('https://crm.example/api/zalo-team/archive',{method:'POST',headers:{Origin:'https://crm.example','Content-Type':'application/json'},body:JSON.stringify({kind:'file-pick'})});
    assert.equal((await archiveProxy(remotePicker)).status,403);
    assert.equal((await archiveProxy(request('backup'))).status,200);
    assert.equal(target.url,'http://127.0.0.1:9340/api/zalo-team/archive');
    assert.equal(target.headers['X-Zalo-Service-Key'],'b'.repeat(64));
  } finally {global.fetch=originalFetch;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}fs.rmSync(root,{recursive:true});}
});

test('native message API identity uses the same CRM owner and rejects inactive accounts', async () => {
  const saved = global.fetch;
  const { authenticatedOwner } = load('access.ts');
  let active = true;
  global.fetch = async url => {
    assert.ok(url.endsWith('/auth/zalo-team'));
    return Response.json({ id: 7, tenant_id: 12, is_active: active, zalo_access: {admin:true,owner:'a'.repeat(64)} });
  };
  const request = new Request('https://crm.example/api/zalo-team/web', { method: 'POST', headers: { Origin: 'https://crm.example' } });
  try {
    assert.equal(await authenticatedOwner(request), 'a'.repeat(64));
    active = false;
    await assert.rejects(authenticatedOwner(request), /CRM_LOGIN_REQUIRED/);
    await assert.rejects(authenticatedOwner(new Request(request.url, { method: 'POST', headers: { Origin: 'https://other.example' } })), /INVALID_ORIGIN/);
  } finally { global.fetch = saved; }
});

test('HTTPS public origin survives a private HTTP proxy and cannot be replaced by forwarded headers', async () => {
  const oldFetch = global.fetch, oldOrigin = process.env.ZALO_TEAM_PUBLIC_ORIGIN;
  process.env.ZALO_TEAM_PUBLIC_ORIGIN = 'https://crm.example';
  const { authenticatedOwner } = load('access.ts');
  let reads = 0;
  global.fetch = async (_url, options) => {
    reads++;
    assert.equal(options.headers.Origin, 'https://crm.example');
    return Response.json({id:1,is_active:true,zalo_access:{admin:true,owner:'a'.repeat(64)}});
  };
  try {
    const privateUrl = 'http://127.0.0.1:9300/api/zalo-team/web';
    assert.equal(await authenticatedOwner(new Request(privateUrl,{method:'POST',headers:{Origin:'https://crm.example'}})), 'a'.repeat(64));
    await assert.rejects(authenticatedOwner(new Request(privateUrl,{method:'POST',headers:{Origin:'https://evil.example','X-Forwarded-Host':'evil.example','X-Forwarded-Proto':'https'}})), /INVALID_ORIGIN/);
    assert.equal(reads,1);
  } finally {
    global.fetch=oldFetch;
    if(oldOrigin===undefined)delete process.env.ZALO_TEAM_PUBLIC_ORIGIN;else process.env.ZALO_TEAM_PUBLIC_ORIGIN=oldOrigin;
  }
});
