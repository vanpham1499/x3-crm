import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readConversationInfo } from "./conversation-info.mjs";
import { validCommand } from "./guards.mjs";
import { Accounts } from "./accounts.mjs";

function fixture({ failFiles = false, protectedContent = false } = {}) {
  const calls = [];
  const members = Array.from({ length: 53 }, (_, i) => String(100 + i));
  const group = {
    displayName: "Test group",
    memberIds: members,
    totalMember: 53,
    creatorId: "100",
    adminIds: ["101"],
  };
  const modules = {
    dThN: { default: { userId: "123" } },
    iZzu: { ConvListController: "list" },
    "3xbP": { c: "main" },
    EYv5: { a: "media" },
    jDHv: {
      ModuleContainer: {
        resolve: (key) =>
          key === "list"
            ? { getList: () => ["g42"] }
            : { getMediaFromConversation: () => {} },
      },
    },
    UiPd: {
      default: {
        getDName: (id) => "Member " + id,
        getAvatar: () => "https://example.com/avatar",
      },
    },
    Gm1y: {
      default: {
        getGroupByIdSync: () => group,
        getFullInfoGroupById: async () => group,
      },
    },
    czzM: {
      b: { GetModule: () => ({ isContentProtected: () => protectedContent }) },
    },
    "1pet": { MSG_SUBTYPE_MEDIA_VIDEO: 2 },
    dEOl: {
      MEDIA_TYPE: { images: {} },
      default: {
        supportServer: () => false,
        getChatMedia: async (conv, type, cursor, limit) => {
          calls.push({ conv, type, cursor, limit });
          if (type === "files" && failFiles) throw Error("unavailable");
          const items = Array.from({ length: 30 }, (_, i) => ({
            msgId: String(9007199254740993000n + BigInt(i)),
            cliMsgId: String(i),
            fromUid: i === 28 ? "0" : "9007199254740993123",
            sendDttm: 1000 + i,
            subType: i % 2 ? 1 : 2,
            message: {
              title: "Test",
              href:
                i === 29 ? "javascript:alert(1)" : "https://example.com/media",
              thumb: "https://example.com/thumb",
            },
            secret: "must not expose",
          }))
            .reverse()
            .filter((m) => !cursor || BigInt(m.msgId) < BigInt(cursor))
            .slice(0, limit);
          return { items };
        },
      },
    },
  };
  let packet;
  const page = {
    exposeBinding: async (name, callback) => {
      packet = callback;
    },
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, arg) => {
          const require = {
            c: Object.fromEntries(
              Object.entries(modules).map(([k, exports]) => [k, { exports }]),
            ),
            m: {},
          };
          const chunks = [];
          chunks.push = (chunk) => {
            Array.prototype.push.call(chunks, chunk);
            Object.values(chunk[1])[0]({}, {}, require);
          };
          return vm.runInNewContext(`(${fn.toString()})(arg)`, {
            arg,
            webpackJsonp: chunks,
            setTimeout,
            clearTimeout,
            __zaloTeamPacket: (id, value) =>
              packet(
                { frame: { url: () => "https://chat.zalo.me/" } },
                id,
                value,
              ),
          });
        },
      },
    ],
  };
  return { page, calls };
}
test("sidebar uses native media store; metadata and media pages have exact account/conversation scope", async () => {
  const { page, calls } = fixture();
  const result = await readConversationInfo(page, "123", "g42");
  assert.equal(result.metadata.memberCount, 53);
  assert.equal(result.metadata.members[0].role, "owner");
  assert.equal(result.metadata.members[1].role, "admin");
  assert.equal(result.sections.images.items.length, 8);
  assert.equal(result.sections.files.items.length, 3);
  assert.equal(result.sections.links.items.length, 3);
  assert.equal(result.sections.images.items[0].url, undefined);
  assert.equal(
    result.sections.images.items[0].sender.id,
    "9007199254740993123",
  );
  assert.equal(result.sections.images.items[1].sender.id, "123");
  assert.equal(
    result.sections.images.items[0].sender.name,
    "Member 9007199254740993123",
  );
  assert.ok(!JSON.stringify(result).includes("must not expose"));
  const first = await readConversationInfo(page, "123", "g42", "files");
  const next = await readConversationInfo(
    page,
    "123",
    "g42",
    "files",
    first.sections.files.cursor,
  );
  assert.equal(first.sections.files.items.length, 24);
  assert.equal(next.sections.files.items.length, 6);
  assert.equal(next.sections.files.cursor, null);
  assert.equal(
    new Set(
      [...first.sections.files.items, ...next.sections.files.items].map(
        (m) => m.id,
      ),
    ).size,
    30,
  );
  const groupPage = await readConversationInfo(page, "123", "g42", "members");
  assert.equal(groupPage.metadata.members.length, 50);
  assert.equal(groupPage.metadata.selfRole, "member");
  assert.equal(groupPage.metadata.canLeave, true);
  assert.deepEqual(
    Array.from(groupPage.metadata.members.find((m) => m.self).actions),
    ["leave"],
  );
  assert.ok(
    groupPage.metadata.members
      .filter((m) => !m.self)
      .every((m) => m.actions.length === 0),
  );
  const more = await readConversationInfo(
    page,
    "123",
    "g42",
    "members",
    groupPage.metadata.memberCursor,
  );
  assert.equal(more.metadata.members.length, 3);
  assert.equal(more.metadata.memberCursor, null);
  assert.ok(calls.every((c) => c.conv === "g42"));
});
test("sidebar rejects identity/inbox mismatch before touching the media store", async () => {
  const { page, calls } = fixture();
  await assert.rejects(
    readConversationInfo(page, "999", "g42"),
    /WEB_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    readConversationInfo(page, "123", "g99"),
    /WEB_CONVERSATION_NOT_FOUND/,
  );
  assert.equal(calls.length, 0);
});
test("failed section is not represented as empty and protected content is not fetched", async () => {
  const partial = await readConversationInfo(
    fixture({ failFiles: true }).page,
    "123",
    "g42",
  );
  assert.equal(partial.sections.files.error, "WEB_INFO_UNAVAILABLE");
  assert.equal(partial.sections.images.items.length, 8);
  const { page, calls } = fixture({ protectedContent: true });
  const protectedInfo = await readConversationInfo(page, "123", "g42");
  assert.equal(protectedInfo.sections.images.error, "WEB_CONTENT_PROTECTED");
  assert.equal(calls.length, 0);
});
test("sidebar commands validate category/cursor and route only to the owned connected account", async () => {
  const owner = "a".repeat(64);
  const command = {
    owner,
    action: "conversation-info",
    accountId: 1,
    conversationId: "g42",
    section: "images",
  };
  assert.equal(validCommand(command), true);
  for (const patch of [
    { section: "execute" },
    { cursor: "../profile" },
    { accountId: undefined },
    { section: "overview", cursor: "1" },
  ])
    assert.equal(validCommand({ ...command, ...patch }), false);
  const slot = {
    id: 1,
    enabled: true,
    account: { externalId: "123", name: "Test" },
  };
  let reads = 0;
  const accounts = new Accounts(
    { owner, slots: [slot] },
    {
      save: async () => {},
      inspect: async () => ({
        state: "connected",
        externalId: "123",
        name: "Test",
      }),
      readConversationInfo: async (handle, uid, conv, section) => {
        assert.equal(uid, "123");
        assert.equal(conv, "g42");
        assert.equal(section, "images");
        reads++;
        return { metadata: {}, sections: {} };
      },
    },
  );
  accounts.session(slot).handle = {};
  assert.equal((await accounts.command(command)).accountId, 1);
  await assert.rejects(
    accounts.command({ ...command, owner: "b".repeat(64) }),
    /WEB_OWNED/,
  );
  await assert.rejects(
    accounts.command({ ...command, accountId: 2 }),
    /ACCOUNT_NOT_FOUND/,
  );
  slot.enabled = false;
  accounts.session(slot).handle = null;
  await assert.rejects(accounts.command(command), /WEB_ACCOUNT_OFFLINE/);
  assert.equal(reads, 1);
});
