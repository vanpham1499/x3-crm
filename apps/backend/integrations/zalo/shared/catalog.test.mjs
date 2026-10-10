import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { catalogExpression } from "./catalog.mjs";

function fixture({ accountId = "100", rows = [], ready = true } = {}) {
  const queries = [];
  const profiles = {
    100: {
      userId: "100",
      displayName: "Owner",
      avatar: "https://example.test/me.png",
      password: "must-not-export",
    },
    200: {
      userId: "200",
      displayName: "Customer",
      phoneNumber: "0123",
      avatar: "https://example.test/avatar.png",
      key: "must-not-export",
    },
  };
  const conv = {
    data: new Map([
      ["200", { userId: "200", lastSmsLocalId: "12" }],
      ["g300", { userId: "g300" }],
    ]),
    doneLoadDB: true,
    _pm: {
      data: new Map([
        [
          "200",
          {
            messageTime: Date.now() - 1000,
            msgId: "12",
            message: "Last message",
            draft: "Do not export this draft",
          },
        ],
      ]),
    },
  };
  const unread = {
    data: new Map([
      [
        "200",
        {
          smsUnreadCount: 4,
          smsUnreadNotCount: 1,
          lastSeenMsgId: "10",
          lastProcessMsgId: "12",
        },
      ],
    ]),
  };
  const registry = {
    m: {},
    c: {
      dThN: { exports: { default: { userId: accountId } } },
      fdn9: { exports: { a: { userId: accountId } } },
      QPNp: {
        exports: {
          a: {
            _convInfoManager: ready ? conv : null,
            _unreadDataManager: unread,
          },
        },
      },
      JWY6: {
        exports: {
          a: {
            _cacheProfileInfo: profiles,
            _cacheUidsFriends: ["200"],
            _aliasName: { 200: "Shared customer" },
            _phonebookName: null,
            getProfileByIdFromCache() {
              throw new Error("MUTATING_PROFILE_GETTER_USED");
            },
          },
        },
      },
      "8apa": {
        exports: {
          a: {
            _cacheGroupInfo: { g300: { displayName: "Group", userId: "g300" } },
          },
        },
      },
      MPLC: {
        exports: {
          b: {
            messageCache: {
              _cache: { _map: new Map([["200", { _active: true }]]) },
            },
          },
        },
      },
      fsN4: {
        exports: {
          default: {
            instance: {
              Core: {
                Message: {
                  async getAll(range, options) {
                    queries.push({ range, options });
                    return rows;
                  },
                },
              },
            },
            getInstance() {
              throw new Error("DB_INITIALIZED");
            },
          },
        },
      },
      mE25: { exports: { a: "9999999999999999999", b: "9999999999999999" } },
      wH4e: { exports: { c: { PREV: "prev" } } },
      "1pet": {
        exports: {
          MSG_TEXT: 1,
          MSG_PHOTO: 2,
          MSG_PHOTO_2: 11,
          MSG_FILE: 19,
          MSG_VIDEO: 18,
          MSG_VOICE: 3,
        },
      },
      C64z: {
        exports: {
          fileExistsSyncV2: (value) =>
            typeof value === "string" &&
            value.startsWith("C:\\Users\\zalo\\Downloads\\"),
        },
      },
    },
  };
  const webpackJsonp = [];
  webpackJsonp.push = function (record) {
    for (const [id, factory] of Object.entries(record[1])) {
      registry.m[id] = factory;
      registry.c[id] = { exports: {} };
      factory(registry.c[id], registry.c[id].exports, registry);
    }
    return Array.prototype.push.call(this, record);
  };
  const context = vm.createContext({
    location: { protocol: "file:" },
    $zelectron: { openDevTool() {} },
    webpackJsonp,
    URL,
    Map,
  });
  const run = (options) =>
    vm.runInContext(
      catalogExpression({
        version: "26.9.10",
        expectedAccountId: "100",
        ...options,
      }),
      context,
    );
  return {
    run,
    queries,
    profiles,
    conv,
    unread,
    registry,
    webpackJsonp,
    context,
  };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
test('native aggregate folders cannot become contacts or navigable conversations',async()=>{
  const f=fixture();f.conv.data.set('stranger_box',{userId:'stranger_box',displayName:'stranger_box'});
  f.registry.c.JWY6.exports.a._cacheUidsFriends.push('stranger_box');
  f.profiles.stranger_box={userId:'stranger_box',displayName:'stranger_box'};
  const result=await f.run({operation:'snapshot'});
  assert.equal(result.conversations.length,2);assert.equal(result.contacts.length,1);
  assert.ok(result.conversations.some(row=>row.threadId==='200'));
});
test('native membership requires loaded catalog, keeps unknown-name chats and empty self documents',async()=>{
  const f=fixture();
  const threads=[{threadId:'200',threadType:'user'},{threadId:'300',threadType:'group'},
    {threadId:'999',threadType:'user'},{threadId:'100',threadType:'user'}];
  delete f.profiles['200'];
  const result=await f.run({operation:'avatars',threads});
  assert.equal(result.conversationsLoaded,true);
  assert.deepEqual(plain(result.rows.map(row=>row.conversationPresent)),[true,true,false,true]);
  f.conv.doneLoadDB=false;
  const booting=await f.run({operation:'avatars',threads});
  assert.equal(booting.conversationsLoaded,false);
  assert.ok(booting.rows.every(row=>row.conversationPresent===null));
});

test('snapshot and list enrichment use the source PC formatter, sender and localized notice',async()=>{
  const f=fixture();let calls=0;
  f.registry.c.sh7v={exports:{a:preview=>{calls++;assert.equal(preview.msgId,'12');return{message:'STR_TEST',isSystemicMessage:true,systemicMessageArgs:['source']};},b:()=> 'Bạn'}};
  f.registry.c.c51z={exports:{default:{trans:(key,args)=>`${key} ${args.join(' ')}`,str:key=>key}}};
  const snapshot=await f.run({operation:'snapshot',limit:100});
  assert.equal(snapshot.conversations.find(c=>c.threadId==='200').preview,'Bạn: STR_TEST source');
  const avatars=await f.run({operation:'avatars',threads:[{threadId:'200',threadType:'user'}]});
  assert.equal(avatars.rows[0].preview,'Bạn: STR_TEST source');
  assert.ok(Date.parse(avatars.rows[0].previewAt));assert.equal(calls,2);
  assert.doesNotMatch(JSON.stringify(avatars),/Do not export this draft/);
});
test("avatar reader isolates requested profiles and reads missing images without cache mutation", async () => {
  const f = fixture(); f.profiles[200].avatar = "https://s240-ava-talk.zadn.vn/local.png";
  const group = f.registry.c['8apa'].exports.a._cacheGroupInfo.g300; group.topMember = ['200', {id:'400',avatar:'https://s120-ava-talk.zadn.vn/member.png',dName:'must-not-export'}];
  const reads = [];
  f.registry.c.fsN4.exports.default.instance.Core.FriendsInfo = {getMultiIfExists:async ids => {
    reads.push([...ids]); return ids.includes('400') ? [{userId:'400',avatar:'https://s120-ava-talk.zadn.vn/member.png',token:'never-export'}] : [];
  }};
  const result = plain(await f.run({operation:'avatars',threads:[{threadId:'300',threadType:'group'},{threadId:'400',threadType:'user'}]}));
  assert.equal(result.rows.length,2); assert.equal(result.rows[0].avatarMembers.length,2);
  assert.equal(result.rows[1].avatarUrl,'https://s120-ava-talk.zadn.vn/member.png');
  assert.ok(reads.flat().includes('400')); assert.equal(f.profiles[400],undefined);
  assert.doesNotMatch(JSON.stringify(result),/never-export|phone|Owner|Customer/);
  assert.equal(f.queries.length,0);
});
test("avatar reader rejects malformed scope and rechecks account after local DB read", async () => {
  const f = fixture();
  await assert.rejects(()=>f.run({operation:'avatars',threads:[{threadId:'bad',threadType:'user'}]}),/AVATAR_SCOPE_INVALID/);
  f.registry.c.fsN4.exports.default.instance.Core.FriendsInfo = {getMultiIfExists:async () => {
    f.registry.c.dThN.exports.default.userId='999'; return [];
  }};
  await assert.rejects(()=>f.run({operation:'avatars',threads:[{threadId:'400',threadType:'user'}]}),/ACCOUNT_MISMATCH/);
});
const row = (id, overrides = {}) => ({
  msgId: id,
  fromUid: "200",
  toUid: "200",
  msgType: 1,
  message: "text",
  sendDttm: String(Date.now() - Number(id) * 1000),
  ...overrides,
});

test("snapshot only reads caches and exports account-scoped allowlisted fields", async () => {
  const f = fixture();
  const before = JSON.stringify(f.profiles);
  const result = await f.run({ operation: "snapshot" });
  assert.equal(result.account.displayName, "Owner");
  assert.equal(result.contacts[0].displayName, "Shared customer");
  assert.equal(result.conversations[0].unreadCount, 4);
  assert.equal(result.conversations[1].threadType, "group");
  assert.equal(result.conversations[1].threadId, "300");
  assert.equal(JSON.stringify(f.profiles), before);
  assert.equal(f.queries.length, 0);
  assert.doesNotMatch(
    JSON.stringify(result),
    /must-not-export|Do not export this draft/,
  );
  assert.equal(f.webpackJsonp.length, 0);
  assert.equal(
    Object.keys(f.registry.c).some((key) => key.startsWith("x3-catalog-")),
    false,
  );
});

test("snapshot reports limits and unavailable cache instead of initializing native modules", async () => {
  const f = fixture();
  const result = await f.run({ operation: "snapshot", limit: 1 });
  assert.equal(result.conversations.length, 1);
  assert.equal(result.coverage.conversationsTruncated, true);
  await assert.rejects(
    fixture({ ready: false }).run({ operation: "snapshot" }),
    /NATIVE_CONVERSATION_CACHE_UNAVAILABLE/,
  );
});

test("wrong account and version cannot read local messages", async () => {
  const f = fixture();
  await assert.rejects(
    f.run({
      operation: "messages",
      expectedAccountId: "101",
      threadId: "200",
      threadType: "user",
    }),
    /ACCOUNT_MISMATCH/,
  );
  await assert.rejects(
    f.run({ operation: "snapshot", version: "27.0" }),
    /VERSION_UNSUPPORTED/,
  );
  assert.equal(f.queries.length, 0);
});

test("invariants include active native chat and unread state without mutation", async () => {
  const f = fixture();
  const before = plain(await f.run({ operation: "invariants" }));
  await f.run({ operation: "snapshot" });
  const after = plain(await f.run({ operation: "invariants" }));
  assert.deepEqual(before, after);
  assert.deepEqual(before.selectedConversationIds, ["200"]);
  assert.equal(before.unreads[0].count, 4);
});

test("history uses a bounded local DB query and exclusive continuation tuple", async () => {
  const f = fixture({ rows: [row("20"), row("19"), row("18")] });
  const result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
    limit: 2,
  });
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].kind, "text");
  assert.equal(result.nextCursor.msgId, "19");
  assert.equal(f.queries[0].options.limit, 3);
  assert.equal(f.queries[0].options.partition, "200");
  await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
    limit: 2,
    cursor: result.nextCursor,
  });
  assert.equal(f.queries[1].range.excludeTo, true);
  assert.deepEqual(plain(f.queries[1].range.to), [
    "200",
    result.nextCursor.sendDttm,
    "19",
  ]);
});

