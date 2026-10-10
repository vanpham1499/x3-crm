import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { NATIVE_CONVERSATION_SOURCE_BUILD, nativeConversationSourceExpression } from "./native-conversation-source.mjs";

function fixture({ rows = [], cache = [], hidden = false, store = true, accountId = "100", afterRead } = {}) {
  const queries = [], events = [];
  const nope = name => () => { events.push(name); throw new Error(`MUTATION_${name}`); };
  const conversation = { userId: "200", displayName: "Customer", avatar: "https://example.test/customer.png", token: "never-conv-token", userUIN: "never-conv-uin", isGroup: false };
  const messageCache = { _cache: { _map: new Map([["200", { _messages: cache, _active: false }]]) } };
  const registry = { m: {}, c: {
    dThN: { exports: { default: { userId: accountId, sendMsgObject: nope("send"), sendSeen: nope("seen") } } },
    fdn9: { exports: { a: { userId: accountId } } },
    QPNp: { exports: { a: { _convInfoManager: { data: new Map([["200", conversation], ["g300", { userId: "g300", isGroup: true, displayName: "Group", members: ["200", "400"] }]]) }, _convController: { openConversation: nope("open") }, _unreadDataManager: { onReadConversation: nope("read") } } } },
    EFQ6: { exports: { a: { _store: store ? { userId: accountId, _threadsHidden: hidden ? { "200": 1 } : undefined, PIN: "never-pin" } : null, _threadsHidden: {}, isThreadHidden: nope("hidden-loader") } } },
    NDmK: { exports: { default: { enable_hidden_chat: 1 } } },
    fsN4: { exports: { default: { instance: { Core: { Message: { async getAll(range, options) { queries.push({ range, options }); if (afterRead) await afterRead(registry); return rows; }, insertMulti: nope("insert") } } }, getInstance: nope("db-init") } } },
    mE25: { exports: { a: "9999999999999999999", b: "9999999999999999" } },
    wH4e: { exports: { c: { PREV: "prev" } } },
    MPLC: { exports: { b: { userId: accountId, messageCache } } },
    JWY6: { exports: { a: { _cacheProfileInfo: { "100": { userId: "100", displayName: "Owner", password: "never-password" }, "200": { userId: "200", displayName: "Customer", avatar: "https://example.test/image.png", phoneNumber: "never-phone", token: "never-profile-token" }, "400": { userId: "400", displayName: "Member" } }, _aliasName: { "200": "Customer alias" }, getProfileById: nope("profile-load") } } },
    "8apa": { exports: { a: { _cacheGroupInfo: { g300: { userId: "g300", displayName: "Group", creatorId: "100", sessionKey: "never-group-key" } } } } },
  } };
  const chunks = [];
  chunks.push = record => {
    Array.prototype.push.call(chunks, record);
    const [id] = record[0];
    registry.m[id] = record[1][id]; registry.c[id] = { exports: {} };
    record[1][id](registry.c[id], registry.c[id].exports, registry);
  };
  const context = vm.createContext({ location: { protocol: "file:" }, $zelectron: { openDevTool() {} }, webpackJsonp: chunks, Map, Set, URL, TextEncoder });
  const run = options => vm.runInContext(nativeConversationSourceExpression({ ...NATIVE_CONVERSATION_SOURCE_BUILD, expectedAccountId: "100", accountSlot: "account-1", threadId: "200", threadType: "user", ...options }), context);
  return { registry, context, chunks, queries, events, conversation, messageCache, run };
}
const message = (id, overrides = {}) => ({ msgId: String(id), cliMsgId: String(id + 1000), toUid: "200", fromUid: "200", msgType: 0, message: `Message ${id}`, sendDttm: 1700000000000 + id, status: 1, ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));

