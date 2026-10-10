import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GroupActions, validGroup, nativeGroup } from "./group-actions.mjs";
import { validCommand } from "./guards.mjs";
const body = {
  owner: "a".repeat(64),
  action: "group-action",
  accountId: 1,
  conversationId: "1234567890",
  requestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  group: {
    kind: "create",
    members: ["1111111111", "2222222222"],
    name: "Test",
  },
};
test("group command rejects unrelated fields, duplicate members and missing request receipts", () => {
  assert.equal(validCommand(body), true);
  assert.equal(validCommand({ ...body, requestId: undefined }), false);
  assert.equal(
    validCommand({
      ...body,
      group: { ...body.group, members: ["111", "111"] },
    }),
    false,
  );
  assert.equal(
    validCommand({ ...body, group: { kind: "catalog" }, requestId: undefined }),
    true,
  );
  assert.equal(
    validCommand({ ...body, group: { kind: "catalog" }, text: "bad" }),
    false,
  );
  assert.equal(
    validGroup({
      kind: "create",
      members: ["111", "222"],
      name: "x",
      url: "bad",
    }),
    false,
  );
  assert.equal(
    validGroup({
      kind: "add",
      members: Array.from({ length: 51 }, (_, i) => String(i + 1)),
    }),
    false,
  );
});
test("durable group receipt prevents duplicate mutation and request reuse with different payload", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-group-test-"));
  let calls = 0;
  try {
    const run = new GroupActions(root, async (p, args) => {
      if (args.phase === "apply") {
        calls++;
        return { status: "confirmed", groupId: "g123" };
      }
      return { ready: true };
    });
    const first = await run.run(null, "42", body);
    assert.deepEqual(await run.run(null, "42", body), first);
    assert.equal(calls, 1);
    await assert.rejects(
      run.run(null, "42", { ...body, accountId: 2 }),
      /REQUEST_CONFLICT/,
    );
    await assert.rejects(
      run.run(null, "42", {
        ...body,
        group: { ...body.group, name: "Changed" },
      }),
      /REQUEST_CONFLICT/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("ambiguous mutation remains unknown and is never resubmitted, including after restart", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-group-test-"));
  let calls = 0;
  try {
    const adapter = async (p, args) => {
      if (args.phase === "apply") {
        calls++;
        throw Error("disconnected");
      }
      return { ready: true };
    };
    assert.equal(
      (await new GroupActions(root, adapter).run(null, "42", body)).status,
      "unknown",
    );
    assert.equal(
      (await new GroupActions(root, adapter).run(null, "42", body)).status,
      "unknown",
    );
    assert.equal(calls, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("native group adapter checks identity, visible conversation, membership and authoritative add result", async () => {
  let mutations = 0,
    fresh = false;
  const info = {
    memberIds: ["42", "111"],
    topMember: [{ id: "42" }, { id: "111" }],
    creatorId: "42",
    totalMember: 2,
    setting: {},
  };
  const users = {
    getFriendsSync: () => ({ 111: {}, 222: {} }),
    isBlocked: () => false,
    isOA: () => false,
    isZaloBot: () => false,
    isFriend: () => true,
    getProfileFriendSync: (id) => ({ zaloName: "Contact " + id }),
    getMiniInfo: () => null,
    getDName: (id) => "Contact " + id,
    getAvatar: () => undefined,
  };
  const modules = {
    dThN: {
      default: {
        userId: "42",
        createGroupV2: async (name, members, creator) => {
          assert.equal(creator, "42");
          assert.deepEqual(members.map(p => p.id), ["111", "222"]);
          return {conv: {userId: "g99", displayName: name}, errorInfo: {}};
        },
        addMemberToGroupV2: async () => {
          mutations++;
          return { errorInfo: {} };
        },
      },
    },
    UiPd: { default: users },
    Gm1y: {
      default: {
        getGroupByIdSync: () => info,
        getFullInfoGroupById: async (id, source) => {
          fresh = source === 9;
          return { ...info, memberIds: ["42", "111", "222"] };
        },
      },
    },
    jDHv: {
      ModuleContainer: { resolve: () => ({ getList: () => ["g77", "111"] }) },
    },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "main" },
    NMlV: { a: { next: () => "request-test" } },
    NDmK: { default: { settings: {}, sendToMeId: "42" } },
    "1pet": {
      MEMBERS_TRACKING_SOURCE: { friend: 1, searchPhoneGlobal: 2 },
      SRC_GET_PROFILE: { FORCE_GET: 9 },
    },
  };
  const require = {
    c: Object.fromEntries(
      Object.entries(modules).map(([key, exports]) => [key, { exports }]),
    ),
    m: {},
  };
  const previous = globalThis.webpackJsonp;
  globalThis.webpackJsonp = [];
  globalThis.webpackJsonp.push = (chunk) => {
    Object.values(chunk[1])[0]({}, {}, require);
    return Array.prototype.push.call(globalThis.webpackJsonp, chunk);
  };
  const page = {
    frames: () => [
      { url: () => "https://chat.zalo.me/", evaluate: (fn, args) => fn(args) },
    ],
  };
  const args = {
    expectedId: "42",
    conversationId: "g77",
    group: { kind: "add", members: ["222"] },
    phase: "apply",
  };
  try {
    const standalone = await nativeGroup(page, {expectedId: "42", group: {kind: "catalog"}, phase: "prepare"});
    assert.deepEqual(standalone.initial, []);
    assert.equal(standalone.canAdd, true);
    const created = await nativeGroup(page, {expectedId: "42", group: {kind: "create", name: "Standalone", members: ["111", "222"]}, phase: "apply"});
    assert.equal(created.status, "confirmed");
    assert.equal(created.groupId, "g99");
    await assert.rejects(
      nativeGroup(page, { ...args, expectedId: "43" }),
      /IDENTITY_MISMATCH/,
    );
    await assert.rejects(
      nativeGroup(page, { ...args, conversationId: "g88" }),
      /CONVERSATION_NOT_FOUND/,
    );
    await assert.rejects(
      nativeGroup(page, { ...args, group: { kind: "add", members: ["111"] } }),
      /MEMBER_INVALID/,
    );
    await assert.rejects(
      nativeGroup(page, { ...args, group: { kind: "add", members: ["999"] } }),
      /MEMBER_INVALID/,
    );
    assert.equal(mutations, 0);
    const result = await nativeGroup(page, args);
    assert.equal(result.status, "confirmed");
    assert.equal(fresh, true);
    assert.equal(mutations, 1);
    info.setting.addMemberOnly = true;
    info.creatorId = "111";
    await assert.rejects(nativeGroup(page, args), /PERMISSION_DENIED/);
    assert.equal(mutations, 1);
  } finally {
    globalThis.webpackJsonp = previous;
  }
});
