import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

async function sha(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// Only native message-bound locators inside the configured PC media root are
// accepted. Decoding writes a fresh staging file and never changes the source.
export async function copyPcAsset({ row, attachment, mediaRoot, out, decode, maxBytes = 262144000 }) {
  const real = await fs.realpath(row.path), relative = path.relative(mediaRoot, real);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('PC_ASSET_OUTSIDE_ROOT');
  const original = await fs.stat(real);
  if (!original.isFile() || original.size < 1 || original.size > maxBytes + 4096) throw Error('PC_ASSET_SIZE');
  let source = real, temporary;
  try {
    if (row.encoding === 'pc-file-noise') {
      if (!row.checksum || row.slot !== 'attachments.0.url' || attachment.kind !== 'file') throw Error('PC_ASSET_ENCODING');
      temporary = path.join(out, 'blobs', `.decode-${randomUUID()}`);
      await decode({ src: real, dest: temporary, checksum: row.checksum });
      source = temporary;
    } else if (row.encoding) throw Error('PC_ASSET_ENCODING');
    const stat = await fs.stat(source);
    if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) throw Error('PC_ASSET_SIZE');
    // A decoded cache must have an independently declared original size.
    const expected = Number(attachment.size);
    if (row.encoding && (!Number.isSafeInteger(expected) || expected <= 0 || stat.size !== expected)) throw Error('PC_ASSET_SIZE_MISMATCH');
    if (row.slot.endsWith('.url') && attachment.kind === 'file' && expected > 0 && stat.size !== expected) throw Error('PC_ASSET_SIZE_MISMATCH');
    const hash = await sha(source), dest = path.join(out, 'blobs', hash);
    if (!(await fs.stat(dest).catch(() => null))) await pipeline(createReadStream(source), createWriteStream(dest, { flags: 'wx' }));
    if (await sha(dest) !== hash) throw Error('PC_FILE_CHANGED');
    return { messageId: row.messageId, slot: row.slot, hash, bytes: stat.size };
  } finally {
    if (temporary) await fs.unlink(temporary).catch(() => {});
  }
}