test("group history retains source namespace and rejects rows from other partitions", async () => {
  const f = fixture({
    rows: [row("20", { toUid: "g300" }), row("19", { toUid: "g999" })],
  });
  const result = await f.run({
    operation: "messages",
    threadId: "300",
    threadType: "group",
  });
  assert.equal(f.queries[0].options.partition, "g300");
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].threadId, "300");
  assert.equal(result.messages[0].threadType, "group");
  assert.equal(result.skipped, 1);
});

test("invalid cursor, unsupported operation and group identity fail before DB reads", async () => {
  const f = fixture();
  await assert.rejects(
    f.run({
      operation: "messages",
      threadId: "200",
      threadType: "user",
      cursor: { sendDttm: "query()", msgId: "2" },
    }),
    /INVALID_CURSOR/,
  );
  await assert.rejects(
    f.run({ operation: "messages", threadId: "g300", threadType: "group" }),
    /INVALID_THREAD/,
  );
  await assert.rejects(f.run({ operation: "send" }), /OPERATION_UNSUPPORTED/);
  assert.equal(f.queries.length, 0);
});

test("native account changes while awaiting DB are rejected", async () => {
  const f = fixture();
  f.registry.c.fsN4.exports.default.instance.Core.Message.getAll = async () => {
    f.registry.c.dThN.exports.default.userId = "999";
    return [row("20")];
  };
  await assert.rejects(
    f.run({ operation: "messages", threadId: "200", threadType: "user" }),
    /ACCOUNT_MISMATCH/,
  );
});

