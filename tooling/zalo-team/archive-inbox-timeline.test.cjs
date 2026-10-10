const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../apps/frontend/src/features/zalo-team');

function timeline(archiveRequest, fetch) {
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(root, name + '.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(`(function(require,exports){${code}\n})`, {
      fetch, AbortController, AbortSignal, DOMException, Error, setTimeout, clearTimeout,
    })((id) => id === './archive' ? { archiveRequest } : load(id.replace('./', '')), exports);
    return (cache[name] = exports);
  }
  return load('timeline').readTimelinePage;
}
const message = (id, time) => ({ id, time, clientId: id, text: 'fixture', attachments: [], archived: true });
const page = (messages, cursor = null) => ({ accountId: 1, conversationId: '23', messages, cursor, hasMore: !!cursor, warning: null });

test('archive-only chat opens and paginates without calling unavailable Web history', async () => {
  let webCalls = 0;
  const calls = [];
  const read = timeline(async (request) => {
    calls.push(request);
    return request.before ? page([message('1', 1)]) : page([message('2', 2)], { id: '2', time: '2' });
  }, async () => { webCalls++; throw Error('Web unavailable'); });
  const first = await read(1, '23', undefined, false, new AbortController().signal, null, true);
  assert.equal(first.warning, null);
  assert.equal(first.hasMore, true);
  const last = await read(1, '23', first.cursor, false, new AbortController().signal, null, true);
  assert.equal(last.messages[0].id, '1');
  assert.equal(last.hasMore, false);
  assert.equal(webCalls, 0);
  assert.equal(calls.length, 2);
});

test('archive failure stays an error and wrong account cannot be displayed', async () => {
  const broken = timeline(async () => { throw Error('Archive unavailable'); }, async () => { throw Error('Unexpected Web call'); });
  await assert.rejects(broken(1, '23', undefined, false, new AbortController().signal, null, true), /Archive unavailable/);
  const wrong = timeline(async () => ({ ...page([message('1', 1)]), accountId: 2 }), async () => {});
  await assert.rejects(wrong(1, '23', undefined, false, new AbortController().signal, null, true), /WEB_IDENTITY_MISMATCH/);
});

test('live chat still reports genuine source failure while keeping saved messages', async () => {
  const read = timeline(async () => page([message('1', 1)]), async () => { throw Error('Offline'); });
  const result = await read(1, '23', undefined, false, new AbortController().signal);
  assert.equal(result.warning, 'ARCHIVE_FALLBACK');
  assert.equal(result.messages.length, 1);
});


test('first source paints while the other is still pending, without exposing a partial cursor',async()=>{
 let release;const previews=[];
 const read=timeline(()=>new Promise(r=>release=r),async()=>new Response(JSON.stringify(page([message('2',2)],{id:'2',time:'2'})),{headers:{'content-type':'application/json'}}));
 const pending=read(1,'23',undefined,false,new AbortController().signal,null,false,p=>previews.push(p));
 await new Promise(r=>setImmediate(r));assert.equal(previews.length,1);assert.equal(previews[0].cursor,null);assert.equal(previews[0].messages[0].id,'2');
 release(page([message('1',1)]));const result=await pending;assert.ok(result.messages.length>=1);
});
