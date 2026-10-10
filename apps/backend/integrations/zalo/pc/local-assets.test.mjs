import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { copyPcAsset } from './local-assets.mjs';

test('native envelope is decoded, validated, deduplicated and leaves source intact', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-asset-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const mediaRoot = path.join(root, 'media'), out = path.join(root, 'export');
  await fs.mkdir(mediaRoot); await fs.mkdir(path.join(out, 'blobs'), { recursive: true });
  const source = path.join(mediaRoot, 'cached'), raw = Buffer.from('native-envelope'), decoded = Buffer.from('PK test-document');
  await fs.writeFile(source, raw);
  const row = { path: source, messageId: '42', slot: 'attachments.0.url', encoding: 'pc-file-noise', checksum: 'verified-native-checksum' };
  const args = { row, mediaRoot, out, attachment: { kind: 'file', size: decoded.length }, decode: async ({src,dest,checksum}) => {
    assert.equal(src, source); assert.equal(checksum, row.checksum); await fs.writeFile(dest, decoded, { flag: 'wx' });
  }};
  const a = await copyPcAsset(args), b = await copyPcAsset(args);
  assert.deepEqual(a, b); assert.equal(a.bytes, decoded.length);
  assert.deepEqual(await fs.readFile(source), raw);
  assert.deepEqual(await fs.readFile(path.join(out, 'blobs', a.hash)), decoded);
  assert.deepEqual(await fs.readdir(path.join(out, 'blobs')), [a.hash]);
  await assert.rejects(copyPcAsset({...args, attachment: {kind:'file',size:999}}), /SIZE_MISMATCH/);
  await assert.rejects(copyPcAsset({...args, attachment: {kind:'file',size:0}}), /SIZE_MISMATCH/);
  await assert.rejects(copyPcAsset({...args, decode: async ({dest}) => {await fs.writeFile(dest,'partial');throw Error('PC_ACCOUNT_CHANGED');}}), /PC_ACCOUNT_CHANGED/);
  assert.deepEqual(await fs.readdir(path.join(out, 'blobs')), [a.hash]);
  await assert.rejects(copyPcAsset({...args,row:{...row,path:path.join(out,'blobs',a.hash)}}), /OUTSIDE_ROOT/);
  await assert.rejects(copyPcAsset({...args,row:{...row,encoding:'unknown'}}), /ENCODING/);
  await assert.rejects(copyPcAsset({...args,row:{...row,checksum:''}}), /ENCODING/);
});
