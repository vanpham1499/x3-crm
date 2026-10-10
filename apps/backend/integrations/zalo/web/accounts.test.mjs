import { test } from "node:test";
import assert from "node:assert/strict";
import { Accounts, migrateLegacy } from "./accounts.mjs";
const owner = "a".repeat(64);
const duy = {
  id: 1,
  externalId: "123",
  name: "Duy",
  updatedAt: new Date(0).toISOString(),
};

test('campaign binds the selected native account before sending', async () => {
  let sends=0;
  const {manager}=harness(undefined,{sendText:async()=>{sends++;return {status:'sent'};}});
  await manager.restore();
  assert.equal(manager.snapshot(owner).campaignProtocol,1);
  await assert.rejects(manager.command({owner,action:'send-text',accountId:1,conversationId:'9',expectedExternalId:'456',text:'test'}),/WEB_IDENTITY_MISMATCH/);
  assert.equal(sends,0);
});
function harness(
  record = migrateLegacy({ owner, account: duy, enabled: true }),
  extra = {},
) {
  const handles = new Map();
  let saved;
  const manager = new Accounts(record, {
    save: async (value) => {
      saved = structuredClone(value);
    },
    launch: async (profile, onClose) => {
      const handle = {
        value:
          profile === "profile"
            ? { state: "connected", externalId: "123", name: "Duy" }
            : { state: "waiting_scan", qr: "test-only" },
        closed: false,
        close: async () => {
          handle.closed = true;
          onClose();
        },
      };
      handles.set(profile, handle);
      return handle;
    },
    inspect: async (handle) => handle.value,
    ...extra,
  });
  return { manager, handles, saved: () => saved };
}

test('list readiness failure preserves authentication and a later read recovers', async () => {
  let failure = 'WEB_CONVERSATIONS_NOT_READY';
  const { manager } = harness(undefined, { readConversations: async () => {
    if (failure) throw Error('frame.evaluate: ' + failure);
    return [{ conversationId: '9', updatedAt: 1 }];
  }});
  await manager.restore();
  const body = { owner, action: 'conversations' };
  const pending = await manager.command(body);
  assert.equal(pending.accounts[0].state, 'connected');
  assert.equal(pending.accounts[0].error, 'WEB_CONVERSATIONS_NOT_READY');
  failure = 'private arbitrary error text';
  assert.equal((await manager.command(body)).accounts[0].error, 'WEB_CONVERSATIONS_UNAVAILABLE');
  failure = '';
  const ready = await manager.command(body);
  assert.equal(ready.accounts[0].error, null);
  assert.equal(ready.conversations.length, 1);
});

test("directory catalog requires an owned connected and matching account", async () => {
  const calls=[];
  const {manager,handles}=harness(undefined,{directory:async(handle,id)=>{calls.push(id);return {items:[]};},guardConversation:async()=>{throw Error("Unexpected conversation guard");}});
  await manager.restore();
  const body={owner,accountId:1,action:'directory',directory:{kind:'friends'}};
  assert.equal((await manager.command(body)).accountId,1);
  await assert.rejects(manager.command({...body,owner:'b'.repeat(64)}));
  await assert.rejects(manager.command({...body,accountId:99}));
  handles.get('profile').value={state:'connected',externalId:'456',name:'Other'};
  await assert.rejects(manager.command(body));
  assert.deepEqual(calls,['123']);
});

test('phone sync uses only the owned authenticated account without conversation scope', async () => {
  const calls=[];
  const {manager,handles}=harness(undefined,{historySync:async(handle,id,body)=>{calls.push({id,sync:body.sync});return {available:true};},guardConversation:async()=>{throw Error('Unexpected conversation guard');}});
  await manager.restore();
  const body={owner,accountId:1,action:'history-sync',sync:{operation:'status'}};
  assert.equal((await manager.command(body)).accountId,1);
  await assert.rejects(manager.command({...body,owner:'b'.repeat(64)}));
  await assert.rejects(manager.command({...body,accountId:99}));
  handles.get('profile').value={state:'connected',externalId:'456',name:'Other'};
  await assert.rejects(manager.command(body));
  assert.deepEqual(calls,[{id:'123',sync:{operation:'status'}}]);
});