test('reaction cache enrichment is bound to source owner, conversation and message pair',async()=>{
 const f=fixture({rows:[message(1),message(2),message(3)]});
 const reactions={
  '1':{idTo:'200',rMsgId:'1',rClientMsgId:'1001',total:3},
  '2':{idTo:'999',rMsgId:'2',rClientMsgId:'1002',total:9},
  '3':{idTo:'200',rMsgId:'3',rClientMsgId:'9999',total:9}
 };
 f.registry.c.ofhN={exports:{b:{userId:'100',getMessageReactions:async()=>reactions}}};
 const result=await f.run();
 assert.equal(result.messages.find(m=>m.msgId==='1').reacts.total,3);
 assert.equal(result.messages.find(m=>m.msgId==='2').reacts,undefined);
 assert.equal(result.messages.find(m=>m.msgId==='3').reacts,undefined);
 f.registry.c.ofhN.exports.b.userId='999';
 assert.equal((await f.run()).messages.find(m=>m.msgId==='1').reacts,undefined);
 assert.deepEqual(f.events,[]);
});

test('group cards read source Poll/Topic records and reject another conversation detail',async()=>{
 const poll=message(10,{toUid:'g300',msgType:26,message:{action:'create',params:'{"pollId":7}'}});
 const remind=message(11,{toUid:'g300',msgType:25,message:{params:{actions:[{actionId:'action.open.reminder',data:JSON.stringify({data:JSON.stringify({topicId:'360287970482307271'})})}]}}});
 const f=fixture({rows:[poll,remind]}),core=f.registry.c.fsN4.exports.default.instance.Core;
 const calls=[];
 core.Poll={get:async id=>{calls.push(id);return {poll_id:7,group_id:'300',question:'Question',options:[],token:'discard'};}};
 core.Topic={get:async key=>{calls.push(key);return{id:key[1],groupId:'300',responseMem:{acceptMember:1,myResp:1}};}};
 const result=plain(await f.run({threadId:'300',threadType:'group'}));
 assert.deepEqual(plain(calls),[7,['300','360287970482307271']]);
 assert.equal(result.messages.find(r=>r.msgType===26).sourceBoard.sourceAccountId,'100');
 assert.equal(result.messages.find(r=>r.msgType===26).sourceBoard.data.token,undefined);
 assert.equal(result.messages.find(r=>r.msgType===25).sourceBoard.data.responseMem.myResp,1);
 core.Poll.get=async()=>({poll_id:7,group_id:'999'});
 assert.equal((await f.run({threadId:'300',threadType:'group'})).messages.find(r=>r.msgType===26).sourceBoard,undefined);
 assert.deepEqual(f.events,[]);
});

test('group system rows retain null sender and event payload without dropping history', async () => {
  const eventInfo={source:{id:'400',dName:'Member'},updateMembers:[{id:'400',dName:'Member'}],updateInfo:null};
  const rows=[message(1,{toUid:'g300',fromUid:null,msgType:-4,act:'leave',eventInfo,updateMemberIds:['400']}),
    message(2,{toUid:'g300',fromUid:'400',msgType:26,message:{action:'vote',params:'{"pollId":12,"question":"Question","msg":{"vi":"%1$s voted %2$s"}}'}})];
  const f=fixture({rows}),result=plain(await f.run({threadId:'300',threadType:'group'}));
  assert.equal(result.messages.length,2);assert.equal(result.coverage.skipped,0);
  assert.equal(result.messages[0].fromUid,null);assert.equal(result.messages[0].act,'leave');
  assert.deepEqual(result.messages[0].eventInfo,eventInfo);
  assert.ok(result.profiles.every(p=>p.userId));assert.deepEqual(f.events,[]);
  const bad=fixture({rows:[message(3,{fromUid:null,msgType:1})]});
  assert.equal((await bad.run()).messages.length,1);
});

