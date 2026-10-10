import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import vm from "node:vm";
import { MessageActions, nativeAction } from "./message-actions.mjs";
import { validCommand } from "./guards.mjs";
import { normalizeMessage } from "./messages.mjs";
const body = {
  action: "message-action",
  owner: "a".repeat(64),
  accountId: 1,
  conversationId: "200",
  messageId: "300",
  operation: "star",
  requestId: crypto.randomUUID(),
};
test("message actions reject foreign shapes, injected IDs and arbitrary reactions; reply is only a native ID", () => {
  assert.ok(validCommand(body));
  for (const patch of [
    { messageId: 3 },
    { conversationId: "x" },
    { accountId: undefined },
    { operation: "execute" },
    { reaction: 3 },
    { replyTo: "300" },
    { text: "bad" },
    { requestId: undefined },
    { messageId: "3;alert(1)" },
  ])
    assert.equal(
      validCommand({ ...body, ...patch }),
      false,
      JSON.stringify(patch),
    );
  assert.ok(validCommand({ ...body, operation: "react", reaction: 5 }));
  assert.equal(
    validCommand({ ...body, operation: "react", reaction: 500 }),
    false,
  );
  const send = {
    action: "send-text",
    owner: body.owner,
    accountId: 1,
    conversationId: "200",
    text: "reply",
    requestId: body.requestId,
    replyTo: "300",
  };
  assert.ok(validCommand(send));
  assert.equal(
    validCommand({ ...send, replyTo: { id: "300", fromUid: "999" } }),
    false,
  );
});
test("action receipt survives restart and ambiguous outcomes never repeat writes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zt-action-test-"));
  let writes = 0;
  const adapter = async (_, a) => {
    if (a.phase === "prepare") return {};
    writes++;
    throw Error("lost response");
  };
  try {
    assert.equal(
      (await new MessageActions(root, adapter).run({}, "100", body)).status,
      "unknown",
    );
    assert.equal(
      (await new MessageActions(root, adapter).run({}, "100", body)).status,
      "unknown",
    );
    assert.equal(writes, 1);
    await assert.rejects(
      new MessageActions(root, adapter).run({}, "100", {
        ...body,
        conversationId: "201",
      }),
      /CONFLICT/,
    );
    await assert.rejects(
      new MessageActions(root, adapter).run({}, "100", {
        ...body,
        operation: "delete",
      }),
      /CONFLICT/,
    );
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.ok(path.basename(root).startsWith("zt-action-test-"));
    await fs.rm(root, { recursive: true });
  }
});
function fixture(patch = {}) {
  let m = {
    msgId: "300",
    toUid: "200",
    fromUid: "0",
    sendDttm: Date.now(),
    msgType: 1,
    message: "test",
    ...patch,
  };
  let mutations = [];
  const exports = {
    dThN: {
      default: {
        userId: "100",
        undoMessage: async (...a) => mutations.push(["recall", ...a]),
      },
    },
    XS0u: {
      default: {
        getMessage: async () => m,
        addStarMessages: async () => {
          m.staredDttm = 123;
        },
        shouldSaveTsStarMsgSchemaChanged() {},
        unstaredMessages: async () => {
          delete m.staredDttm;
        },
      },
    },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["200"] }) } },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "all" },
    "1pet": { MSG_UNDO: 2, MSG_DEL_EVERYONE: 3, MSG_E2EE: 1 },
    bUXd: { default: { getTimeNow: Date.now } },
    NDmK: { default: { recallMessageMaxTime: 60000 } },
    NMlV: { a: { next: () => 42 } },
    sg3c: { f: () => 0 },
    smi1: {
      a: {
        deleteMsgsNotUndo: async (conv, rows, sync) => {
          mutations.push(["delete", conv, rows[0].msgId, sync]);
          m = undefined;
        },
      },
    },
    jW2l: {
      a: { send: async (...args) => mutations.push(["react", ...args]) },
    },
  };
  const require = {
    c: Object.fromEntries(
      Object.entries(exports).map(([k, exports]) => [k, { exports }]),
    ),
    m: {},
  };
  const chunks = [];
  chunks.push = (chunk) => {
    Array.prototype.push.call(chunks, chunk);
    Object.values(chunk[1])[0]({}, {}, require);
  };
  const context = vm.createContext({ webpackJsonp: chunks, crypto, console });
  return {
    page: {
      frames: () => [
        {
          url: () => "https://chat.zalo.me/",
          evaluate: (fn, a) => vm.runInContext(`(${fn})`, context)(a),
        },
      ],
    },
    mutations,
  };
}
test("native mutations validate identity, conversation, target and recall ownership before changing data", async () => {
  const args = {
    expectedId: "100",
    conversationId: "200",
    messageId: "300",
    operation: "recall",
    phase: "apply",
  };
  for (const [patch, over, error] of [
    [{}, { expectedId: "999" }, /IDENTITY/],
    [{}, { conversationId: "999" }, /CONVERSATION/],
    [{ toUid: "999" }, {}, /MESSAGE_NOT_FOUND/],
    [{ fromUid: "999" }, {}, /RECALL_NOT_ALLOWED/],
    [{ sendDttm: 1 }, {}, /RECALL_NOT_ALLOWED/],
  ]) {
    const f = fixture(patch);
    await assert.rejects(nativeAction(f.page, { ...args, ...over }), error);
    assert.equal(f.mutations.length, 0);
  }
  const f = fixture();
  assert.equal((await nativeAction(f.page, args)).status, "done");
  assert.equal(f.mutations[0][0], "recall");
  const d = fixture();
  await nativeAction(d.page, { ...args, operation: "delete" });
  assert.deepEqual(d.mutations[0], ["delete", "200", "300", false]);
  const r = fixture();
  await nativeAction(r.page, { ...args, operation: "react", reaction: 5 });
  assert.equal(r.mutations[0][3].rIcon, "/-heart");
});
test("history preserves numeric quote IDs and sums native reactions without exposing sender maps", () => {
  const m = normalizeMessage({
    id: "1",
    type: "MSG_TEXT",
    message: "Test",
    quote: { msgId: 300, fromD: "Me", msg: "Original" },
    starred: true,
    reactions: { 0: { 5: 2 }, 999: { 5: 1, 3: 1 } },
  });
  assert.equal(m.quote.id, "300");
  assert.equal(m.starred, true);
  assert.deepEqual(
    m.reactions.map(({ type, count, mine }) => ({ type, count, mine })),
    [
      { type: 3, count: 1, mine: false },
      { type: 5, count: 3, mine: true },
    ],
  );
  const recalled = normalizeMessage({
    id: "2",
    type: "MSG_UNDO",
    mine: true,
    canRecall: true,
    starred: true,
    reactions: { 0: { 3: 1 } },
  });
  assert.equal(recalled.kind, "recalled");
  assert.equal(recalled.mine, true);
  assert.equal(recalled.canRecall, false);
  assert.equal(recalled.starred, false);
  assert.deepEqual(recalled.reactions, []);
});
