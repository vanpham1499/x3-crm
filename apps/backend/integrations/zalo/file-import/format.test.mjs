import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCipheriv, createHash } from "node:crypto";
import { ExportReader, tarIndex } from "./format.mjs";
import { indexExport, buildBundle } from "./import.mjs";
const secret = {
  key: Buffer.alloc(32, 1).toString("base64"),
  iv: Buffer.alloc(16, 2).toString("base64"),
  constants: [
    ["MSG_TEXT", 1],
    ["MSG_FILE", 19],
  ],
};
function tar(entries) {
  const chunks = [];
  for (const [name, data] of entries) {
    const b = Buffer.from(data),
      h = Buffer.alloc(512);
    h.write(name);
    h.write("0000644\0", 100);
    h.write(b.length.toString(8).padStart(11, "0") + "\0", 124);
    h.fill(32, 148, 156);
    h.write("0", 156);
    h.write("ustar\0", 257);
    h.write(
      [...h]
        .reduce((a, b) => a + b, 0)
        .toString(8)
        .padStart(6, "0") + "\0 ",
      148,
    );
    chunks.push(h, b, Buffer.alloc((512 - (b.length % 512)) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}
function fixture(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zt-file-test-")),
    source = path.join(root, "test.zl.zip");
  const c = createCipheriv(
    "aes-256-cbc",
    Buffer.from(secret.key, "base64"),
    Buffer.from(secret.iv, "base64"),
  );
  fs.writeFileSync(source, Buffer.concat([c.update(tar(entries)), c.final()]));
  return { root, source, secret, accountId: "123", accountName: "Test" };
}
function clean(conf) {
  const resolved = path.resolve(conf.root);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith("zt-file-test-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
function msg(id = "1") {
  return {
    msgId: id,
    cliMsgId: "1700000000000",
    toUid: "456",
    fromUid: "456",
    dName: "Contact",
    sendDttm: "1700000000000",
    msgType: 1,
    message: "test",
  };
}
const db = "123/ZaloDownloads/database/123_zmessage.zdb";
test("bounded CBC random reads and account/key mismatch fail closed", () => {
  const conf = fixture([[db, JSON.stringify(msg()) + "\n"]]);
  try {
    const r = new ExportReader(conf.source, secret, "123");
    assert.equal(tarIndex(r).length, 1);
    assert.deepEqual(r.read(517, 13), r.read(512, 40).subarray(5, 18));
    assert.throws(() => r.read(0, 5 * 1024 * 1024), /BOUNDS/);
    r.close();
    assert.throws(
      () => new ExportReader(conf.source, secret, "999"),
      /KEY_MISMATCH/,
    );
    assert.throws(
      () =>
        new ExportReader(
          conf.source,
          { ...secret, key: Buffer.alloc(32, 3).toString("base64") },
          "123",
        ),
      /KEY_MISMATCH/,
    );
  } finally {
    clean(conf);
  }
});
test("archive traversal and corrupt header never create extracted files", () => {
  for (const name of ["123/../bad", "123/C:/bad", "123/\\bad"]) {
    const c = fixture([[name, "data"]]);
    try {
      const r = new ExportReader(c.source, secret, "123");
      assert.throws(() => tarIndex(r), /UNSAFE/);
      r.close();
    } finally {
      clean(c);
    }
  }
});
test("index counts exact duplicates once and bundles preserve native identity", async () => {
  const row = JSON.stringify(msg());
  const c = fixture([[db, row + "\n" + row + "\n"]]);
  try {
    const info = indexExport(c);
    assert.equal(info.messages, 1);
    assert.equal(info.duplicates, 1);
    assert.equal(info.conversations[0].name, "Contact");
    const b = await buildBundle({
      ...c,
      conversationId: "456",
      name: "Contact",
    });
    assert.equal(b.messages, 1);
    assert.equal(b.hasMore, false);
    const m = JSON.parse(
      fs.readFileSync(path.join(c.root, "bundle/messages.jsonl"), "utf8"),
    );
    assert.equal(m.id, "1");
    assert.equal(m.sender.name, "Contact");
    assert.equal(m.archiveFileImport, true);
    assert.equal(m.canRecall, false);
  } finally {
    clean(c);
  }
});
test("conflicting duplicate records and source modification block import", async () => {
  const c = fixture([
    [
      db,
      JSON.stringify(msg()) +
        "\n" +
        JSON.stringify({ ...msg(), message: "changed" }) +
        "\n",
    ],
  ]);
  try {
    assert.throws(() => indexExport(c), /DUPLICATE_CONFLICT/);
  } finally {
    clean(c);
  }
  const d = fixture([[db, JSON.stringify(msg()) + "\n"]]);
  try {
    indexExport(d);
    fs.utimesSync(d.source, new Date(), new Date(Date.now() + 10000));
    await assert.rejects(
      buildBundle({ ...d, conversationId: "456", name: "Contact" }),
      /CHANGED/,
    );
  } finally {
    clean(d);
  }
});
test("fileNoise is decoded with checksum; absent or oversized files are not reported saved", async () => {
  const data = Buffer.from("%PDF-1.7\nexample archive attachment"),
    checksum = createHash("md5").update(data).digest("hex");
  const encoded = Buffer.from(data);
  for (let i = 0; i < Math.min(100, encoded.length); i++) encoded[i] ^= 147;
  const row = {
    ...msg(),
    msgType: 19,
    message: {
      title: "sample.pdf",
      params: JSON.stringify({ fileSize: data.length, checksum }),
    },
  };
  const c = fixture([
    [db, JSON.stringify(row) + "\n"],
    [
      "123/ZaloDownloads/fileNoise/" + checksum,
      Buffer.concat([encoded, Buffer.from("077a416c4f07", "hex")]),
    ],
  ]);
  try {
    indexExport(c);
    const b = await buildBundle({
      ...c,
      conversationId: "456",
      name: "Contact",
    });
    assert.equal(
      b.files,
      1,
      fs.readFileSync(path.join(c.root, "bundle/manifest.json"), "utf8"),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(c.root, "bundle/manifest.json")),
    );
    assert.deepEqual(
      fs.readFileSync(
        path.join(c.root, "bundle/blobs", manifest.assets[0].hash),
      ),
      data,
    );
    await assert.rejects(
      buildBundle({ ...c, conversationId: "456", name: "Contact", budget: 1 }),
      /UPLOAD_LIMIT/,
    );
  } finally {
    clean(c);
  }
});

test("missing, oversized and damaged attachments remain explicit incomplete results", async () => {
  const data = Buffer.from("%PDF-1.7\nverified"),
    checksum = createHash("md5").update(data).digest("hex");
  const row = {
    ...msg(),
    msgType: 19,
    message: {
      title: "sample.pdf",
      params: JSON.stringify({ fileSize: data.length, checksum }),
    },
  };
  const encoded = Buffer.from(data);
  for (let i = 0; i < encoded.length; i++) encoded[i] ^= 147;
  for (const mode of ["missing", "oversized", "damaged"]) {
    const entries = [[db, JSON.stringify(row) + "\n"]];
    if (mode !== "missing")
      entries.push([
        "123/ZaloDownloads/fileNoise/" + checksum,
        Buffer.concat([
          mode === "damaged" ? Buffer.alloc(data.length) : encoded,
          Buffer.from("077a416c4f07", "hex"),
        ]),
      ]);
    const c = fixture(entries);
    try {
      indexExport(c);
      const b = await buildBundle({
        ...c,
        conversationId: "456",
        name: "Contact",
        maxFileBytes: mode === "oversized" ? 1 : undefined,
      });
      assert.equal(b.files, 0);
      assert.equal(b.missing, 1);
      assert.equal(
        b.issues[0].reason,
        {
          missing: "FILE_NOT_IN_EXPORT",
          oversized: "FILE_ASSET_LIMIT",
          damaged: "FILE_ASSET_CHECKSUM",
        }[mode],
      );
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(c.root, "bundle/manifest.json")))
          .coverage.complete,
        false,
      );
    } finally {
      clean(c);
    }
  }
});

test("batch cursor resumes without duplicate rows; stop preserves source and index", async () => {
  const records = Array.from({ length: 260 }, (_, i) =>
    JSON.stringify({
      ...msg(String(i + 1)),
      cliMsgId: String(1700000000000 + i),
    }),
  );
  const c = fixture([[db, records.join("\n") + "\n"]]);
  try {
    indexExport(c);
    const first = await buildBundle({
      ...c,
      conversationId: "456",
      name: "Contact",
    });
    assert.equal(first.messages, 250);
    assert.equal(first.hasMore, true);
    fs.writeFileSync(path.join(c.root, "stop"), "1");
    await assert.rejects(
      buildBundle({
        ...c,
        conversationId: "456",
        name: "Contact",
        after: first.after,
      }),
      /STOPPED/,
    );
    fs.unlinkSync(path.join(c.root, "stop"));
    const last = await buildBundle({
      ...c,
      conversationId: "456",
      name: "Contact",
      after: first.after,
    });
    assert.equal(last.messages, 10);
    assert.equal(last.hasMore, false);
    const larger = await buildBundle({...c, conversationId:'456', name:'Contact', batchMessages:1000, serverPreview:true});
    assert.equal(larger.messages,260);
    assert.equal(larger.hasMore,false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(c.root,'bundle/manifest.json'))).previewMode,'server-jxl/1');
    assert.ok(fs.existsSync(c.source));
  } finally {
    clean(c);
  }
});