test('dotted native local event IDs survive extraction and exclusive cursor pagination',async()=>{
  const event=message(1,{toUid:'g300',msgId:'.1790590654863_001',fromUid:null,msgType:-4,act:'join',
    eventInfo:{source:{id:'400',dName:'Member'},updateMembers:[{id:'400',dName:'Member'}],updateInfo:null}});
  const f=fixture({rows:[message(2,{toUid:'g300'}),event]});
  const result=plain(await f.run({threadId:'300',threadType:'group',limit:1}));
  assert.equal(result.coverage.skipped,0);
  const page=await f.run({threadId:'300',threadType:'group',cursor:{sendDttm:String(event.sendDttm),msgId:event.msgId}});
  assert.equal(page.messages[0].msgId,event.msgId);assert.equal(page.messages[0].fromUid,null);
  assert.equal(f.queries.at(-1).range.to[2],event.msgId);assert.equal(f.queries.at(-1).range.excludeTo,true);
  assert.deepEqual(f.events,[]);
});

test('empty My Documents uses the pinned native model without mutating cache or receipts',async()=>{
 const f=fixture(),manager=f.registry.c.QPNp.exports.a._convInfoManager;
 manager.getEmptyConv=vm.runInNewContext(`({getEmptyConv(e){return{userId:e,isGroup:e.startsWith(ee.GROUPID_PREFIX),numMsg:0,respondedByMe:!1,pinned:0,label:null,outside:null,infoCheckSearch:null,topOut:null}}}).getEmptyConv`,{ee:{GROUPID_PREFIX:'g'}});
 const before=manager.data.size;
 const data=await f.run({threadId:'100',accountSlot:'account-3'});
 assert.equal(data.conversation.userId,'100');assert.equal(data.messages.length,0);
 assert.equal(data.ownProfile.displayName,'Owner');assert.equal(manager.data.size,before);
 assert.deepEqual(f.events,[]);
 await assert.rejects(f.run({threadId:'999'}),/THREAD_NOT_CACHED/);
 manager.getEmptyConv=()=>({userId:'100'});
 await assert.rejects(f.run({threadId:'100'}),/EMPTY_FACTORY_CHANGED/);
});

test('named lightweight profiles fill avatar and cover from source DB without changing cache or alias',async()=>{
 const f=fixture({rows:[message(1)]}),friends=f.registry.c.JWY6.exports.a;
 friends._cacheProfileInfo['200']={userId:'200',displayName:'Cached name',avatar:''};
 const before=JSON.stringify(friends._cacheProfileInfo);
 f.registry.c.fsN4.exports.default.instance.Core.FriendsInfo={async getMultiIfExists(){return[{userId:'200',displayName:'DB name',cover:'https://example.test/cover.jpg'}];}};
 f.registry.c.fsN4.exports.default.instance.Core.Friend={async getMultiIfExists(){return[{userId:'200',avatar:'https://example.test/avatar.jpg',token:'never-secret'}];}};
 const result=plain(await f.run()),contact=result.profiles.find(p=>p.userId==='200');
 assert.equal(contact.displayName,'Customer alias');
 assert.equal(contact.avatar,'https://example.test/avatar.jpg');
 assert.equal(contact.cover,'https://example.test/cover.jpg');
 assert.equal(JSON.stringify(friends._cacheProfileInfo),before);
 assert.ok(!JSON.stringify(result).includes('never-secret'));
 assert.deepEqual(f.events,[]);
});

test('avatar image signatures survive only on native image hosts while account secrets remain stripped',async()=>{
 const f=fixture();
 const image='https://s160-26-ava-talk.zadn.vn/image?key=image-signature&time=123';
 f.registry.c.JWY6.exports.a._cacheProfileInfo['200'].avatar=image;
 assert.equal((await f.run()).profiles[0].avatar,image);
 for(const url of ['https://evil.test/image?key=secret','https://s160-26-ava-talk.zadn.vn/image?token=secret','https://s160-26-ava-talk.zadn.vn/image?e2esession=secret']){
   f.registry.c.JWY6.exports.a._cacheProfileInfo['200'].avatar=url;
   assert.equal((await f.run()).profiles[0].avatar,undefined);
 }
});

