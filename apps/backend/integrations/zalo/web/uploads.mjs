import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const TTL = 24 * 60 * 60 * 1000;
export function validUpload(meta) {
  return (
    meta &&
    Object.keys(meta).length === 7 &&
    /^[a-f0-9]{64}$/.test(meta.owner || "") &&
    Number.isSafeInteger(meta.accountId) &&
    meta.accountId > 0 &&
    typeof meta.conversationId === "string" &&
    /^g?\d{1,30}$/.test(meta.conversationId) &&
    typeof meta.name === "string" &&
    meta.name.length > 0 &&
    meta.name.length <= 255 &&
    !/[\\/\x00-\x1f]/.test(meta.name) &&
    typeof meta.mime === "string" &&
    /^[\w.+-]+\/[\w.+-]+$/.test(meta.mime) &&
    Number.isSafeInteger(meta.size) &&
    meta.size > 0 &&
    meta.size <= MAX_UPLOAD_BYTES &&
    ["image", "file"].includes(meta.kind) &&
    (meta.kind !== "image" || /^image\/(png|jpeg|gif|webp)$/.test(meta.mime))
  );
}
export class Uploads {
  constructor(root) {
    this.root = root;
  }
  async stage(stream, meta) {
    if (!validUpload(meta)) throw Error("WEB_UPLOAD_INVALID");
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const id = crypto.randomUUID(),
      file = path.join(this.root, id);
    const handle = await fs.open(file + ".part", "wx", 0o600);
    let size = 0;
    const hash = crypto.createHash("sha256");
    try {
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > meta.size || size > MAX_UPLOAD_BYTES)
          throw Error("WEB_UPLOAD_TOO_LARGE");
        hash.update(chunk);
        await handle.writeFile(chunk);
      }
      if (size !== meta.size) throw Error("WEB_UPLOAD_INVALID");
      await handle.close();
      await fs.rename(file + ".part", file + ".bin");
      await fs.writeFile(
        file + ".json",
        JSON.stringify({
          ...meta,
          id,
          hash: hash.digest("hex"),
          createdAt: Date.now(),
        }),
        { flag: "wx", mode: 0o600 },
      );
      return { uploadId: id };
    } catch (e) {
      await handle.close().catch(() => {});
      await Promise.all(
        [".part", ".bin", ".json"].map((ext) =>
          fs.rm(file + ext, { force: true }),
        ),
      );
      throw e;
    }
  }
  async get(id, scope, withBytes = false) {
    if (!/^[a-f0-9-]{36}$/.test(id || "")) throw Error("WEB_UPLOAD_INVALID");
    const file = path.join(this.root, id);
    let meta;
    try {
      meta = JSON.parse(await fs.readFile(file + ".json", "utf8"));
    } catch {
      throw Error("WEB_UPLOAD_EXPIRED");
    }
    if (
      meta.owner !== scope.owner ||
      meta.accountId !== scope.accountId ||
      meta.conversationId !== scope.conversationId
    )
      throw Error("WEB_UPLOAD_SCOPE_MISMATCH");
    if (Date.now() - meta.createdAt > TTL) throw Error("WEB_UPLOAD_EXPIRED");
    if (!withBytes) return meta;
    const bytes = await fs.readFile(file + ".bin");
    if (
      bytes.length !== meta.size ||
      crypto.createHash("sha256").update(bytes).digest("hex") !== meta.hash
    )
      throw Error("WEB_UPLOAD_INVALID");
    return { ...meta, bytes: bytes.toString("base64") };
  }
  async cleanup() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    for (const name of await fs.readdir(this.root)) {
      if (!/^[a-f0-9-]{36}\.(json|bin|part)$/.test(name)) continue;
      const file = path.join(this.root, name),
        stat = await fs.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > TTL)
        await fs.rm(file, { force: true });
    }
  }
}