test("friend actions remain account scoped without an existing conversation", async () => {
  const calls=[];
  const {manager}=harness(undefined,{friendAction:async(handle,id)=>{calls.push(id);return {status:"found"};},guardConversation:async()=>{throw Error("Unexpected conversation guard");}});
  await manager.restore();
  const body={owner,accountId:1,action:"friend-action",friend:{kind:"search",phone:"+84325094258"}};
  assert.equal((await manager.command(body)).accountId,1);
  await assert.rejects(manager.command({...body,owner:"b".repeat(64)}));
  await assert.rejects(manager.command({...body,accountId:99}));
  assert.deepEqual(calls,["123"]);
});

test("send uses the owned connected profile and rejects foreign, stopped or changed identities", async () => {
  const calls = [];
  const { manager, handles } = harness(undefined, {
    sendText: async (handle, identity, body) => {
      calls.push({ handle, identity, body });
      return { status: "sent", requestId: body.requestId };
    },
  });
  await manager.restore();
  const body = {
    owner,
    action: "send-text",
    accountId: 1,
    conversationId: "999",
    text: "Fixture",
    requestId: "12345678-1234-1234-1234-123456789abc",
  };
  const sent = await manager.command(body);
  assert.equal(sent.accountId, 1);
  assert.equal(sent.conversationId, "999");
  assert.equal(calls[0].handle, handles.get("profile"));
  assert.equal(calls[0].identity, "123");
  await assert.rejects(manager.command({ ...body, owner: "b".repeat(64) }));
  handles.get("profile").value = {
    state: "connected",
    externalId: "456",
    name: "Other",
  };
  await assert.rejects(manager.command(body));
  await manager.command({ owner, action: "stop", accountId: 1 });
  await assert.rejects(manager.command(body));
  assert.equal(calls.length, 1);
});
test("hidden conversation guard blocks content and mutations, only PIN privacy operations may proceed", async () => {
  const calls = [];
  const { manager } = harness(undefined, {
    guardConversation: async () => {
      throw Error("WEB_CONVERSATION_HIDDEN");
    },
    readMessages: async () => {
      calls.push("messages");
    },
    sendText: async () => {
      calls.push("send");
    },
    conversationSettings: async () => {
      calls.push("privacy");
      return {};
    },
  });
  await manager.restore();
  const body = { owner, accountId: 1, conversationId: "999" };
  for (const action of [
    "messages",
    "send-text",
    "message-action",
    "group-action",
  ])
    await assert.rejects(
      manager.command({ ...body, action }),
      /WEB_CONVERSATION_HIDDEN/,
    );
  await assert.rejects(
    manager.command({
      ...body,
      action: "conversation-settings",
      settings: { kind: "rename", name: "X" },
    }),
    /WEB_CONVERSATION_HIDDEN/,
  );
  await manager.command({
    ...body,
    action: "conversation-settings",
    settings: { kind: "hidden-list", pin: "1234" },
  });
  assert.deepEqual(calls, ["privacy"]);
});
test("legacy profile retained; second login/cancel leaves existing account online", async () => {
  const { manager, handles } = harness();
  await manager.restore();
  await manager.refresh();
  const first = handles.get("profile");
  const result = await manager.command({ owner, action: "begin" });
  assert.equal(result.accounts[0].status, "connected");
  assert.equal(result.login.state, "waiting_scan");
  assert.equal(handles.size, 2);
  assert.notEqual(manager.record.slots[1].profile, "profile");
  await manager.command({ owner, action: "cancel", loginId: result.login.id });
  assert.equal(first.closed, false);
  assert.equal(manager.snapshot(owner).accounts[0].status, "connected");
});
test("two identities persisted, targeted stop, and restart restore enabled profiles only", async () => {
  const { manager, handles, saved } = harness();
  await manager.restore();
  await manager.refresh();
  await manager.command({ owner, action: "begin" });
  const second = manager.record.slots[1];
  handles.get(second.profile).value = {
    state: "connected",
    externalId: "456",
    name: "Second",
  };
  await manager.refresh();
  assert.equal(manager.snapshot(owner).accounts.length, 2);
  assert.equal(manager.snapshot(owner).login.name, "Second");
  const both = harness(saved());
  await both.manager.restore();
  assert.deepEqual([...both.handles.keys()], ["profile", second.profile]);
  await manager.command({ owner, action: "stop", accountId: second.id });
  assert.equal(handles.get("profile").closed, false);
  assert.equal(handles.get(second.profile).closed, true);
  const restart = harness(saved());
  await restart.manager.restore();
  assert.deepEqual([...restart.handles.keys()], ["profile"]);
});
test("duplicate identity and foreign owner cannot overwrite existing binding", async () => {
  const { manager, handles } = harness();
  await manager.restore();
  await manager.refresh();
  const result = await manager.command({ owner, action: "begin" });
  const second = manager.record.slots[1];
  handles.get(second.profile).value = {
    state: "connected",
    externalId: "123",
    name: "Duplicate",
  };
  await manager.refresh();
  assert.equal(manager.snapshot(owner).login.error, "ACCOUNT_ALREADY_LINKED");
  assert.equal(manager.snapshot(owner).accounts.length, 1);
  assert.equal(manager.record.slots[0].account.name, "Duy");
  const oldProfile = second.profile;
  await manager.command({ owner, action: "retry", loginId: result.login.id });
  assert.notEqual(second.profile, oldProfile);
  assert.equal(manager.snapshot("b".repeat(64)).accounts.length, 0);
  await assert.rejects(
    manager.command({ owner: "b".repeat(64), action: "stop", accountId: 1 }),
    /WEB_OWNED/,
  );
  await assert.rejects(
    manager.command({ owner, action: "stop", accountId: 999 }),
    /ACCOUNT_NOT_FOUND/,
  );
  await assert.rejects(
    manager.command({ owner, action: "cancel", loginId: "stale" }),
    /LOGIN_REQUEST_CHANGED/,
  );
  assert.equal(handles.get("profile").closed, false);
});


