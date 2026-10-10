import fs from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";

export class ExportReader {
  constructor(source, secret, accountId) {
    this.fd = fs.openSync(source, "r");
    this.accountId = accountId;
    this.key = Buffer.from(secret.key, "base64");
    this.iv = Buffer.from(secret.iv, "base64");
    const stat = fs.fstatSync(this.fd);
    this.size = stat.size;
    this.modified = stat.mtimeMs;
    if (
      this.key.length !== 32 ||
      this.iv.length !== 16 ||
      this.size < 1024 ||
      this.size % 16
    ) {
      this.close();
      throw Error("FILE_FORMAT_INVALID");
    }
    try {
      const tail = this.read(this.size - 32, 32);
      const pad = tail.at(-1);
      if (pad < 1 || pad > 16 || !tail.subarray(-pad).every((x) => x === pad))
        throw Error("FILE_KEY_MISMATCH");
      this.length = this.size - pad;
      const first = this.read(0, 512);
      if (
        first.subarray(257, 262).toString() !== "ustar" ||
        !first.toString("utf8", 0, 100).startsWith(accountId + "/")
      )
        throw Error("FILE_KEY_MISMATCH");
    } catch (e) {
      this.close();
      throw e;
    }
  }
  read(offset, length) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > 4 * 1024 * 1024 ||
      offset + length > this.size
    )
      throw Error("FILE_READ_BOUNDS");
    if (!length) return Buffer.alloc(0);
    const start = Math.floor(offset / 16) * 16,
      end = Math.ceil((offset + length) / 16) * 16;
    const raw = Buffer.alloc(end - start + (start ? 16 : 0));
    if (
      fs.readSync(this.fd, raw, 0, raw.length, start ? start - 16 : 0) !==
      raw.length
    )
      throw Error("FILE_CHANGED");
    const d = createDecipheriv(
      "aes-256-cbc",
      this.key,
      start ? raw.subarray(0, 16) : this.iv,
    );
    d.setAutoPadding(false);
    return Buffer.concat([
      d.update(start ? raw.subarray(16) : raw),
      d.final(),
    ]).subarray(offset - start, offset - start + length);
  }
  assertUnchanged() {
    const s = fs.fstatSync(this.fd);
    if (s.size !== this.size || s.mtimeMs !== this.modified)
      throw Error("FILE_CHANGED");
  }
  close() {
    if (this.fd !== undefined) {
      fs.closeSync(this.fd);
      this.fd = undefined;
    }
    this.key?.fill(0);
    this.iv?.fill(0);
  }
}
function str(b, start, length) {
  return b
    .subarray(start, start + length)
    .toString("utf8")
    .split("\0")[0];
}
function octal(b, start, length) {
  const text = str(b, start, length).trim();
  if (!/^[0-7]+$/.test(text)) throw Error("FILE_TAR_NUMBER");
  const n = parseInt(text, 8);
  if (!Number.isSafeInteger(n)) throw Error("FILE_TAR_NUMBER");
  return n;
}
export function tarIndex(reader, pulse = () => {}) {
  const members = [];
  const seen = new Set();
  let at = 0,
    pax = {};
  while (at + 512 <= reader.length) {
    const h = reader.read(at, 512);
    if (h.every((x) => x === 0)) break;
    const checksum = octal(h, 148, 8);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
    if (sum !== checksum) throw Error("FILE_TAR_CHECKSUM");
    const bytes = octal(h, 124, 12),
      type = str(h, 156, 1) || "0";
    let name = [str(h, 345, 155), str(h, 0, 100)].filter(Boolean).join("/");
    const offset = at + 512;
    at = offset + Math.ceil(bytes / 512) * 512;
    if (at > reader.length || members.length > 1000000)
      throw Error("FILE_TAR_BOUNDS");
    if (type === "x") {
      if (bytes > 65536) throw Error("FILE_TAR_PAX_LIMIT");
      const text = reader.read(offset, bytes);
      let pos = 0;
      pax = {};
      while (pos < text.length) {
        const space = text.indexOf(32, pos);
        const len = Number(text.subarray(pos, space));
        if (
          space < pos ||
          !Number.isInteger(len) ||
          len <= space - pos + 1 ||
          pos + len > text.length
        )
          throw Error("FILE_TAR_PAX_INVALID");
        const field = text.subarray(space + 1, pos + len - 1).toString();
        const eq = field.indexOf("=");
        pax[field.slice(0, eq)] = field.slice(eq + 1);
        pos += len;
      }
      continue;
    }
    name = pax.path || name;
    pax = {};
    if (
      !name.startsWith(reader.accountId + "/") ||
      name.includes("\\") ||
      name.includes(":") ||
      name.split("/").includes("..") ||
      !["0", "5"].includes(type)
    )
      throw Error("FILE_TAR_UNSAFE");
    if (type === "5") continue;
    if (seen.has(name)) throw Error("FILE_TAR_DUPLICATE_PATH");
    seen.add(name);
    members.push({ name, bytes, offset });
    if (members.length % 500 === 0)
      pulse({ phase: "indexing", members: members.length });
  }
  reader.assertUnchanged();
  return members;
}
export function* lines(reader, entry) {
  let carry = Buffer.alloc(0),
    base = entry.offset;
  for (let pos = 0; pos < entry.bytes;) {
    const data = reader.read(
      entry.offset + pos,
      Math.min(1048576, entry.bytes - pos),
    );
    pos += data.length;
    carry = Buffer.concat([carry, data]);
    let end;
    while ((end = carry.indexOf(10)) >= 0) {
      if (end > 1048576) throw Error("FILE_MESSAGE_TOO_LARGE");
      const line = carry.subarray(0, end);
      if (line.length)
        yield {
          row: JSON.parse(line.toString()),
          offset: base,
          bytes: end,
          hash: createHash("sha256").update(line).digest("hex"),
        };
      base += end + 1;
      carry = carry.subarray(end + 1);
    }
    if (carry.length > 1048576) throw Error("FILE_MESSAGE_TOO_LARGE");
  }
  if (carry.length)
    yield {
      row: JSON.parse(carry.toString()),
      offset: base,
      bytes: carry.length,
      hash: createHash("sha256").update(carry).digest("hex"),
    };
}
export function decodeNoise(data, first = false) {
  const out = Buffer.from(data);
  if (first) for (let i = 0; i < Math.min(out.length, 100); i++) out[i] ^= 147;
  return out;
}