test("file/video rows return private original-source references, never arbitrary metadata", async () => {
  const f = fixture({
    rows: [
      row("20", {
        fromUid: "0",
        msgType: 19,
        message: {
          title: "photo.zip",
          href: "https://example.test/original",
          params: '{"fileSize":123}',
          secret: "must-not-export",
        },
        localPath: "C:\\Users\\zalo\\Downloads\\photo.zip",
      }),
      row("19", {
        msgType: 18,
        message: { title: "clip.mp4", href: "https://example.test/clip" },
      }),
    ],
  });
  const result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
  });
  assert.equal(
    result.messages[0].attachments[0].localPath,
    "C:\\Users\\zalo\\Downloads\\photo.zip",
  );
  assert.equal(result.messages[0].attachments[0].size, 123);
  assert.equal(result.messages[1].attachments[0].name, "clip.mp4");
  assert.equal(result.messages[1].kind, "video");
  assert.doesNotMatch(JSON.stringify(result), /must-not-export/);
});

test("unsafe numeric IDs are not rounded into another conversation or message", async () => {
  const f = fixture({ rows: [row(Number.MAX_SAFE_INTEGER + 3)] });
  const result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
  });
  assert.equal(result.messages.length, 0);
  await assert.rejects(
    f.run({
      operation: "messages",
      threadId: Number.MAX_SAFE_INTEGER + 3,
      threadType: "user",
    }),
    /INVALID_THREAD/,
  );
});