test('group mini-profile cache is read only for its owner and never invokes migrating getters',async()=>{
 const f=fixture({rows:[message(1,{toUid:'g300',fromUid:'500'})]});
 f.registry.c.DiYL={exports:{a:{userId:'100'}}};
 f.registry.c.igA5={exports:{default:{instance:{userScopedPrefix:'owner100'}}}};
 const cache={owner100_500:JSON.stringify({zName:'Mini member',avatar:'https://example.test/mini.jpg',token:'never-secret'})};
 f.registry.c.ej3F={exports:{b:{_memCache:cache,getItemForCurrentUser(){throw Error('MIGRATING_GETTER_CALLED')}}}};
 const before=JSON.stringify(cache),result=await f.run({threadId:'300',threadType:'group'});
 assert.equal(result.profiles.find(p=>p.userId==='500').displayName,'Mini member');
 assert.equal(result.profiles.find(p=>p.userId==='500').avatar,'https://example.test/mini.jpg');
 assert.ok(!JSON.stringify(result).includes('never-secret'));assert.equal(JSON.stringify(cache),before);
 f.registry.c.DiYL.exports.a.userId='999';
 assert.equal((await f.run({threadId:'300',threadType:'group'})).profiles.find(p=>p.userId==='500').avatar,undefined);
 assert.deepEqual(f.events,[]);
});

test('group sender profiles are read from local FriendsInfo without warming host caches',async()=>{
 const f=fixture({rows:[message(1,{toUid:'g300',fromUid:'500'})]});
 const calls=[];
 f.registry.c.fsN4.exports.default.instance.Core.FriendsInfo={async getMultiIfExists(ids){calls.push([...ids]);return[{userId:'500',zaloName:'Local group member',token:'never-token'}];}};
 const result=plain(await f.run({threadId:'300',threadType:'group'}));
 assert.deepEqual(calls,[['500','100']]);
 assert.equal(result.profiles.find(p=>p.userId==='500').displayName,'Local group member');
 assert.equal(f.registry.c.JWY6.exports.a._cacheProfileInfo['500'],undefined);
 assert.ok(!JSON.stringify(result).includes('never-token'));
 assert.deepEqual(f.events,[]);
});

test('serialized quote attachments are sanitized recursively',async()=>{
 const f=fixture({rows:[message(1,{quote:{attach:JSON.stringify({title:'Quote file',token:'never-secret',params:JSON.stringify({cookie:'never-cookie',ext:'pdf'})})}})]});
 const result=plain(await f.run());
 const attach=JSON.parse(result.messages[0].quote.attach);
 assert.equal(attach.title,'Quote file');
 assert.deepEqual(JSON.parse(attach.params),{ext:'pdf'});
 assert.ok(!JSON.stringify(result).includes('never-'));
});

test('a missing group participant gets an explicit unknown name without borrowing any host profile',async()=>{
 const f=fixture({rows:[message(1,{toUid:'g300',fromUid:'500'})]});
 const result=plain(await f.run({threadId:'300',threadType:'group'}));
 assert.equal(result.profiles.find(p=>p.userId==='500').displayName,'Thành viên chưa có tên');
 assert.equal(result.messages.length,1);
 assert.deepEqual(f.events,[]);
});

test("source native names use account aliases, phonebook then cached names and preserve isFr", async () => {
  const f = fixture(), friends = f.registry.c.JWY6.exports.a;
  friends._cacheProfileInfo["100"] = {userId:"100",zaloName:"Owner native name",isFr:0};
  friends._cacheProfileInfo["200"] = {userId:"200",zaloName:"Contact native name",isFr:1};
  const first = plain(await f.run());
  assert.equal(first.ownProfile.displayName,"Owner native name");
  assert.equal(first.ownProfile.isFr,0);
  assert.equal(first.profiles[0].displayName,"Customer alias");
  assert.equal(first.profiles[0].isFr,1);
  friends._aliasName["200"]=""; friends._phonebookName={"200":"Phonebook name"};
  assert.equal((await f.run()).profiles[0].displayName,"Phonebook name");
  delete friends._phonebookName["200"];
  assert.equal((await f.run()).profiles[0].displayName,"Contact native name");
  assert.equal(friends._cacheProfileInfo["200"].displayName,undefined);
  assert.deepEqual(f.events,[]);
});

