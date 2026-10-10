import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  privacyInPage,
  validPrivacy,
  assertConversationNotHidden,
  conversationPrivacy,
} from "./conversation-privacy.mjs";
import fs from "node:fs/promises";
import path from "node:path";
const req = "12345678-1234-1234-1234-123456789abc";
test("destructive receipts survive retries and uncertain responses without a second native write", async () => {
  const base = path.resolve(".local");
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, "privacy-test-"));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = root;
  let writes = 0,
    fail = false;
  const page = {
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: async (fn, args) => {
          if (args.phase === "prepare") return {};
          writes++;
          if (fail) throw Error("NETWORK");
          return { status: "confirmed" };
        },
      },
    ],
  };
  const body = {
    owner: "a".repeat(64),
    accountId: 1,
    conversationId: "g42",
    settings: { kind: "clear-history", requestId: req },
  };
  try {
    assert.equal(
      (await conversationPrivacy(page, "123", body)).status,
      "confirmed",
    );
    assert.equal(
      (await conversationPrivacy(page, "123", body)).status,
      "confirmed",
    );
    assert.equal(writes, 1);
    await assert.rejects(
      conversationPrivacy(page, "123", { ...body, conversationId: "g43" }),
      /WEB_ACTION_REQUEST_CONFLICT/,
    );
    fail = true;
    const next = {
      ...body,
      settings: {
        ...body.settings,
        requestId: "22345678-1234-1234-1234-123456789abc",
      },
    };
    assert.equal(
      (await conversationPrivacy(page, "123", next)).status,
      "unknown",
    );
    assert.equal(
      (await conversationPrivacy(page, "123", next)).status,
      "unknown",
    );
    assert.equal(writes, 2);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    if (
      path.dirname(root) === base &&
      path.basename(root).startsWith("privacy-test-")
    )
      await fs.rm(root, { recursive: true, force: true });
  }
});
function fixture({ owner = true, hidden = false, pinSet = true } = {}) {
  const calls = [],
    hiddenIds = new Set(hidden ? ["g42"] : []);
  const modules = {
    dThN: {
      default: {
        userId: "123",
        reportUser: async (payload) => {
          calls.push(["report", payload]);
          return { data: { error_code: 0 } };
        },
      },
    },
    NDmK: {
      default: {
        sendToMeId: "self",
        ttl: { enable: true, durations: [0, 3600000, 86400000] },
        report_v2: { reason_other_id: 0 },
      },
    },
    EFQ6: {
      a: {
        isThreadHidden: (id) => hiddenIds.has(id),
        enableHiddenChat: () => true,
        getPIN: () => (pinSet ? "privatehash" : ""),
        isKeyPIN: (pin) => pin === "1234",
        changePIN: async () => {
          pinSet = true;
          calls.push(["pin"]);
        },
        getUidsHiddenChat: () => [...hiddenIds],
        updateItemHiddenChatMulti: async (add, del) => {
          add.forEach((id) => hiddenIds.add(id));
          del.forEach((id) => hiddenIds.delete(id));
          calls.push(["hide", add, del]);
        },
      },
    },
    jDHv: {
      ModuleContainer: { resolve: () => ({ getList: () => ["g42", "234"] }) },
    },
    iZzu: { ConvListController: "list" },
    "3xbP": { c: "main" },
    UiPd: { default: { getDName: () => "Person" } },
    Gm1y: {
      default: {
        getFullInfoGroupById: async () => ({ isGroup: true, userId: "g42" }),
        getDName: () => "Test group",
      },
    },
    BkFw: { c: () => [owner, owner ? undefined : "NOT_OWNER"] },
    TeAh: {
      c: {
        getRootConfig: () => ({
          chat: { config: { chat_privacy_ttl_durations: [86400000] } },
        }),
      },
    },
    vK0c: { a: () => 0 },
    "7upJ": {
      a: {
        getSortedAbuseList: () => [
          { id: 0, vi: "Lý do khác" },
          { id: 2, vi: "Làm phiền" },
        ],
        isOtherReason: (id) => id === 0,
      },
    },
    fBUP: {
      default: {
        updateAutoDeleteConvers: async (payload) => {
          calls.push(["ttl", payload]);
          return {};
        },
      },
    },
    kCOK: { a: (x) => x },
    ngSF: { a: { dispatch: async () => {} } },
    "1egx": { b: () => ({}) },
    smi1: {
      a: {
        deleteConversation: async (...args) => calls.push(["clear", ...args]),
      },
    },
    "1pet": { SRC_GET_PROFILE: { FORCE_GET: 1 } },
  };
  const require = (key) => modules[key];
  require.c = Object.fromEntries(
    Object.entries(modules).map(([k, exports]) => [k, { exports }]),
  );
  require.m = {};
  const chunks = [];
  chunks.push = (chunk) => {
    Array.prototype.push.call(chunks, chunk);
    Object.values(chunk[1])[0]({}, {}, require);
  };
  const context = vm.createContext({ webpackJsonp: chunks });
  return {
    calls,
    hiddenIds,
    run: (settings) =>
      vm.runInContext(
        `(${privacyInPage.toString()})`,
        context,
      )({ expectedId: "123", conversationId: "g42", settings, phase: "apply" }),
    evaluate: (fn, args) =>
      vm.runInContext(`(${fn.toString()})`, context)(args),
  };
}
test("strict privacy payloads reject extra keys, malformed PIN and unsupported duration", () => {
  for (const v of [
    { kind: "privacy" },
    { kind: "ttl", duration: 86400000 },
    { kind: "hide", pin: "1234", setup: true },
    { kind: "hidden-list", pin: "1234" },
    { kind: "clear-history", requestId: req },
    { kind: "report", reason: 2, content: "", requestId: req },
  ])
    assert.equal(validPrivacy(v), true);
  for (const v of [
    { kind: "privacy", pin: "1234" },
    { kind: "hide", pin: 1234 },
    { kind: "hide", pin: "12345" },
    { kind: "hide", pin: "1234", setup: false },
    { kind: "ttl", duration: 1 },
    { kind: "clear-history" },
    { kind: "report", reason: -1, content: "", requestId: req },
  ])
    assert.equal(validPrivacy(v), false);
});
test("catalog exposes labels and capabilities but no PIN or hidden identities", async () => {
  const f = fixture(),
    r = await f.run({ kind: "privacy" });
  assert.equal(r.hasPin, true);
  assert.equal(r.reasons[1].label, "Làm phiền");
  assert.equal(r.durations.find((x) => x.value === 3600000).enabled, false);
  assert.ok(!JSON.stringify(r).includes("privatehash"));
  assert.equal(f.calls.length, 0);
});
test("TTL enforces owner and subscription before one native update", async () => {
  await assert.rejects(
    fixture({ owner: false }).run({ kind: "ttl", duration: 86400000 }),
    /WEB_TTL_NOT_ALLOWED/,
  );
  const f = fixture();
  await assert.rejects(
    f.run({ kind: "ttl", duration: 3600000 }),
    /WEB_TTL_NOT_ALLOWED/,
  );
  await f.run({ kind: "ttl", duration: 86400000 });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0][1])), {
    threadId: "42",
    isGroup: 1,
    ttl: 86400000,
  });
});
test("hidden list requires PIN, rate limits invalid attempts, no credential replacement", async () => {
  const f = fixture();
  await assert.rejects(
    f.run({ kind: "hide", pin: "1234", setup: true }),
    /WEB_PIN_ALREADY_SET/,
  );
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      f.run({ kind: "hidden-list", pin: "0000" }),
      /WEB_PIN_INVALID/,
    );
  await assert.rejects(
    f.run({ kind: "hidden-list", pin: "1234" }),
    /WEB_PIN_RATE_LIMIT/,
  );
  assert.equal(f.calls.length, 0);
});
test("hide and unhide use native IDs; stale reads blocked while hidden", async () => {
  const f = fixture();
  await f.run({ kind: "hide", pin: "1234" });
  assert.equal(f.hiddenIds.has("g42"), true);
  const page = {
    frames: () => [
      { url: () => "https://chat.zalo.me/", evaluate: f.evaluate },
    ],
  };
  await assert.rejects(
    assertConversationNotHidden(page, "123", "g42"),
    /WEB_CONVERSATION_HIDDEN/,
  );
  await assert.rejects(f.run({ kind: "privacy" }), /WEB_CONVERSATION_HIDDEN/);
  assert.equal(
    (await f.run({ kind: "hidden-list", pin: "1234" })).hiddenConversations
      .length,
    1,
  );
  await f.run({ kind: "unhide", pin: "1234", targetId: "g42" });
  assert.equal(f.hiddenIds.size, 0);
  await assertConversationNotHidden(page, "123", "g42");
});
test("report only explicit reason, never blocks or deletes implicitly; clear uses native delete", async () => {
  const f = fixture();
  await assert.rejects(
    f.run({ kind: "report", reason: 0, content: "", requestId: req }),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    f.run({ kind: "report", reason: 99, content: "", requestId: req }),
    /INVALID_REQUEST/,
  );
  await f.run({ kind: "report", reason: 2, content: "", requestId: req });
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [
    ["report", { uidTo: "42", type: 14, reason: 2, content: "" }],
  ]);
  await f.run({ kind: "clear-history", requestId: req });
  assert.deepEqual(f.calls[1], ["clear", "g42", false]);
});
