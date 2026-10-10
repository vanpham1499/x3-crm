import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeConversations, readConversations } from "./conversations.mjs";
import vm from "node:vm";
import { Accounts } from "./accounts.mjs";

function previewPage({
  enabled = true,
  syncing = false,
  syncAvailable = true,
  loaded = true,
  listLoaded = true,
  visibleIds = ["10", "11", "12"],
  hiddenIds = [],
  groupInfo = null,
  globalIds,
  message = "hello",
  sender = "",
  emojiModules = {},
  markedUnread = [],
} = {}) {
  const previewToken = {},
    configToken = {},
    controllerToken = {},
    listToken = {};
  const previews = {
    doneLoadDB: loaded,
    getPreviewByIDSync: (id) =>
      id === "14"
        ? undefined
        : {
            messageType: id === "10" ? 2510 : id === "11" ? 2511 : 1,
            messageTime: "1790781674856",
            msgId: "90071992547409931",
            message,
          },
  };
  const modules = {
    PGx3: { b: (id) => markedUnread.includes(id) },
    EFQ6: { a: { isThreadHidden: (id) => hiddenIds.includes(id) } },
    UiPd: { default: { getDName: () => "", getAvatar: () => "" } },
    Gm1y: {
      default: {
        getGroupByIdSync: () => groupInfo,
        getDName: () => "Group",
        getGlobalIdsFromGroupIds: globalIds,
      },
    },
    dThN: { default: { userId: "account" } },
    QPNp: {
      a: {
        ConvInfoDataManager: {
          getAllConvSync: () =>
            ["10", "11", "12", "13", "14"].map((userId) => ({
              userId,
              isSyncEnabled: false,
            })),
        },
      },
    },
    jDHv: {
      ModuleContainer: {
        resolve: (token) =>
          token === listToken
            ? {
                isPreviewLoaded: () => listLoaded,
                getList: ({ key }) => {
                  assert.equal(key, "main-window");
                  return visibleIds;
                },
              }
            : token === previewToken
              ? previews
              : token === configToken
                ? { isFeatureEnabled: () => enabled }
                : { getItem: () => ({ state: syncing ? 1 : 0 }) },
      },
    },
    yzMR: { PreviewDataManager: previewToken },
    iZzu: { ConvListController: listToken },
    "3xbP": { c: "main-window" },
    Qx9e: syncAvailable ? { SyncConfigService: configToken } : {},
    V4WO: { SyncController: controllerToken, SyncStatus: { Syncing: 1 } },
    "1pet": {
      MSG_SYNCING: 2510,
      MSG_SYNCING_OUT_OF_RANGE: 2511,
      MSG_E2EE_PRELOAD: 2503,
    },
    // Reproduce the vendor's branching contract, so passing conv instead of
    // sync options regresses to out-of-range even though sync is enabled.
    sh7v: {
      a: (preview, options) => ({
        message:
          preview.messageType === 2510
            ? options.isSyncEnabled
              ? options.isSyncing
                ? "syncing"
                : "pending"
              : "out-of-range"
            : preview.messageType === 2511
              ? "out-of-range"
              : preview.message,
      }),
      b: () => sender,
    },
    RojW: {
      ConvList: {
        getVisibleConv: (userId) => ({ userId, isSyncEnabled: false }),
      },
    },
    c51z: {
      default: {
        str: (key) =>
          key === "STR_PREVIEW_SYNC_FAILED_W_BRACKET" ? "pending" : key,
      },
    },
    ...emojiModules,
  };
  return {
    frames: () => [
      {
        url: () => "https://chat.zalo.me/",
        evaluate: (fn, arg) => {
          const require = {
            c: Object.fromEntries(
              Object.entries(modules).map(([key, exports]) => [
                key,
                { exports },
              ]),
            ),
            m: {},
          };
          const chunks = [];
          chunks.push = (chunk) => {
            Array.prototype.push.call(chunks, chunk);
            Object.values(chunk[1])[0]({}, {}, require);
          };
          return vm.runInNewContext(`(${fn.toString()})(expected)`, {
            webpackJsonp: chunks,
            expected: arg,
            URL,
            setTimeout,
            clearTimeout,
          });
        },
      },
    ],
  };
}

test("global IDs are read once from visible group cache without personal or hidden chats", async () => {
  let calls = 0;
  const rows = await readConversations(
    previewPage({
      visibleIds: ["10", "g1", "g2", "g3"],
      hiddenIds: ["g3"],
      globalIds: async (ids) => {
        calls++;
        assert.deepEqual(Array.from(ids), ["g1", "g2"]);
        return { g1: "90071992547409931", g2: "90071992547409932" };
      },
    }),
    "account",
  );
  assert.equal(calls, 1);
  assert.equal(rows[0].globalGroupId, undefined);
  assert.equal(rows[1].globalGroupId, "90071992547409931");
  assert.equal(rows[2].globalGroupId, "90071992547409932");
});

