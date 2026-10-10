const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const out = {};
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,
  '../../apps/frontend/src/features/zalo-team/open-conversation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('exports', code)(out);
const { openConversationSource } = out;

test('saved chat renders before slow native preparation and never renders twice', async () => {
  const events = [];
  let finish;
  const source = { id: '1:g23', archiveOnly: true };
  const pending = openConversationSource(source, () => {
    events.push('prepare');
    return new Promise(resolve => { finish = resolve; });
  }, () => events.push('show'));
  assert.deepEqual(events, ['show', 'prepare']);
  finish(source);
  await pending;
  assert.deepEqual(events, ['show', 'prepare']);
});

test('offline or cancelled native preparation cannot hide saved history or reselect an old chat', async () => {
  let shown = 0;
  await openConversationSource({ archiveOnly: true }, async () => null, () => shown++);
  assert.equal(shown, 1);
});

test('directory-only contacts still require successful native authorization before opening', async () => {
  let shown = 0;
  await openConversationSource({}, async () => null, () => shown++);
  assert.equal(shown, 0);
  await openConversationSource({}, async () => ({}), () => shown++);
  assert.equal(shown, 1);
});

test('late completion for saved chat A does not replace newly selected chat B', async () => {
  let selected;
  let finishA;
  const a = { id: '1:23', archiveOnly: true };
  const pending = openConversationSource(a,
    () => new Promise(resolve => { finishA = resolve; }),
    () => { selected = a.id; });
  await openConversationSource({ id: '2:23', archiveOnly: true }, async () => null,
    () => { selected = '2:23'; });
  finishA(a);
  await pending;
  assert.equal(selected, '2:23');
});
