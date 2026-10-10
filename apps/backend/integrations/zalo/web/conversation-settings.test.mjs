import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  conversationSettings,
  validSettings,
} from "./conversation-settings.mjs";
import { validCommand } from "./guards.mjs";
function fixture() {
  const state = { name: "Duy", alias: "", muted: false, pinned: false, unread: false, count: 0 },
    calls = [];
  const mods = {
    PGx3: {
      b: () => state.unread,
      d: async (target) => { calls.push(["unread", target.userId]); state.unread = true; },
    },
    dThN: {
      default: {
        userId: "1",
        changeGroupName: async (id, name) => {
          calls.push(["group", id, name]);
          state.name = name;
        },
      },
    },
    jDHv: {
      ModuleContainer: { resolve: () => ({ getList: () => ["2", "g3"] }) },
    },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "main" },
    Gm1y: {
      default: { getGroupByIdSync: () => ({ displayName: state.name }) },
    },
    UiPd: {
      default: {
        getDName: () => state.name,
        getAliasName: () => state.alias,
        setAliasName: async (id, name) => {
          calls.push(["rename", id, name]);
          state.alias = name;
          state.name = name || "Duy";
        },
      },
    },
    QPNp: {
      a: {
        ConvInfoDataManager: { getConvByIdSync: (id) => ({ userId: id, numMsg: 2 }) },
        UnreadDataManager: {
          getUnreadByConvIdSync: () => ({ smsUnreadCount: state.count }),
          onClearUnreadConversations: (targets) => {
            calls.push(["read", targets[0].userId]);
            state.unread = false;
            state.count = 0;
          },
        },
        PinDataManager: {
          isPinned: () => state.pinned,
          getLimitPinnedConversation: () => 5,
          getTotalPinnedConversation: () => 0,
          pin: async (ids) => {
            calls.push(["pin", ...ids]);
            state.pinned = true;
          },
          unpin: async (ids) => {
            calls.push(["unpin", ...ids]);
            state.pinned = false;
          },
        },
        MuteDataManager: {
          isMuted: () => state.muted,
          onMute: async (id, mode) => {
            calls.push(["mute", id, mode]);
            state.muted = true;
          },
          onUnMute: async (id) => {
            calls.push(["unmute", id]);
            state.muted = false;
          },
        },
      },
    },
  };
  const req = {
    c: Object.fromEntries(
      Object.entries(mods).map(([k, v]) => [k, { exports: v }]),
    ),
    m: {},
  };
  const chunks = [];
  chunks.push = (c) => {
    Array.prototype.push.call(chunks, c);
    Object.values(c[1])[0]({}, {}, req);
  };
  const context = vm.createContext({ webpackJsonp: chunks });
  return {
    state,
    calls,
    page: {
      frames: () => [
        {
          url: () => "https://chat.zalo.me/",
          evaluate: (fn, arg) => vm.runInContext(`(${fn})`, context)(arg),
        },
      ],
    },
  };
}
test("strict settings contract and account scope", () => {
  const base = {
    action: "conversation-settings",
    owner: "a".repeat(64),
    accountId: 1,
    conversationId: "2",
    settings: { kind: "read" },
  };
  assert.ok(validCommand(base));
  for (const settings of [
    { kind: "mute", mode: 9 },
    { kind: "pin", pinned: 1 },
    { kind: "rename", name: "a".repeat(51) },
    { kind: "rename", name: "x\ny" },
    { kind: "read", extra: 1 },
    { kind: "unread", unread: 1 },
    { kind: "unread", unread: true, accountId: 2 },
  ])
    assert.equal(validSettings(settings), false);
  assert.equal(validCommand({ ...base, accountId: undefined }), false);
  assert.equal(validCommand({ ...base, conversationId: "abc" }), false);
  assert.equal(validCommand({ ...base, action: "status" }), false);
});

test("read/unread uses the target native conversation and avoids repeating confirmed changes", async () => {
  const f = fixture();
  const run = (unread) => conversationSettings(f.page, "1", {
    conversationId: "g3", settings: { kind: "unread", unread },
  });
  assert.equal((await run(true)).unread, true);
  await run(true);
  assert.deepEqual(f.calls, [["unread", "g3"]]);
  assert.equal((await run(false)).unread, false);
  f.state.count = 3;
  assert.equal((await run(false)).unread, false);
  assert.deepEqual(f.calls.slice(1), [["read", "g3"], ["read", "g3"]]);
  await assert.rejects(conversationSettings(f.page, "other-account", {
    conversationId: "g3", settings: { kind: "unread", unread: true },
  }), /IDENTITY_MISMATCH/);
  assert.equal(f.calls.length, 3);
});
test("native rename, all mute durations, explicit pin/unpin are account bound", async () => {
  const f = fixture(),
    run = (settings) =>
      conversationSettings(f.page, "1", { conversationId: "2", settings });
  assert.equal(
    (await run({ kind: "rename", name: " Duy test " })).name,
    "Duy test",
  );
  for (const mode of [1, 2, 3, 4])
    assert.equal((await run({ kind: "mute", mode })).muted, true);
  assert.equal((await run({ kind: "mute", mode: 0 })).muted, false);
  assert.equal((await run({ kind: "pin", pinned: true })).pinned, true);
  await run({ kind: "pin", pinned: true });
  assert.equal(f.calls.filter((c) => c[0] === "pin").length, 1);
  assert.equal((await run({ kind: "pin", pinned: false })).pinned, false);
  assert.equal((await run({ kind: "rename", name: "" })).name, "Duy");
  await assert.rejects(
    conversationSettings(f.page, "9", {
      conversationId: "2",
      settings: { kind: "pin", pinned: true },
    }),
    /IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    conversationSettings(f.page, "1", {
      conversationId: "99",
      settings: { kind: "read" },
    }),
    /CONVERSATION_NOT_FOUND/,
  );
  assert.ok(f.calls.every((c) => c[1] === "2"));
});
test("group name delegates to native permission enforcing API", async () => {
  const f = fixture();
  const result = await conversationSettings(f.page, "1", {
    conversationId: "g3",
    settings: { kind: "rename", name: "Group test" },
  });
  assert.equal(result.name, "Group test");
  assert.deepEqual(f.calls, [["group", "g3", "Group test"]]);
});