test("missing, invalid, unsafe and failed mappings never invent a shared identity", async () => {
  for (const value of [
    undefined,
    null,
    "",
    0,
    "0",
    "null",
    "undefined",
    90071992547409930,
    "bad/id",
  ]) {
    const rows = await readConversations(
      previewPage({
        visibleIds: ["g1"],
        globalIds: async () => ({ g1: value }),
      }),
      "account",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].globalGroupId, undefined);
  }
  const rows = await readConversations(
    previewPage({
      visibleIds: ["g1"],
      globalIds: async () => {
        throw Error("worker unavailable");
      },
    }),
    "account",
  );
  assert.equal(rows[0].globalGroupId, undefined);
});

test("unresponsive global ID worker cannot hang the inbox", async () => {
  const rows = await readConversations(
    previewPage({ visibleIds: ["g1"], globalIds: () => new Promise(() => {}) }),
    "account",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].globalGroupId, undefined);
});

test("repeated reads reuse identity cache, unresolved IDs back off, and frames stay isolated", async () => {
  let calls = 0;
  const base = previewPage({
    visibleIds: ["g1", "g2"],
    globalIds: async () => {
      calls++;
      return { g1: "123" };
    },
  });
  const frames = base.frames();
  const page = { frames: () => frames };
  await readConversations(page, "account");
  const again = await readConversations(page, "account");
  assert.equal(calls, 1);
  assert.equal(again[0].globalGroupId, "123");
  assert.equal(again[1].globalGroupId, undefined);
  const separate = await readConversations(
    previewPage({ visibleIds: ["g1"], globalIds: async () => ({ g1: "456" }) }),
    "account",
  );
  assert.equal(separate[0].globalGroupId, "456");
});

test("hidden conversations never expose a list row or preview", async () => {
  const rows = await readConversations(
    previewPage({ hiddenIds: ["10", "12"] }),
    "account",
  );
  assert.deepEqual(
    Array.from(rows, (r) => r.conversationId),
    ["11"],
  );
  await assert.rejects(
    readConversations(previewPage({ emojiModules: { EFQ6: {} } }), "account"),
    /WEB_CONVERSATIONS_NOT_READY/,
  );
});
test("native manual unread marks appear in the inbox even without new messages", async () => {
  const rows = await readConversations(
    previewPage({ markedUnread: ["12"] }),
    "account",
  );
  assert.equal(rows.find((row) => row.conversationId === "12").unread, 0);
  assert.equal(
    rows.find((row) => row.conversationId === "12").unreadMarked,
    true,
  );
  assert.equal(
    rows.find((row) => row.conversationId === "11").unreadMarked,
    false,
  );
  assert.equal(rows.find((row) => row.conversationId === "11").unread, 0);
});

test("cold inbox projects native emoji without opening a chat or loading the picker", async () => {
  const page = previewPage({
    visibleIds: ["12"],
    message: ":) 😊 https://example.com",
    sender: "Bạn",
    emojiModules: {
      P6UB: {
        TokenTypes: { EMOJI_TOKEN: 1, EMOJI_TOKEN_V2: 2 },
        default: {
          parseMessage: ({ message, parseLink }) => {
            assert.equal(message, ":) 😊 https://example.com");
            assert.equal(parseLink, false);
            return [
              { type: 1, text: ":)", value: ":)" },
              " ",
              { type: 2, text: "😊", value: "smile" },
              " https://example.com",
            ];
          },
        },
      },
      NDmK: { default: { emojiMapPos: { ":)": "82% 17.5%", smile: "2% 5%" } } },
      z0WU: { default: { getEmojiSrc: () => "/assets/emoji.png" } },
    },
  });
  const [row] = await readConversations(page, "account");
  assert.equal(row.preview, "Bạn: :) 😊 https://example.com");
  assert.equal(row.previewInline.map((t) => t.text).join(""), row.preview);
  assert.equal(row.previewInline.filter((t) => t.sprite).length, 2);
  assert.equal(
    row.previewInline[1].sprite,
    "https://chat.zalo.me/assets/emoji.png",
  );
  assert.equal(row.previewInline[0].text, "Bạn: ");
  assert.equal(row.previewInline.at(-1).text, " https://example.com");
});

