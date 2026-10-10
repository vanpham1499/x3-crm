import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SendReceipts } from "./send.mjs";
import { validCommand } from "./guards.mjs";
const body = {
  action: "send-text",
  owner: "a".repeat(64),
  accountId: 1,
  conversationId: "123",
  requestId: "12345678-1234-1234-1234-123456789abc",
  text: "Thử tiếng Việt 😊\nDòng hai",
};

test('campaign reconciliation never creates a missing receipt or sends again', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'zt-campaign-check-'));
  let sends=0;
  const adapter=async (_page,args)=>{
    if(args.phase==='prepare')return {clientId:'123'};
    if(args.phase==='check')return {status:'sent',messageId:'456'};
    sends++;throw Error('lost acknowledgement');
  };
  try {
    assert.ok(validCommand({...body,checkOnly:true}));
    assert.equal(validCommand({...body,checkOnly:false}),false);
    const store=new SendReceipts(dir,adapter);
    assert.equal((await store.send({},'100',{...body,checkOnly:true})).status,'unknown');
    assert.equal(sends,0);
    await store.send({},'100',body);
    assert.equal((await new SendReceipts(dir,adapter).send({},'100',{...body,checkOnly:true})).status,'sent');
    assert.equal(sends,1);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test("sticker commands accept only native IDs and preserve durable idempotence", async () => {
  const sticker = {
    ...body,
    action: "send-sticker",
    sticker: { id: 1, categoryId: 0 },
  };
  delete sticker.text;
  assert.ok(validCommand(sticker));
  for (const patch of [
    { sticker: null },
    { text: "oops" },
    { sticker: { id: 1, categoryId: 0, url: "https://example.com" } },
    { sticker: { id: 0, categoryId: 0 } },
    { sticker: { id: 1, categoryId: 0.5 } },
  ])
    assert.equal(validCommand({ ...sticker, ...patch }), false);
  const catalog = {
    action: "expressions",
    owner: body.owner,
    accountId: 1,
    conversationId: "123",
  };
  assert.ok(validCommand({ ...catalog, categoryId: 0 }));
  assert.ok(validCommand({ ...catalog, query: "haha" }));
  assert.equal(validCommand({ ...catalog, query: "a".repeat(101) }), false);
  assert.equal(
    validCommand({ ...catalog, conversationId: "https://example.com" }),
    false,
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-sticker-test-"));
  let sends = 0;
  const adapter = async (_page, args) => {
    assert.deepEqual(args.sticker, sticker.sticker);
    if (args.phase === "prepare") return { clientId: "123" };
    sends++;
    return { status: "sent", messageId: "456" };
  };
  try {
    const store = new SendReceipts(root, adapter);
    await store.send({}, "100", sticker);
    await new SendReceipts(root, adapter).send({}, "100", sticker);
    assert.equal(sends, 1);
    await assert.rejects(
      store.send({}, "100", { ...sticker, sticker: { id: 2, categoryId: 0 } }),
      /CONFLICT/,
    );
    await assert.rejects(store.send({}, "100", body), /CONFLICT/);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("zt-sticker-test-"));
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("prepared client ID is emitted after durable receipt and before send acknowledgement", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-send-progress-"));
  let complete, started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const pending = new Promise((resolve) => {
    complete = resolve;
  });
  const events = [];
  const receipts = new SendReceipts(root, async (_page, args) => {
    if (args.phase === "prepare") return { clientId: "123" };
    started();
    await pending;
    return { status: "sent", clientId: "123", messageId: "456" };
  });
  try {
    const result = receipts.send({}, "100", body, (packet) =>
      events.push(packet),
    );
    await waiting;
    assert.equal(events.length, 1);
    assert.equal(events[0].status, "prepared");
    assert.equal(events[0].clientId, "123");
    const files = await fs.readdir(root);
    const saved = JSON.parse(
      await fs.readFile(path.join(root, files[0]), "utf8"),
    );
    assert.equal(saved.result.status, "unknown");
    complete();
    assert.equal((await result).status, "sent");
  } finally {
    complete();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("zt-send-progress-"));
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("send validation scopes text and IDs, rejects extra browser inputs", () => {
  assert.ok(validCommand(body));
  for (const patch of [
    { text: "" },
    { text: " " },
    { text: "a".repeat(2001) },
    { text: {} },
    { accountId: 0 },
    { requestId: 1 },
    { conversationId: "https://zalo.me" },
    { url: "https://evil.test" },
    { action: "messages" },
  ])
    assert.ok(!validCommand({ ...body, ...patch }));
});
test("send receipt survives restart, binds recipient/content and never resubmits unknown outcome", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-send-test-"));
  let writes = 0;
  const adapter = async (_page, args) => {
    if (args.phase === "prepare") return { clientId: "100" };
    if (args.phase === "check") return { status: "unknown" };
    writes++;
    return { status: "sent", messageId: "200" };
  };
  try {
    const store = new SendReceipts(dir, adapter);
    assert.equal((await store.send({}, "123", body)).status, "sent");
    assert.equal(
      (await new SendReceipts(dir, adapter).send({}, "123", body)).messageId,
      "200",
    );
    assert.equal(writes, 1);
    for (const patch of [
      { conversationId: "456" },
      { accountId: 2 },
      { text: "changed" },
    ])
      await assert.rejects(
        store.send({}, "123", { ...body, ...patch }),
        /CONFLICT/,
      );
    const lost = new SendReceipts(dir, async (p, args) =>
      args.phase === "send"
        ? (writes++, Promise.reject(Error("network")))
        : adapter(p, args),
    );
    const unknown = {
      ...body,
      requestId: "22345678-1234-1234-1234-123456789abc",
    };
    assert.equal((await lost.send({}, "123", unknown)).status, "unknown");
    assert.equal(
      (await new SendReceipts(dir, adapter).send({}, "123", unknown)).status,
      "unknown",
    );
    assert.equal(writes, 2);
    const files = await fs.readdir(dir);
    for (const file of files)
      assert.ok(
        !(await fs.readFile(path.join(dir, file), "utf8")).includes(body.text),
      );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
