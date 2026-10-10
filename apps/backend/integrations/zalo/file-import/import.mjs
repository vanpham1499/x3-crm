import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { ExportReader, tarIndex, lines, decodeNoise } from "./format.mjs";
import { projectPcPage } from "../pc/archive-reader.mjs";
import { jpegPreview } from "./images.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const emit = (v) => process.stdout.write(JSON.stringify(v) + "\n");
function checkStop(dir) {
  if (fs.existsSync(path.join(dir, "stop"))) throw Error("FILE_STOPPED");
}
export function indexExport(conf, pulse = () => {}) {
  const reader = new ExportReader(conf.source, conf.secret, conf.accountId);
  const db = new DatabaseSync(path.join(conf.root, "index.sqlite"));
  try {
    db.exec(
      "PRAGMA journal_mode=DELETE; PRAGMA cache_size=-8192; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS members; CREATE TABLE messages(cid TEXT,mid TEXT,offset INTEGER,bytes INTEGER,time INTEGER,hash TEXT,PRIMARY KEY(cid,mid)); CREATE TABLE members(name TEXT PRIMARY KEY,offset INTEGER,bytes INTEGER);",
    );
    const members = tarIndex(reader, pulse);
    const putMember = db.prepare("INSERT INTO members VALUES (?,?,?)");
    db.exec("BEGIN");
    for (const m of members) putMember.run(m.name, m.offset, m.bytes);
    db.exec("COMMIT");
    const meta = members.find(
      (m) =>
        m.name ===
        `${conf.accountId}/ZaloDownloads/database/${conf.accountId}_zmessage.zdb`,
    );
    if (!meta) throw Error("FILE_DATABASE_UNSUPPORTED");
    const put = db.prepare(
      "INSERT OR IGNORE INTO messages VALUES (?,?,?,?,?,?)",
    );
    const get = db.prepare("SELECT hash FROM messages WHERE cid=? AND mid=?");
    let total = 0,
      duplicates = 0;
    const names = {};
    db.exec("BEGIN");
    for (const { row: r, offset, bytes, hash: checksum } of lines(
      reader,
      meta,
    )) {
      const cid = String(r.toUid),
        mid = String(r.msgId),
        time = Number(r.sendDttm);
      if (
        !/^g?\d{1,30}$/.test(cid) ||
        !/^[\w.:-]{1,200}$/.test(mid) ||
        !Number.isSafeInteger(time) ||
        time < 1e12
      )
        throw Error("FILE_MESSAGE_IDENTITY");
      const wrote = put.run(cid, mid, offset, bytes, time, checksum).changes;
      if (!wrote) {
        if (get.get(cid, mid).hash !== checksum)
          throw Error("FILE_DUPLICATE_CONFLICT");
        duplicates++;
      }
      if (
        String(r.fromUid) === cid &&
        typeof r.dName === "string" &&
        r.dName.trim()
      )
        names[cid] = r.dName.slice(0, 200);
      total++;
      if (total % 5000 === 0) {
        db.exec("COMMIT; BEGIN");
        checkStop(conf.root);
        pulse({ phase: "reading", scanned: total, duplicates });
      }
    }
    db.exec("COMMIT");
    reader.assertUnchanged();
    const conversations = db
      .prepare(
        "SELECT cid AS conversationId,count(*) AS messages,min(time) AS oldest,max(time) AS newest FROM messages GROUP BY cid ORDER BY newest DESC",
      )
      .all()
      .map((c) => ({
        ...c,
        name:
          conf.names?.[c.conversationId] ||
          names[c.conversationId] ||
          (c.conversationId.startsWith("g") ? "Nhóm " : "Liên hệ ") +
            c.conversationId,
      }));
    const result = {
      scanned: total,
      messages: total - duplicates,
      duplicates,
      members: members.length,
      conversations,
      sourceBytes: reader.size,
      modified: reader.modified,
    };
    fs.writeFileSync(
      path.join(conf.root, "catalog.json"),
      JSON.stringify(result),
    );
    return result;
  } finally {
    db.close();
    reader.close();
  }
}
function params(row) {
  try {
    return typeof row.message?.params === "string"
      ? JSON.parse(row.message.params)
      : row.message?.params || {};
  } catch {
    return {};
  }
}
export async function buildBundle(conf, pulse = () => {}) {
  const started = performance.now();
  const timings = { copyMs: 0, decodeMs: 0, encodeMs: 0, lookupMs: 0 };
  const reader = new ExportReader(conf.source, conf.secret, conf.accountId);
  const db = new DatabaseSync(path.join(conf.root, "index.sqlite"), {
    readOnly: true,
  });
  const catalog = JSON.parse(
    fs.readFileSync(path.join(conf.root, "catalog.json")),
  );
  if (
    reader.size !== catalog.sourceBytes ||
    reader.modified !== catalog.modified
  ) {
    reader.close();
    db.close();
    throw Error("FILE_CHANGED");
  }
  const out = path.join(conf.root, "bundle");
  fs.mkdirSync(path.join(out, "blobs"), { recursive: true });
  const blobs = path.join(out, "blobs");
  const file = path.join(out, "messages.jsonl");
  const writer = fs.openSync(file, "w");
  const assets = [],
    issues = [];
  let total = 0,
    bytes = 0,
    oldest = null,
    newest = null,
    after = conf.after || 0;
  const candidates = db.prepare(
    "SELECT * FROM members WHERE name >= ? AND name < ? ORDER BY bytes DESC",
  );
  const legacy = db.prepare("SELECT * FROM members WHERE name=?");
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE cid=? AND offset>? ORDER BY offset LIMIT ?",
    )
    .all(
      conf.conversationId,
      after,
      Math.max(1, Math.min(1000, conf.batchMessages || 250)),
    );
  const descriptor = {
    accountId: conf.accountId,
    constants: conf.secret.constants,
  };
  function writeBlob(data) {
    const sha = hash(data);
    const dest = path.join(blobs, sha);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, data);
    return { hash: sha, bytes: data.length };
  }
  async function copy(member, noise, checksum) {
    const size = member.bytes - (noise ? 6 : 0);
    if (size <= 0 || size > (conf.maxFileBytes || 262144000))
      throw Error("FILE_ASSET_LIMIT");
    if (bytes + size > (conf.budget ?? Infinity))
      throw Error("FILE_UPLOAD_LIMIT");
    if (
      noise &&
      !reader
        .read(member.offset + member.bytes - 6, 6)
        .equals(Buffer.from("077a416c4f07", "hex"))
    )
      throw Error("FILE_NOISE_SIGNATURE");
    const temp = path.join(blobs, "copy.tmp");
    const fd = fs.openSync(temp, "w"),
      sha = createHash("sha256"),
      md5 = createHash("md5");
    try {
      for (let pos = 0; pos < size;) {
        checkStop(conf.root);
        let data = reader.read(
          member.offset + pos,
          Math.min(1048576, size - pos),
        );
        if (noise) data = decodeNoise(data, pos === 0);
        sha.update(data);
        md5.update(data);
        fs.writeSync(fd, data);
        pos += data.length;
      }
    } finally {
      fs.closeSync(fd);
    }
    if (checksum && md5.digest("hex") !== checksum.toLowerCase()) {
      fs.unlinkSync(temp);
      throw Error("FILE_ASSET_CHECKSUM");
    }
    const digest = sha.digest("hex"),
      dest = path.join(blobs, digest);
    if (fs.existsSync(dest)) fs.unlinkSync(temp);
    else fs.renameSync(temp, dest);
    bytes += size;
    return { hash: digest, bytes: size };
  }
  try {
    for (const item of rows) {
      checkStop(conf.root);
      const raw = reader.read(item.offset, item.bytes);
      if (hash(raw) !== item.hash) throw Error("FILE_CHANGED");
      const row = JSON.parse(raw);
      const [m] = projectPcPage(
        {
          sourceAccountId: conf.accountId,
          messages: [row],
          ownProfile: { userId: conf.accountId, displayName: conf.accountName },
          profiles: [],
        },
        descriptor,
      );
      m.archiveFileImport = true;
      const issue = (a, reason, slot) =>
        issues.push({
          messageId: m.id,
          time: m.time,
          kind: a.kind,
          name:
            a.name ||
            (a.kind === "sticker"
              ? "Nhãn dán"
              : a.kind === "image"
                ? "Ảnh"
                : "Tệp đính kèm"),
          slot,
          reason,
        });
      // Keep source URLs for audit; media is saved only when present and verified in this export.
      const p = params(row),
        sender =
          String(row.fromUid) === "0" ? conf.accountId : String(row.fromUid),
        cid = conf.conversationId;
      const base = `${conf.accountId}/ZaloDownloads/`,
        prefix = `${row.cliMsgId}_${sender}_${cid}`;
      if (m.attachments.length === 1 && m.attachments[0].kind !== "link") {
        const lookupStarted = performance.now();
        const a = m.attachments[0],
          kind = a.kind;
        let member,
          noise = false,
          checksum;
        const dir = {
          image: "picture",
          file: "file",
          video: "video",
          audio: "voice",
        }[kind];
        if (dir)
          member = candidates
            .all(
              `${base}resource/${cid}/${dir}/${prefix}`,
              `${base}resource/${cid}/${dir}/${prefix}\uffff`,
            )
            .find(
              (x) =>
                path.posix.basename(x.name) === prefix ||
                path.posix.basename(x.name).startsWith(prefix + "_") ||
                path.posix.basename(x.name).startsWith(prefix + "."),
            );
        if (
          kind === "file" &&
          !member &&
          /^[a-f0-9]{32}$/i.test(p.checksum || "")
        ) {
          checksum = p.checksum.toLowerCase();
          member =
            legacy.get(
              `${base}fileNoise/${cid.startsWith("g") ? "group/" : ""}${checksum}`,
            ) ||
            legacy.get(`${base}fileNoise/${checksum}`) ||
            legacy.get(`${base}resource/${cid}/fileNoise/${prefix}`);
          noise = !!member;
        }
        timings.lookupMs += performance.now() - lookupStarted;
        if (member) {
          try {
            if (
              kind === "file" &&
              Number(a.size) > 0 &&
              member.bytes - (noise ? 6 : 0) !== Number(a.size)
            )
              throw Error("FILE_ASSET_SIZE_MISMATCH");
            const copyStarted = performance.now();
            const blob = await copy(member, noise, checksum);
            timings.copyMs += performance.now() - copyStarted;
            assets.push({
              ...blob,
              messageId: m.id,
              slot: "attachments.0.url",
            });
            if (member.name.endsWith(".jxl") && !conf.serverPreview) {
              if (blob.bytes > 16 * 1024 * 1024)
                throw Error("FILE_PREVIEW_LIMIT");
              const preview = await jpegPreview(
                fs.readFileSync(path.join(blobs, blob.hash)),
                (t) => {
                  timings.decodeMs += t.decodeMs;
                  timings.encodeMs += t.encodeMs;
                },
              );
              if (bytes + preview.length > (conf.budget ?? Infinity))
                throw Error("FILE_UPLOAD_LIMIT");
              const b = writeBlob(preview);
              bytes += b.bytes;
              assets.push({
                ...b,
                messageId: m.id,
                slot: "attachments.0.preview",
              });
            }
          } catch (e) {
            if (
              ["FILE_STOPPED", "FILE_CHANGED", "FILE_UPLOAD_LIMIT"].includes(
                e.message,
              )
            )
              throw e;
            issue(
              a,
              e.message.startsWith("FILE_") ? e.message : "FILE_PREVIEW_FAILED",
              "attachments.0.url",
            );
          }
        } else issue(a, "FILE_NOT_IN_EXPORT", "attachments.0.url");
      } else if (m.attachments.length > 1) {
        // Never assign a single native file to multiple album items without a proven mapping.
        m.attachments.forEach((a, i) => {
          if (a.kind !== "link")
            issue(a, "FILE_MULTIPART_UNSUPPORTED", `attachments.${i}.url`);
        });
      }
      fs.writeSync(writer, JSON.stringify(m) + "\n");
      total++;
      oldest = Math.min(oldest ?? m.time, m.time);
      newest = Math.max(newest ?? m.time, m.time);
      after = item.offset;
      if (total % 20 === 0)
        pulse({
          phase: "extracting",
          processed: total,
          files: assets.length,
          bytes,
        });
      if (bytes >= (conf.batchBytes || 134217728)) break;
    }
    fs.closeSync(writer);
    reader.assertUnchanged();
    const manifest = {
      format: "zalo-team-pc/1",
      version: "zalo-export-file/1",
      ...(conf.serverPreview ? { previewMode: "server-jxl/1" } : {}),
      accountId: conf.accountId,
      conversationId: conf.conversationId,
      name: conf.name,
      messages: {
        count: total,
        sha256: hash(fs.readFileSync(file)),
        oldest,
        newest,
      },
      assets,
      coverage: {
        source: "zalo-export-file",
        complete: issues.length === 0,
        messagesComplete: true,
        skipped: 0,
        mode: "file-import",
        scanned: total,
        missingFiles: issues.length,
        issues: issues.slice(0, 100),
      },
    };
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest));
    const hasMore = !!db
      .prepare("SELECT 1 FROM messages WHERE cid=? AND offset>? LIMIT 1")
      .get(conf.conversationId, after);
    return {
      timings: { ...timings, totalMs: performance.now() - started },
      after,
      hasMore,
      files: assets.length,
      bytes,
      messages: total,
      missing: issues.length,
      issues: issues.slice(0, 100),
    };
  } finally {
    try {
      fs.closeSync(writer);
    } catch {}
    db.close();
    reader.close();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const conf = JSON.parse(fs.readFileSync(0, "utf8"));
    const result =
      process.argv[2] === "index"
        ? indexExport(conf, emit)
        : await buildBundle(conf, emit);
    emit({ done: true, ...result });
  } catch (e) {
    process.stderr.write(
      /^FILE_[A-Z_]+$/.test(e.message) ? e.message : "FILE_PROCESS_FAILED",
    );
    process.exitCode = 1;
  }
}
