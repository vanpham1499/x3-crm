const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
function load(path, requireFn = require) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(requireFn, exports);
  return exports;
}
const { indexWork, matchesWork, emptyWorkFilter } = load('apps/frontend/src/features/zalo-team/workspace-filter.ts');
const rows = [
  { accountId: 1, conversationId: 'g1', state: 'in_progress', assigneeId: 7 },
  { accountId: 2, conversationId: 'g1', state: 'resolved', assigneeId: 8 },
  { accountId: 1, conversationId: 'g2', state: 'needs_action', assigneeId: null },
];
test('work filters intersect state and assignee, preserving sending account identity', () => {
  const index = indexWork({ items: rows, userId: 7, canManage: true });
  const filter = { person: 'mine', state: 'in_progress' };
  assert.deepEqual(rows.filter(row => matchesWork(row, filter, index, 7)), [rows[0]]);
  assert.deepEqual(rows.filter(row => matchesWork(row, { person: 'unassigned', state: 'all' }, index, 7)), [rows[2]]);
  assert.deepEqual(rows.filter(row => matchesWork(row, { person: '8', state: 'resolved' }, index, 7)), [rows[1]]);
  assert.equal(matchesWork(rows[0], filter, index), false);
  assert.equal(matchesWork({ accountId: 3, conversationId: 'g1' }, { person: 'unassigned', state: 'all' }, index, 7), false);
  assert.equal(matchesWork(rows[0], emptyWorkFilter, new Map()), true);
});
test('large inbox uses indexed lookups without scanning the summary for each row', () => {
  const items = Array.from({ length: 10000 }, (_, i) => ({ ...rows[0], conversationId: String(i) }));
  const index = indexWork({ items, userId: 7 });
  items.find = () => { throw Error('per-row scan'); };
  assert.equal(items.filter(row => matchesWork(row, { person: 'mine', state: 'all' }, index, 7)).length, 10000);
});
test('workspace proxy rejects cross-origin requests and preserves CRM rejection without replay', async () => {
  let calls = 0;
  const old = process.env.ZALO_TEAM_PUBLIC_ORIGIN;
  process.env.ZALO_TEAM_PUBLIC_ORIGIN = 'http://localhost:3000';
  const { POST } = load('apps/frontend/src/app/api/zalo-team/workspace/route.ts', () => ({
    accessCommand: async (_req, body, endpoint) => {
      calls++; assert.equal(endpoint, 'workspace'); assert.equal(body.kind, 'claim');
      return Response.json({ message: 'Permission changed' }, { status: 403 });
    },
  }));
  const request = (origin, body) => new Request('http://localhost:3000/api/zalo-team/workspace', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body,
  });
  try {
    assert.equal((await POST(request('https://other.example', '{}'))).status, 403);
    assert.equal((await POST(request('http://localhost:3000', '{broken'))).status, 400);
    assert.equal((await POST(request('http://localhost:3000', ' '.repeat(12001)))).status, 413);
    assert.equal(calls, 0);
    const response = await POST(request('http://localhost:3000', '{"kind":"claim"}'));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(calls, 1);
  } finally {
    if (old === undefined) delete process.env.ZALO_TEAM_PUBLIC_ORIGIN;
    else process.env.ZALO_TEAM_PUBLIC_ORIGIN = old;
  }
});