test("source reads local native rows chronologically without selecting or marking a conversation", async () => {
  const f = fixture({ rows: [message(3), message(2), message(1)] });
  const result = plain(await f.run({ limit: 2 }));
  assert.deepEqual(result.messages.map(row => row.msgId), ["2", "3"]);
  assert.equal(result.sourceAccountId, "100"); assert.equal(result.accountSlot, "account-1");
  assert.equal(result.nativeConversationId, "200");
  assert.equal(result.conversation.displayName, "Customer");
  assert.equal(result.profiles[0].displayName, "Customer alias");
  assert.deepEqual(result.nextCursor, { sendDttm: "1700000000002", msgId: "2" });
  assert.deepEqual(plain(f.queries), [{ range: { from: ["200", "", ""], to: ["200", "9999999999999999", "9999999999999999999"], excludeFrom: false, excludeTo: false }, options: { index: "userId_sendDttm_msgId", direction: "prev", limit: 3, partition: "200", useLGKeyRange: true } }]);
  assert.deepEqual(f.events, []); assert.equal(f.messageCache._cache._map.get("200")._active, false);
  assert.equal(f.chunks.length, 0); assert.deepEqual(Object.keys(f.registry.m), []);
  assert.equal(result.coverage.nativeModels, true);
});

test("source exports only display profiles and removes credentials from structured message metadata", async () => {
  const f = fixture({ rows: [message(1, { UIN: "never-uin", localPath: "C:/private/profile", message: { title: "Invoice", token: "never-token", href: "https://example.test/file", params: JSON.stringify({ duration: 20, decryptKey: "never-decrypt", metadata: { authToken: "never-auth" } }) }, quote: { msgId: "88", message: "Literal password text is content", cookie: "never-cookie" }, reactions: [{ type: 1, count: 2, sessionKey: "never-session" }], content: { avatar: "https://example.test/a?token=never-query", nested: { publicKey: "never-public" } } })] });
  const result = plain(await f.run());
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("never-"), false);
  assert.equal(serialized.includes("C:/private"), false);
  assert.equal(result.messages[0].message.href, "https://example.test/file");
  assert.equal(result.messages[0].quote.message, "Literal password text is content");
  assert.deepEqual(JSON.parse(result.messages[0].message.params), { duration: 20, metadata: {} });
  assert.deepEqual(result.ownProfile, { userId: "100", displayName: "Owner" });
});

test("getters, toJSON and prototype hooks are never invoked while serializing models", async () => {
  const row = message(1, { quote: { title: "Quote", toJSON() { throw new Error("TO_JSON_EXECUTED"); } } });
  Object.defineProperty(row, "content", { enumerable: true, get() { throw new Error("GETTER_EXECUTED"); } });
  Object.defineProperty(row.quote, "token", { enumerable: true, get() { throw new Error("SECRET_GETTER_EXECUTED"); } });
  const f = fixture({ rows: [row] });
  const result = plain(await f.run());
  assert.deepEqual(result.messages[0].quote, { title: "Quote" });
  assert.equal(result.messages[0].content, undefined);
});

test("encrypted media URLs and keys do not cross the native source boundary", async () => {
  const f = fixture({ rows: [message(1, { message: { oriUrl: "https://photo.zdn.vn/image?e2esession=never-key", thumbUrl: "https://photo.zdn.vn/thumb?%65%32%65session=never-key", params: JSON.stringify({ hd: "https://photo.zdn.vn/image?e2esession=never-key", aesKey: "never-aes", iv: "never-iv", width: 300 }) } })] });
  const result = plain(await f.run());
  assert.doesNotMatch(JSON.stringify(result), /never-|e2esession/i);
  assert.deepEqual(JSON.parse(result.messages[0].message.params), { width: 300 });
});

