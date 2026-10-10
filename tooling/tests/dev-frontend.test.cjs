const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {available} = require('../development/dev-frontend.cjs');
const {localVpsUrl} = require('../zalo-team/service/ensure-tunnel.cjs');

test('frontend preflight detects an occupied port without stopping its listener', async () => {
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,resolve));
  const port=server.address().port;
  try { assert.equal(await available(port),false); assert.equal(server.listening,true); }
  finally { await new Promise(resolve=>server.close(resolve)); }
  assert.equal(await available(port),true);
});
test('tunnel autostart recognizes both private APIs, never arbitrary destinations', () => {
  assert.equal(localVpsUrl('http://127.0.0.1:9345/api'),true);
  assert.equal(localVpsUrl('http://localhost:9340/api'),true);
  for(const url of ['http://example.com:9345/api','https://localhost:9345/api','http://localhost:9999/api','invalid'])
    assert.equal(localVpsUrl(url),false);
});
