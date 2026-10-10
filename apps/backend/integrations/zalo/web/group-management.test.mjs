import test from "node:test";
import assert from "node:assert/strict";
import { manageGroupInPage } from "./group-management.mjs";
import { validGroup } from "./group-actions.mjs";

async function fixture(run) {
  const state = {
    creatorId: "1",
    memberIds: ["1", "2", "3", "4"],
    adminIds: ["2"],
  };
  const calls = [];
  let fail = "";
  const mutate =
    (name, fn) =>
    async (...args) => {
      calls.push([name, ...args]);
      if (fail === name) throw Error("offline");
      fn?.(...args);
    };
  const groups = {
    getFullInfoGroupById: async (id, source) => {
      assert.equal(id, "g77");
      assert.ok(source === 9 || source === undefined);
      return structuredClone(state);
    },
    addGroupAdmin: mutate("promote", (id, uids) =>
      state.adminIds.push(...uids),
    ),
    removeGroupAdmin: mutate("demote", (id, uids) => {
      state.adminIds = state.adminIds.filter((id) => !uids.includes(id));
    }),
  };
  const fetcher = {
    userId: "1",
    removeMemberFromGroup: mutate("remove", (id, users) => {
      state.memberIds = state.memberIds.filter(
        (id) => !users.some((u) => u.id === id),
      );
    }),
    changeGroupOwner: mutate("transfer", (id, uid) => {
      assert.equal(id, "77");
      state.creatorId = uid;
    }),
    leaveGroup: mutate("leave", (id, silent) => {
      assert.equal(id, "g77");
      assert.equal(silent, 0);
    }),
  };
  const modules = {
    dThN: { default: fetcher },
    Gm1y: { default: groups },
    UiPd: { default: { isZaloBot: (id) => id === "4" } },
    jDHv: { ModuleContainer: { resolve: () => ({ getList: () => ["g77"] }) } },
    iZzu: { ConvListController: {} },
    "3xbP": { c: "main" },
    "1pet": { SRC_GET_PROFILE: { FORCE_GET: 9 } },
  };
  const require = {
    c: Object.fromEntries(
      Object.entries(modules).map(([k, exports]) => [k, { exports }]),
    ),
    m: {},
  };
  const previous = globalThis.webpackJsonp;
  globalThis.webpackJsonp = [];
  globalThis.webpackJsonp.push = (chunk) => {
    Object.values(chunk[1])[0]({}, {}, require);
    return Array.prototype.push.call(globalThis.webpackJsonp, chunk);
  };
  const command = (group, options = {}) =>
    manageGroupInPage({
      expectedId: fetcher.userId,
      conversationId: "g77",
      group,
      phase: "apply",
      ...options,
    });
  try {
    await run({
      state,
      calls,
      fetcher,
      groups,
      command,
      fail: (name) => {
        fail = name;
      },
    });
  } finally {
    globalThis.webpackJsonp = previous;
  }
}
test("management accepts only scoped commands", () => {
  for (const kind of ["promote", "demote", "remove"]) {
    assert.equal(validGroup({ kind, memberId: "123" }), true);
    for (const value of [
      { kind, memberId: 123 },
      { kind, memberId: "g123" },
      { kind, memberId: "123", owner: "1" },
      { kind, members: ["123"] },
    ])
      assert.equal(validGroup(value), false);
  }
  assert.equal(validGroup({ kind: "leave" }), true);
  assert.equal(validGroup({ kind: "leave", successorId: "2" }), true);
  assert.equal(validGroup({ kind: "leave", successorId: "" }), false);
  assert.equal(validGroup({ kind: "leave", deleteHistory: true }), false);
});
test("fresh native identity, visibility and membership are required before writes", () =>
  fixture(async (f) => {
    await assert.rejects(
      f.command({ kind: "remove", memberId: "3" }, { expectedId: "9" }),
      /IDENTITY_MISMATCH/,
    );
    await assert.rejects(
      f.command({ kind: "remove", memberId: "3" }, { conversationId: "g88" }),
      /NOT_FOUND/,
    );
    f.state.memberIds = ["2", "3"];
    await assert.rejects(f.command({ kind: "leave" }), /PERMISSION/);
    assert.equal(f.calls.length, 0);
  }));
test("owner can promote/demote, excluding self, owner, absent members and bots", () =>
  fixture(async (f) => {
    for (const memberId of ["1", "4", "9"])
      await assert.rejects(
        f.command({ kind: "promote", memberId }),
        /PERMISSION|INVALID/,
      );
    assert.equal(
      (await f.command({ kind: "promote", memberId: "3" })).status,
      "confirmed",
    );
    assert.equal(
      (await f.command({ kind: "demote", memberId: "3" })).status,
      "confirmed",
    );
    assert.deepEqual(
      f.calls.map((c) => c[0]),
      ["promote", "demote"],
    );
  }));