test('background inbox recovery reloads only the stalled idle account and is capped', async () => {
  let now = 1000, recovered = 0;
  const {manager,handles} = harness(undefined, {
    now: () => now,
    readConversations: async () => { throw Error('WEB_CONVERSATIONS_NOT_READY:preview_loading'); },
    recover: async handle => { recovered++; assert.equal(handle, handles.get('profile')); },
  });
  await manager.restore();
  const body = {owner,action:'conversations',accountId:1};
  for(let i=0;i<5;i++) await manager.command(body);
  now += 100000;
  manager.session(manager.record.slots[0]).lastActivity = now;
  await manager.recoverInbox(); assert.equal(recovered,0, 'active work prevents recovery');
  now += 100000;
  await manager.recoverInbox(); assert.equal(recovered,1);
  for(let i=0;i<5;i++) await manager.command(body);
  now += 100000;
  await manager.recoverInbox(); assert.equal(recovered,2);
  for(let i=0;i<5;i++) await manager.command(body);
  now += 100000;
  await manager.recoverInbox(); assert.equal(recovered,2, 'never reload continuously');
  assert.equal(handles.get('profile').closed,false);
  assert.equal(manager.record.slots[0].account.externalId,'123');
});


test('an in-flight mutation prevents recovery even after the idle time budget', async () => {
  let now = 1000, recovered = 0, finish;
  const {manager} = harness(undefined, {
    now: () => now,
    readConversations: async () => {throw Error('WEB_CONVERSATIONS_NOT_READY:preview_loading');},
    recover: async () => {recovered++;},
    sendText: async () => new Promise(resolve => {finish = resolve;}),
  });
  await manager.restore();
  for(let i=0;i<5;i++) await manager.command({owner,action:'conversations',accountId:1});
  const sending = manager.command({owner,action:'send-text',accountId:1,conversationId:'9',text:'fixture'});
  await new Promise(resolve=>setImmediate(resolve));
  now += 120000;
  await manager.recoverInbox(); assert.equal(recovered,0);
  finish({status:'sent'}); await sending;
  assert.equal(manager.session(manager.record.slots[0]).activeCommands,0);
});


test('fast account emits its inbox before the slow account finishes', async()=>{
 let finish;const packets=[];
 const record={version:2,owner,nextId:3,slots:[
  {id:1,profile:'profile',enabled:true,account:duy},
  {id:2,profile:'profiles/second',enabled:true,account:{...duy,id:2,externalId:'456',name:'Second'}},
 ]};
 const {manager}=harness(record,{
  launch:async(profile)=>({value:{state:'connected',externalId:profile==='profile'?'123':'456',name:'Fixture'},close:async()=>{}}),
  readConversations:async(handle,id)=>id==='123'?[{conversationId:'9',updatedAt:1}]:new Promise(r=>finish=r),
 });
 await manager.restore();
 const pending=manager.command({owner,action:'conversations'},p=>packets.push(p));
 await new Promise(r=>setImmediate(r));assert.equal(packets.length,1);assert.equal(packets[0].accounts[0].id,1);assert.equal(packets[0].partial,true);
 finish([{conversationId:'8',updatedAt:2}]);const result=await pending;
 assert.equal(result.accounts.length,2);assert.equal(result.conversations.length,2);assert.equal(packets.length,2);
});
