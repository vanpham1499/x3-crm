const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { NextRequestAdapter } = require('next/dist/server/web/spec-extension/adapters/next-request');

// Browser navigation can cancel a POST before Next creates its route Request.
// Next 14.1.4 handed this destroyed body to undici and threw before our handler.
test('cancelled Node POST does not reuse a destroyed request body', async () => {
  const body = Readable.from(['{"action":"status"}']);
  for await (const chunk of body) { void chunk; }
  assert.equal(Readable.isDisturbed(body), true);
  const request = NextRequestAdapter.fromNodeNextRequest({
    method: 'POST', url: 'http://localhost/api/zalo-team/web', headers: {}, body,
  }, AbortSignal.abort());
  assert.equal(request.signal.aborted, true);
  assert.equal(request.body, null);
});

test('live POST keeps its JSON body available to the route', async () => {
  const request = NextRequestAdapter.fromNodeNextRequest({
    method: 'POST', url: 'http://localhost/api/zalo-team/web', headers: {},
    body: Readable.from(['{"action":"status"}']),
  }, new AbortController().signal);
  assert.deepEqual(await request.json(), { action: 'status' });
});

test('cancelled Web POST does not reuse a locked stream', async () => {
  const body = new ReadableStream();
  const reader = body.getReader();
  try {
    const request = NextRequestAdapter.fromWebNextRequest({
      method: 'POST', url: 'http://localhost/api/zalo-team/web', headers: {}, body,
      request: { signal: AbortSignal.abort() },
    });
    assert.equal(request.signal.aborted, true);
    assert.equal(request.body, null);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
});