test("encrypted image can reference only an existing native photo cache without exporting key material", async () => {
  const f = fixture({
    rows: [
      row("20", {
        cliMsgId: "55",
        msgType: 2,
        message: {
          oriUrl: "https://photo.zdn.vn/image?e2esession=fixture-key",
        },
      }),
    ],
  });
  const calls = [];
  f.registry.c["7g0K"] = { exports: { k: { oriUrl: "oriUrl" } } };
  f.registry.c["3tSQ"] = {
    exports: {
      a: {
        getPathIfExistsSync(...args) {
          calls.push(args);
          return {
            path: "C:\\Users\\zalo\\AppData\\Local\\ZaloPC\\100\\ZaloDownloads\\Cache\\200\\gen-o-fixture",
          };
        },
        getEnsuredDir() {
          throw new Error("MUST_NOT_CREATE_DIRECTORY");
        },
      },
    },
  };
  const result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
  });
  assert.deepEqual(calls[0], ["100", "55", "200", "200", "oriUrl", ""]);
  assert.equal(
    result.messages[0].attachments[0].localSource,
    "native-photo-cache",
  );
  assert.equal(
    result.messages[0].attachments[0].sourceState,
    "native-decryption-required",
  );
  assert.doesNotMatch(JSON.stringify(result), /fixture-key|e2esession/);
});

test("incoming message cannot inject localPath; downloaded file cache must verify existing file", async () => {
  const f = fixture({
    rows: [
      row("20", {
        msgType: 19,
        message: { href: "https://file.zdn.vn/a" },
        localPath: "C:\\Users\\zalo\\AppData\\Local\\ZaloPC\\session.db",
      }),
    ],
  });
  let result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
  });
  assert.equal(result.messages[0].attachments[0].localPath, undefined);
  f.registry.c.t77n = {
    exports: {
      a: {
        getFileKey: () => "file-key",
        get: () => ({
          extraInfo: {
            localPath: "C:\\Users\\zalo\\Downloads\\downloaded.zip",
          },
        }),
      },
    },
  };
  result = await f.run({
    operation: "messages",
    threadId: "200",
    threadType: "user",
  });
  assert.equal(
    result.messages[0].attachments[0].localPath,
    "C:\\Users\\zalo\\Downloads\\downloaded.zip",
  );
  assert.equal(
    result.messages[0].attachments[0].localSource,
    "native-download-cache",
  );
});
