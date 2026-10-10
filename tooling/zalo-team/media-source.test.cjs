const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.join(__dirname, '../../apps/frontend/src/features/zalo-team');
function load(name) {
  const out = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', code)(out, id => load(id.replace('./', '')));
  return out;
}
const { mergeStoredMedia, imageSources } = load('media-source');
const { mergeTimelineMessages } = load('timeline-merge');
const now = Date.now(), day = 86400000;
const live = { kind: 'image', name: 'image.jpg', size: 10, url: 'https://example.test/full', preview: 'https://example.test/thumb' };
const saved = { ...live, url: '/api/zalo-team/archive/assets/full', preview: '/api/zalo-team/archive/assets/thumb', archiveState: 'ready' };

test('recent Web images keep CDN URLs and verified backup fallback/status', () => {
  const item = mergeStoredMedia(live, saved, now - day, true, now);
  assert.equal(item.url, live.url);
  assert.equal(item.preview, live.preview);
  assert.equal(item.archiveState, 'ready');
  assert.deepEqual(imageSources(item), [live.preview, live.url, saved.preview, saved.url]);
  assert.deepEqual(imageSources(item, true), [live.url, live.preview, saved.url, saved.preview]);
});

test('failed Web candidates progress to backup without retry loops', () => {
  const item = mergeStoredMedia(live, saved, now, true, now);
  const failed = new Set([live.preview, live.url]);
  assert.equal(imageSources(item).find(url => !failed.has(url)), saved.preview);
  failed.add(saved.preview); failed.add(saved.url);
  assert.equal(imageSources(item).find(url => !failed.has(url)), undefined);
});

test('old, archived-only and non-image attachments retain server priority', () => {
  for (const item of [
    mergeStoredMedia(live, saved, now - 16 * day, true, now),
    mergeStoredMedia(live, saved, now - day, false, now),
    mergeStoredMedia({ ...live, kind: 'file' }, saved, now - day, true, now),
  ]) assert.equal(item.url, saved.url);
  assert.equal(mergeStoredMedia(live, saved, now - 15 * day, true, now).url, live.url);
});

test('missing Web URL uses saved original and absent backups do not invent a fallback', () => {
  assert.equal(mergeStoredMedia({ ...live, url: undefined, preview: undefined }, saved, now, true, now).url, saved.url);
  const partial = mergeStoredMedia(live, { ...saved, url: undefined, archiveState: 'partial' }, now, true, now);
  assert.equal(partial.archiveUrl, undefined);
  assert.equal(partial.archivePreview, saved.preview);
  const twice = mergeStoredMedia(partial, partial, now, true, now);
  assert.equal(twice.preview, live.preview);
  assert.equal(twice.archivePreview, saved.preview);
});

test('timeline keeps recent Web URLs after merge but does not attach backup from different versions', () => {
  const message = { id: '1', clientId: '1', time: now - day, attachments: [saved], archived: true };
  const native = { ...message, archived: false, attachments: [live] };
  const result = mergeTimelineMessages([message], [native])[0];
  assert.equal(result.attachments[0].url, live.url);
  assert.equal(result.attachments[0].archiveUrl, saved.url);
  assert.equal(mergeTimelineMessages([message], [{ ...native, attachments: [{ ...live, size: 99 }] }])[0].attachments[0].archiveUrl, undefined);
});