test("group portraits survive a cold contact cache and retain the native member count", async () => {
  const rows = await readConversations(
    previewPage({
      visibleIds: ["g10"],
      groupInfo: {
        totalMember: 180,
        topMember: [
          { id: "1", dName: "A", avatar: "https://example.com/a.jpg" },
          { id: "2", dName: "B", avatar: "https://example.com/b.jpg" },
          { id: "3", dName: "C", avatar: "https://example.com/c.jpg" },
          { id: "4", dName: "D", avatar: "javascript:invalid" },
        ],
      },
    }),
    "account",
  );
  assert.equal(rows[0].memberCount, 180);
  assert.equal(rows[0].avatarMembers.length, 4);
  assert.equal(rows[0].avatarMembers.filter((m) => m.avatarSrc).length, 3);
  assert.equal(rows[0].avatarMembers[1].name, "B");
});

test("native inbox membership excludes retained metadata, keeps legitimate empty rows and account-independent IDs", async () => {
  const rows = await readConversations(
    previewPage({ visibleIds: ["12", "14", "12", "stranger_box"] }),
    "account",
  );
  assert.equal(rows.map((r) => r.conversationId).join(","), "12,14");
  assert.equal(rows[1].previewState, "unavailable");
  await assert.rejects(
    readConversations(previewPage({ listLoaded: false }), "account"),
    /WEB_CONVERSATIONS_NOT_READY/,
  );
});

test("sync placeholders use vendor sync state, not conversation metadata", async () => {
  for (const syncing of [false, true]) {
    const rows = await readConversations(previewPage({ syncing }), "account");
    assert.equal(rows[0].preview, syncing ? "syncing" : "pending");
    assert.equal(rows[0].previewState, "sync_pending");
    assert.equal(rows[1].preview, "out-of-range");
    assert.equal(rows[1].previewState, "out_of_range");
    assert.equal(rows[2].preview, "hello");
    assert.equal(rows[2].previewState, "ready");
  }
});
test("missing sync adapter does not imply missing history; DB initialization is not a complete list", async () => {
  const rows = await readConversations(
    previewPage({ syncAvailable: false }),
    "account",
  );
  assert.equal(rows[0].preview, "pending");
  assert.equal(rows[0].previewError, true);
  await assert.rejects(
    readConversations(previewPage({ loaded: false }), "account"),
    /WEB_CONVERSATIONS_NOT_READY/,
  );
  await assert.rejects(
    readConversations(previewPage(), "other-account"),
    /WEB_IDENTITY_MISMATCH/,
  );
});

test("merge preserves account identity and large string IDs; pins precede recent messages", () => {
  const id = "g90071992547409931234";
  const result = mergeConversations([
    {
      account: { id: 1, name: "A" },
      rows: [
        { conversationId: id, updatedAt: 100 },
        { conversationId: "2", updatedAt: 1, pinned: true },
      ],
    },
    {
      account: { id: 2, name: "B" },
      rows: [{ conversationId: id, updatedAt: 200 }],
    },
  ]);
  assert.deepEqual(
    result.map((r) => r.id),
    ["1:2", "2:" + id, "1:" + id],
  );
  assert.equal(result[1].accountName, "B");
  assert.equal(result[2].accountName, "A");
});
test("list isolates owner, excludes stopped sessions and returns partial failures explicitly", async () => {
  const owner = "a".repeat(64);
  const record = {
    owner,
    slots: [1, 2, 3].map((id) => ({
      id,
      enabled: id !== 3,
      account: {
        id,
        name: "Account " + id,
        externalId: String(id),
        updatedAt: new Date().toISOString(),
      },
    })),
  };
  const manager = new Accounts(record, {
    save: async () => {},
    inspect: async (h) => ({
      state: "connected",
      externalId: h.uid,
      name: "Account " + h.uid,
    }),
    readConversations: async (h) => {
      if (h.uid === "2") throw Error("adapter failure");
      return [{ conversationId: "9", updatedAt: 100 }];
    },
  });
  for (const slot of record.slots)
    if (slot.enabled) manager.session(slot).handle = { uid: String(slot.id) };
  await assert.rejects(
    manager.command({ owner: "b".repeat(64), action: "conversations" }),
    /WEB_OWNED/,
  );
  const result = await manager.command({ owner, action: "conversations" });
  assert.equal(result.conversations.length, 1);
  assert.equal(result.conversations[0].accountId, 1);
  assert.equal(result.accounts[1].error, "WEB_CONVERSATIONS_UNAVAILABLE");
  assert.equal(result.accounts[2].state, "stopped");
});