test("deputy may remove ordinary member but cannot change roles or remove owner/peer", () =>
  fixture(async (f) => {
    f.fetcher.userId = "2";
    f.state.adminIds.push("3");
    for (const group of [
      { kind: "promote", memberId: "4" },
      { kind: "demote", memberId: "3" },
      { kind: "remove", memberId: "1" },
      { kind: "remove", memberId: "3" },
    ])
      await assert.rejects(f.command(group), /PERMISSION/);
    f.state.adminIds = ["2"];
    assert.equal(
      (await f.command({ kind: "remove", memberId: "3" })).status,
      "confirmed",
    );
    assert.deepEqual(f.calls, [["remove", "g77", [{ id: "3" }]]]);
  }));
test("apply rechecks role changed after prepare; ordinary member cannot remove", () =>
  fixture(async (f) => {
    f.fetcher.userId = "2";
    await f.command({ kind: "remove", memberId: "3" }, { phase: "prepare" });
    f.state.adminIds = [];
    await assert.rejects(
      f.command({ kind: "remove", memberId: "3" }),
      /PERMISSION/,
    );
    assert.equal(f.calls.length, 0);
  }));
test("owner removes deputy in demote then kick order; interrupted kick reports partial", () =>
  fixture(async (f) => {
    f.fail("remove");
    const result = await f.command({ kind: "remove", memberId: "2" });
    assert.equal(result.status, "partial");
    assert.equal(result.roleRemoved, true);
    assert.deepEqual(
      f.calls.map((c) => c[0]),
      ["demote", "remove"],
    );
    assert.ok(f.state.memberIds.includes("2"));
    assert.ok(!f.state.adminIds.includes("2"));
  }));
test("owner leave requires valid successor and confirms transfer before leaving", () =>
  fixture(async (f) => {
    await assert.rejects(f.command({ kind: "leave" }), /SUCCESSOR_REQUIRED/);
    for (const successorId of ["1", "9", "4"])
      await assert.rejects(
        f.command({ kind: "leave", successorId }),
        /INVALID/,
      );
    assert.equal(
      (await f.command({ kind: "leave", successorId: "2" })).status,
      "confirmed",
    );
    assert.deepEqual(f.calls, [
      ["transfer", "77", "2"],
      ["leave", "g77", 0],
    ]);
  }));
test("failed transfer never leaves; failed leave after transfer is explicitly partial", () =>
  fixture(async (f) => {
    f.fail("transfer");
    assert.equal(
      (await f.command({ kind: "leave", successorId: "2" })).status,
      "unknown",
    );
    assert.equal(f.calls.length, 1);
    f.fail("leave");
    const result = await f.command({ kind: "leave", successorId: "2" });
    assert.equal(result.status, "partial");
    assert.equal(result.ownershipTransferred, true);
  }));
test("ordinary member leave uses native normal leave and cannot transfer ownership", () =>
  fixture(async (f) => {
    f.fetcher.userId = "3";
    await assert.rejects(
      f.command({ kind: "leave", successorId: "2" }),
      /PERMISSION/,
    );
    assert.equal((await f.command({ kind: "leave" })).status, "confirmed");
    assert.deepEqual(f.calls, [["leave", "g77", 0]]);
  }));
test("full native profiles read deputy roles from topMember.isAdmin, overriding stale compact adminIds", () =>
  fixture(async (f) => {
    f.state.topMember = f.state.memberIds.map((id) => ({
      id,
      isAdmin: id === "3",
    }));
    f.fetcher.userId = "2";
    await assert.rejects(
      f.command({ kind: "remove", memberId: "4" }),
      /PERMISSION/,
    );
    f.fetcher.userId = "3";
    assert.equal(
      (await f.command({ kind: "remove", memberId: "2" })).status,
      "confirmed",
    );
  }));
test("role success uses native acknowledgement without overwriting native cache with a stale replica", () =>
  fixture(async (f) => {
    const original = f.groups.getFullInfoGroupById;
    let stale = true,
      readsAfterWrite = 0;
    f.groups.getFullInfoGroupById = async (...args) => {
      const info = await original(...args);
      if (f.calls.length && stale) {
        stale = false;
        readsAfterWrite++;
        info.adminIds = [];
      }
      return info;
    };
    assert.equal(
      (await f.command({ kind: "promote", memberId: "3" })).status,
      "confirmed",
    );
    assert.equal(f.calls.length, 1);
    assert.equal(readsAfterWrite, 0);
  }));
