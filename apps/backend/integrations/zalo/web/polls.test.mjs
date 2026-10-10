import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { PollActions, validPoll, nativePoll } from "./polls.mjs";
import { validCommand } from "./guards.mjs";
import { normalizeMessage } from "./messages.mjs";
const poll = {
  kind: "create",
  question: "Question",
  options: ["A", "B"],
  expiredTime: 0,
  pinAct: false,
  allowMultiChoices: true,
  allowAddNewOption: true,
  isAnonymous: false,
  isHideVotePreview: false,
};
const body = {
  owner: "a".repeat(64),
  action: "poll-action",
  accountId: 1,
  conversationId: "g123",
  requestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  poll,
};
test("poll validates group scope, limits, duplicates, hidden results and request identity", () => {
  assert.ok(validCommand(body));
  for (const value of [
    { ...body, requestId: undefined },
    { ...body, conversationId: "123" },
    { ...body, text: "extra" },
  ])
    assert.equal(validCommand(value), false);
  for (const change of [
    { question: " " },
    { question: "x".repeat(201) },
    { options: ["A", " A "] },
    { options: ["A"] },
    { options: ["A", "x".repeat(121)] },
    { isHideVotePreview: true },
    { url: "https://example.com" },
  ])
    assert.equal(validPoll({ ...poll, ...change }), false);
  assert.ok(
    validPoll({ ...poll, isHideVotePreview: true, allowAddNewOption: false }),
  );
  assert.ok(
    validCommand({
      ...body,
      poll: { kind: "vote", pollId: "123", optionIds: ["1", "2"] },
    }),
  );
  assert.equal(
    validPoll({ kind: "vote", pollId: "123", optionIds: ["1", "1"] }),
    false,
  );
  assert.ok(
    validCommand({ ...body, poll: { kind: "catalog" }, requestId: undefined }),
  );
});
test("one creation receipt survives restart and rejects another account or payload", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-poll-"));
  let calls = 0;
  const adapter = async (_, a) =>
    a.phase === "prepare"
      ? { ready: true }
      : (calls++, { status: "confirmed", pollId: "123" });
  try {
    const a = new PollActions(root, adapter);
    await a.run(null, "1", body);
    assert.equal(
      (await new PollActions(root, adapter).run(null, "1", body)).status,
      "confirmed",
    );
    assert.equal(calls, 1);
    await assert.rejects(
      a.run(null, "2", { ...body, accountId: 2 }),
      /CONFLICT/,
    );
    await assert.rejects(
      a.run(null, "1", { ...body, poll: { ...poll, question: "changed" } }),
      /CONFLICT/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("uncertain result never resends; failed preflight creates no receipt", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zalo-poll-"));
  let calls = 0;
  try {
    await assert.rejects(
      new PollActions(root, async () => {
        throw Error("offline");
      }).run(null, "1", body),
      /offline/,
    );
    assert.deepEqual(await fs.readdir(root), []);
    const adapter = async (_, a) => {
      if (a.phase === "apply") {
        calls++;
        throw Error("connection lost");
      }
      return { ready: true };
    };
    assert.equal(
      (await new PollActions(root, adapter).run(null, "1", body)).status,
      "unknown",
    );
    assert.equal(
      (await new PollActions(root, adapter).run(null, "1", body)).status,
      "unknown",
    );
    assert.equal(calls, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("hidden results never expose counts or voter identities in chat projection", () => {
  const raw = {
    type: "MSG_POLL",
    poll: {
      poll_id: 123,
      question: "Q",
      joined: false,
      is_hide_vote_preview: true,
      allow_multi_choices: true,
      options: [
        { option_id: 1, content: "A", votes: 4, voters: ["private"] },
        { option_id: 2, content: "B", votes: 3 },
      ],
    },
  };
  const hidden = normalizeMessage(raw);
  assert.equal(hidden.kind, "poll");
  assert.equal(hidden.poll.total, 0);
  assert.deepEqual(
    hidden.poll.options.map((o) => o.votes),
    [0, 0],
  );
  assert.ok(!JSON.stringify(hidden).includes("private"));
  const joined = normalizeMessage({
    ...raw,
    poll: { ...raw.poll, joined: true },
  });
  assert.equal(joined.poll.total, 7);
});
test("native vote refuses mismatched account/group/closed poll and sends only valid member options", async () => {
  const pollData = {
    poll_id: 9,
    group_id: "123",
    closed: false,
    expired_time: -1,
    allow_multi_choices: false,
    options: [{ option_id: 1 }],
  };
  let votes = 0;
  const manager = {
    isEnablePin: () => true,
    votePoll: async () => {
      votes++;
    },
    updatePollCache: () => {},
  };
  const mods = {
    dThN: {
      default: {
        userId: "1",
        createPoll: () => {},
        getPollDetail: async () => pollData,
      },
    },
    jDHv: {
      ModuleContainer: {
        resolve: (t) => (t === "poll" ? manager : { getList: () => ["g123"] }),
      },
    },
    iZzu: { ConvListController: "list" },
    "3xbP": { c: "main" },
    Gm1y: {
      default: { getFullInfoGroupById: async () => ({ memberIds: ["1"] }) },
    },
    C8zZ: { GroupPollManager: "poll" },
    NDmK: { default: { groupPoll: {} } },
  };
  mods.XS0u = { default: { getPollInfo: async () => pollData } };
  const pinned = [];
  const board = {
    pinLimit: 3,
    topicStore: { getTopics: () => pinned },
    fetchTopics: async () => ({ topics: pinned }),
  };
  mods.jnJr = { a: { getInstance: () => board } };
  mods["1pet"] = { POLL_TOPIC: 7 };
  mods.dThN.default.pinBoardItem = async (group, id, type) => {
    assert.equal(group, "123");
    pinned.push({ id, type });
  };
  mods.dThN.default.createPoll = async () => ({ poll_id: 9 });
  manager.createPollRequestData = ({ groupId, pollData }) => ({
    groupId,
    pollData,
  });
  const require = (k) => mods[k];
  require.c = Object.fromEntries(
    Object.entries(mods).map(([k, exports]) => [k, { exports }]),
  );
  require.m = {};
  const sandbox = { webpackJsonp: [] };
  sandbox.webpackJsonp.push = (chunk) => {
    Array.prototype.push.call(sandbox.webpackJsonp, chunk);
    Object.values(chunk[1])[0]({}, {}, require);
  };
  const page = {
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, args) =>
          vm.runInNewContext(`(${fn})(args)`, { ...sandbox, args }),
      },
    ],
  };
  const args = {
    expectedId: "1",
    conversationId: "g123",
    poll: { kind: "vote", pollId: "9", optionIds: ["1"] },
    phase: "apply",
  };
  await assert.rejects(
    nativePoll(page, { ...args, expectedId: "2" }),
    /IDENTITY_MISMATCH/,
  );
  pollData.group_id = "456";
  await assert.rejects(nativePoll(page, args), /CONVERSATION_NOT_FOUND/);
  pollData.group_id = "123";
  pollData.closed = true;
  await assert.rejects(nativePoll(page, args), /POLL_CLOSED/);
  pollData.closed = false;
  await assert.rejects(
    nativePoll(page, { ...args, poll: { ...args.poll, optionIds: ["2"] } }),
    /INVALID_REQUEST/,
  );
  assert.equal(votes, 0);
  assert.equal((await nativePoll(page, args)).status, "confirmed");
  assert.equal(votes, 1);
  assert.equal(
    (await nativePoll(page, { ...args, poll: { ...poll, pinAct: true } }))
      .pinStatus,
    "confirmed",
  );
});