test("nested native file paths are removed without reading their getters or changing display metadata", async () => {
  const fileMetadata = {
    path: "C:/never-path/file", localPath: "C:/never-local/file", folderPath: "C:/never-folder",
    autoDownloadPath: "C:/never-auto/file", cachePath: "C:/never-cache/file", filePath: "C:/never-file/file",
    imageLocalPath: "C:/never-image/file", checkedLocalPath: "C:/never-checked/file", oriPath: "C:/never-original/file",
    savePath: "C:/never-save/file", srcPath: "C:/never-source/file", saveDir: "C:/never-directory",
    title: "File name.pdf", fileSize: 4096, width: 300,
  };
  const f = fixture({ rows: [message(1, {
    msgType: 19,
    message: { title: "File name.pdf", extraInfo: JSON.stringify(fileMetadata), params: JSON.stringify({ nested: fileMetadata }) },
    attachments: [fileMetadata], content: { metadata: fileMetadata },
  })] });
  Object.defineProperty(f.conversation, "cachePath", { enumerable: true, get() { throw new Error("PATH_GETTER_EXECUTED"); } });
  Object.defineProperty(fileMetadata, "LOCALPATH", { enumerable: true, get() { throw new Error("PATH_GETTER_EXECUTED"); } });
  const result = plain(await f.run()), row = result.messages[0];
  assert.doesNotMatch(JSON.stringify(result), /never-|C:\//);
  const expected = { title: "File name.pdf", fileSize: 4096, width: 300 };
  assert.deepEqual(row.attachments, [expected]);
  assert.deepEqual(row.content.metadata, expected);
  assert.deepEqual(JSON.parse(row.message.extraInfo), expected);
  assert.deepEqual(JSON.parse(row.message.params), { nested: expected });
  assert.equal(fileMetadata.localPath, "C:/never-local/file");
  assert.deepEqual(f.events, []);
});

test("native encrypted URL schemes are removed only from structured metadata, retaining literal text and generic HTTPS links", async () => {
  const encrypted = "e2ee://photo.zdn.vn/image?e2esession=fixture-key";
  const f = fixture({ rows: [message(1, {
    msgType: 2,
    message: { thumbUrl: encrypted, oriUrl: "  E2EE://photo.zdn.vn/image", hdUrl: "e2e://photo.zdn.vn/image", normalUrl: "https://example.test/image",
      title: encrypted, description: encrypted,
      params: JSON.stringify({ hd: encrypted, rawUrl: encrypted, width: 300, href: "https://example.test/article" }) },
    content: { text: encrypted, href: "https://example.test/article" },
    quote: { message: encrypted },
  }), message(2, { msgType: 1, message: encrypted })] });
  const result = plain(await f.run()), photo = result.messages[0];
  assert.equal(photo.message.thumbUrl, undefined);
  assert.equal(photo.message.oriUrl, undefined);
  assert.equal(photo.message.hdUrl, undefined);
  assert.equal(photo.message.normalUrl, "https://example.test/image");
  assert.deepEqual(JSON.parse(photo.message.params), { width: 300, href: "https://example.test/article" });
  assert.equal(photo.message.title, encrypted);
  assert.equal(photo.message.description, encrypted);
  assert.equal(photo.content.text, encrypted);
  assert.equal(photo.content.href, "https://example.test/article");
  assert.equal(photo.quote.message, encrypted);
  assert.equal(result.messages[1].message, encrypted);
  assert.deepEqual(f.events, []);
});

test("source refuses wrong identity, unregistered bundle, unsafe inputs, and uncached conversations before query", async () => {
  for (const options of [{ expectedAccountId: "101" }, { version: "27.0" }, { sha256: "0".repeat(64) }, { accountSlot: "../account-1" }, { threadId: "200;send()" }, { threadType: "page" }, { threadId: "999" }]) {
    const f = fixture(); await assert.rejects(f.run(options), /CONVERSATION_SOURCE_/); assert.equal(f.queries.length, 0); assert.deepEqual(f.events, []);
  }
});

test("hidden conversations and unknown hidden state cannot bypass native PIN by reading local DB", async () => {
  const hidden = fixture({ hidden: true }); await assert.rejects(hidden.run(), /HIDDEN_THREAD/); assert.equal(hidden.queries.length, 0);
  const unavailable = fixture({ store: false }); await assert.rejects(unavailable.run(), /HIDDEN_STATE_UNAVAILABLE/); assert.equal(unavailable.queries.length, 0);
  const disabled = fixture({ store: false }); disabled.registry.c.NDmK.exports.default.enable_hidden_chat = 0; await disabled.run(); assert.equal(disabled.queries.length, 1);
});

test("account change, conversation replacement and hidden change during DB await fail closed", async () => {
  const drift = fixture({ afterRead: registry => { registry.c.fdn9.exports.a.userId = "999"; } });
  await assert.rejects(drift.run(), /ACCOUNT_MISMATCH/);
  const replaced = fixture({ afterRead: registry => { registry.c.QPNp.exports.a._convInfoManager.data.set("200", { userId: "200" }); } });
  await assert.rejects(replaced.run(), /THREAD_CHANGED/);
  const hidden = fixture({ afterRead: registry => { registry.c.EFQ6.exports.a._store._threadsHidden = { "200": true }; } });
  await assert.rejects(hidden.run(), /HIDDEN_THREAD/);
});

test("initial page merges initialized same-account cache without triggering active setters or loaders", async () => {
  const f = fixture({ rows: [message(2), message(1)], cache: [message(2, { message: "Updated cache" }), message(3), message(4, { toUid: "999" })] });
  const result = plain(await f.run({ limit: 2 }));
  assert.deepEqual(result.messages.map(row => row.msgId), ["2", "3"]);
  assert.equal(result.messages[0].message, "Updated cache");
  assert.deepEqual(result.nextCursor, { sendDttm: "1700000000002", msgId: "2" });
  assert.equal(result.coverage.cacheMessages, 2); assert.deepEqual(f.events, []);
  const other = fixture({ cache: [message(3)] }); other.registry.c.MPLC.exports.b.userId = "999";
  assert.equal((await other.run()).messages.length, 0);
});

test("cursor pages remain exclusive, retain exact large IDs, and exclude live cache", async () => {
  const f = fixture({ rows: [message(1, { msgId: "9007199254740993122", sendDttm: "1700000000000" }), message(2, { msgId: "9007199254740993121", sendDttm: "1700000000000" })], cache: [message(50)] });
  const result = plain(await f.run({ cursor: { sendDttm: "1700000000001", msgId: "9007199254740993123" } }));
  assert.deepEqual(result.messages.map(row => row.msgId), ["9007199254740993121", "9007199254740993122"]);
  assert.equal(f.queries[0].range.excludeTo, true); assert.equal(result.coverage.cacheMessages, 0);
  const invalid = fixture(); await assert.rejects(invalid.run({ cursor: { msgId: "x;run", sendDttm: 2 } }), /CURSOR_INVALID/); assert.equal(invalid.queries.length, 0);
});

test("group messages preserve native conversation ID and sender profiles without exporting unrelated account data", async () => {
  const f = fixture({ rows: [message(1, { toUid: "g300", fromUid: "400", quote: { fromUid: "200", message: "Quoted" }, msgType: 7, message: { title: "Image", oriUrl: "https://example.test/photo.jpg", width: 400, height: 300 } })] });
  const result = plain(await f.run({ threadId: "300", threadType: "group" }));
  assert.equal(result.nativeConversationId, "g300"); assert.equal(result.conversation.isGroup, true);
  assert.equal(result.messages[0].toUid, "g300");
  assert.deepEqual(result.profiles.map(profile => profile.userId), ["g300", "400"]);
  assert.equal(f.queries[0].options.partition, "g300");
});

test("database errors never serialize private native details and malformed rows are skipped", async () => {
  const failed = fixture({ afterRead: () => { throw new Error("secret native message data"); } });
  await assert.rejects(failed.run(), error => error.message === "CONVERSATION_SOURCE_DATABASE_FAILED");
  const f = fixture({ rows: [message(1, { toUid: "999" }), message(2, { fromUid: "not-an-id" }), message(3)] });
  const result = plain(await f.run());
  assert.equal(result.messages.length, 1); assert.equal(result.coverage.skipped, 2);
});

test("oversize, recursive and excessive native data stop at explicit bounded payload limits", async () => {
  const long = fixture({ rows: [message(1, { message: "x".repeat(65537) })] }); await assert.rejects(long.run(), /PAYLOAD_LIMIT/);
  const nested = {}; nested.again = nested;
  const cycle = fixture({ rows: [message(1, { message: nested })] }); await assert.rejects(cycle.run(), /PAYLOAD_LIMIT/);
  const array = fixture({ rows: [message(1, { message: Array(1025).fill(0) })] }); await assert.rejects(array.run(), /PAYLOAD_LIMIT/);
  const huge = fixture({ rows: Array.from({ length: 40 }, (_, index) => message(index, { message: "x".repeat(60000) })) }); await assert.rejects(huge.run(), /PAYLOAD_LIMIT/);
});

test("expression forwards only bounded adapter options and no credential or executable property", () => {
  const expression = nativeConversationSourceExpression({ ...NATIVE_CONVERSATION_SOURCE_BUILD, expectedAccountId: "100", accountSlot: "account-1", threadId: "200", threadType: "user", password: "must-not-cross", method: "send", cursor: { sendDttm: "1", msgId: "2", token: "must-not-cross" } });
  assert.equal(expression.includes("must-not-cross"), false);
  assert.equal(expression.endsWith('"cursor":{"sendDttm":"1","msgId":"2"},"completeAlbums":false})'), true);
});

test('shared page completes a mixed album cut at its oldest edge, with a bounded source read',async()=>{
 const photo=(id,pos,type=2)=>message(id,{msgType:type,message:{params:JSON.stringify({is_group_layout:1,group_layout_id:456,total_item_in_group:4,id_in_group:pos})}});
 const initial=[message(7),photo(6,3),photo(5,2,18),photo(4,1)],older=[photo(4,1),photo(3,0),message(2)];
 const f=fixture({rows:initial});const core=f.registry.c.fsN4.exports.default.instance.Core;let calls=0;
 core.Message.getAll=async(range,opts)=>{f.queries.push({range,options:opts});return calls++?older:initial;};
 const result=plain(await f.run({limit:3,completeAlbums:true}));
 assert.deepEqual(result.messages.map(r=>r.msgId),['3','4','5','6','7']);
 assert.equal(result.coverage.albumBoundaryAdded,2);assert.equal(f.queries[1].options.limit,3);
 assert.equal(f.queries[1].range.excludeTo,true);assert.equal(result.nextCursor.msgId,'3');assert.deepEqual(f.events,[]);
});
test('album completion never crosses into a different sender or conversation',async()=>{
 const p=(id,fromUid)=>message(id,{fromUid,msgType:2,message:{params:JSON.stringify({is_group_layout:1,group_layout_id:456,total_item_in_group:2,id_in_group:id-2})}});
 const f=fixture({rows:[p(3,'200'),p(2,'999')]});let count=0;
 f.registry.c.fsN4.exports.default.instance.Core.Message.getAll=async()=>count++?[p(2,'999')]:[p(3,'200'),p(2,'999')];
 const r=await f.run({limit:1,completeAlbums:true});assert.equal(r.messages.length,1);assert.equal(r.coverage.albumBoundaryAdded,0);
});
