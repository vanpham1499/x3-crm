import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { Uploads, validUpload } from "./uploads.mjs";
import { SendReceipts } from "./send.mjs";
import { validCommand } from "./guards.mjs";
const meta = {
  owner: "a".repeat(64),
  accountId: 1,
  conversationId: "123",
  name: "test.txt",
  mime: "text/plain",
  size: 4,
  kind: "file",
};
test("upload stores exact bytes, binds account/conversation and rejects truncated or oversized streams", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-upload-test-"));
  try {
    const uploads = new Uploads(root);
    assert.ok(validUpload(meta));
    assert.equal(validUpload({ ...meta, name: "../bad" }), false);
    assert.equal(validUpload({ ...meta, size: 26 * 1024 * 1024 }), false);
    const { uploadId } = await uploads.stage(
      Readable.from([Buffer.from("te"), Buffer.from("st")]),
      meta,
    );
    const saved = await uploads.get(uploadId, meta, true);
    assert.equal(Buffer.from(saved.bytes, "base64").toString(), "test");
    for (const scope of [
      { ...meta, owner: "b".repeat(64) },
      { ...meta, accountId: 2 },
      { ...meta, conversationId: "456" },
    ])
      await assert.rejects(uploads.get(uploadId, scope), /SCOPE_MISMATCH/);
    await assert.rejects(uploads.get("../x", meta), /INVALID/);
    await assert.rejects(
      uploads.stage(Readable.from([Buffer.from("toomuch")]), meta),
      /TOO_LARGE/,
    );
    await assert.rejects(
      uploads.stage(Readable.from([Buffer.from("x")]), meta),
      /INVALID/,
    );
    assert.equal((await fs.readdir(root)).length, 2);
    const receiptRoot = path.join(root, "receipts");
    let submits = 0;
    const adapter = async (_page, args) =>
      args.phase === "prepare"
        ? { clientId: "123" }
        : (submits++, { status: "sent", messageId: "456" });
    const command = {
      action: "send-media",
      owner: meta.owner,
      accountId: 1,
      conversationId: "123",
      requestId: "12345678-1234-1234-1234-123456789abc",
      media: { uploadId },
    };
    assert.ok(validCommand(command));
    assert.equal(validCommand({ ...command, text: "extra" }), false);
    assert.equal(
      validCommand({ ...command, media: { uploadId, path: "/etc/passwd" } }),
      false,
    );
    await new SendReceipts(receiptRoot, adapter).send({}, "100", command);
    await new SendReceipts(receiptRoot, adapter).send({}, "100", command);
    assert.equal(submits, 1);
    await assert.rejects(
      new SendReceipts(receiptRoot, adapter).send({}, "100", {
        ...command,
        media: { uploadId: "22345678-1234-1234-1234-123456789abc" },
      }),
      /CONFLICT/,
    );
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("zt-upload-test-"));
    await fs.rm(root, { recursive: true, force: true });
  }
});
