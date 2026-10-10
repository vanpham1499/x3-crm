import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pcFingerprint, planMessage, validateIndex } from './incremental.mjs';

const message = n => ({ id: String(n), clientId: String(n), time: 1789000000000 + n, text: 'Tiếng Việt ❤️', type: 'MSG_TEXT', kind: 'text', attachments: [], sender: { id: '123', name: 'Bạn' }, mine: false, quote: null, reactions: [], archiveProjection: 2 });
const indexFor = rows => ({ format: 'zalo-team-pc-index/1', accountId: '123', conversationId: '456', messages: Object.fromEntries(rows.map(m => [m.id, { fingerprint: pcFingerprint(m), readySlots: [], complete: true }])) });
test('500 saved, repeat exports zero, 10 new exports exactly their IDs including older timestamps', () => {
  const saved = Array.from({ length: 500 }, (_, i) => message(i));
  const index = indexFor(saved);
  assert.equal(saved.filter(m => planMessage(m, index).emit).length, 0);
  const added = Array.from({ length: 10 }, (_, i) => ({ ...message(i + 500), time: 1780000000000 }));
  assert.deepEqual([...saved, ...added].filter(m => planMessage(m, index).emit).map(m => m.id), added.map(m => m.id));
});
test('old changes, missing files, corrupt files and new URLs have distinct decisions', () => {
  const m = { ...message(1), kind: 'media', attachments: [{ kind: 'image', url: 'https://example.invalid/old', preview: 'https://example.invalid/p' }] };
  const index = indexFor([m]);
  index.messages['1'].readySlots = ['attachments.0.url'];
  index.messages['1'].complete = false;
  assert.deepEqual(planMessage(m, index), { emit: true, readySlots: ['attachments.0.url'] });
  index.messages['1'].complete = true;
  const refresh = structuredClone(m); refresh.attachments[0].url = 'https://example.invalid/new';
  assert.equal(planMessage(refresh, index).emit, false);
  assert.equal(planMessage({ ...m, reactions: [{ icon: 'heart', count: 1 }] }, index).emit, true);
  assert.equal(planMessage({ ...m, text: 'changed' }, index).emit, true);
  assert.equal(planMessage({ ...m, id: '2' }, index).emit, true);
});
test('index identity is account and conversation scoped; wrong format fails closed', () => {
  assert.throws(() => validateIndex(indexFor([]), 'other', '456'));
  assert.throws(() => validateIndex(indexFor([]), '123', 'other'));
  assert.throws(() => validateIndex({ ...indexFor([]), format: 'unknown' }, '123', '456'));
});
test('Node and PHP fingerprint contracts match Unicode, object ordering, empty structures and attachment URLs', () => {
  const rows = [message(1), { ...message(2), styles: [], quote: { text: 'a/b\u2028c', extra: {} }, sender: { name: 'Bạn', id: '123' }, attachments: [{ kind: 'image', size: 100, name: 'Ảnh.jpg', url: 'https://example.invalid/a', preview: 'https://example.invalid/b' }] }];
  const php = process.env.PHP_PATH || (process.platform === 'win32' ? 'D:/laragon/bin/php/php-8.4.4/php.exe' : 'php');
  const result = spawnSync(php, ['tooling/tests/zalo-team-pc-fingerprint.php'], { input: JSON.stringify(rows), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), rows.map(pcFingerprint));
});
test('automatic file recovery only emits targeted stored messages, without importing unrelated history', () => {
  const index = { ...indexFor([]), recoveryIds: ['1'] };
  assert.equal(planMessage(message(1), index).emit, true);
  assert.equal(planMessage(message(2), index).emit, false);
  assert.equal(planMessage(message(1), { ...index, recoveryIds: [] }).emit, false);
  assert.throws(() => validateIndex({ ...index, recoveryIds: [1] }, '123', '456'), /RECOVERY_INVALID/);
});
