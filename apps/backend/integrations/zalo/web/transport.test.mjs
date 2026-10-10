import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler, Events } from "./transport.mjs";
test("read lanes do not block send/accounts; lifecycle barrier preserves ordering", async () => {
  const scheduler = new Scheduler(),
    order = [];
  let finish;
  const history = scheduler.run(
    "1:messages",
    () =>
      new Promise((r) => {
        finish = r;
        order.push("history");
      }),
  );
  await scheduler.run("1:send", () => order.push("send"));
  await scheduler.run("2:messages", () => order.push("second"));
  assert.deepEqual(order, ["history", "send", "second"]);
  const stop = scheduler.run(null, () => order.push("stop"));
  const after = scheduler.run("2:messages", () => order.push("after"));
  finish();
  await Promise.all([history, stop, after]);
  assert.deepEqual(order, ["history", "send", "second", "stop", "after"]);
  await assert.rejects(
    scheduler.run("bad", () => {
      throw Error("bad");
    }),
  );
  await scheduler.run("bad", () => {});
  await scheduler.idle();
  assert.equal(scheduler.lanes.size, 0);
});
test("events are owner scoped and subscribers detach", () => {
  const events = new Events(),
    a = [],
    b = [];
  const off = events.subscribe("a", (x) => a.push(x));
  events.subscribe("b", (x) => b.push(x));
  events.publish("a", 1);
  assert.equal(a.length, 2);
  assert.equal(b.length, 1);
  off();
  events.publish("a", 1);
  assert.equal(a.length, 2);
  assert.equal(events.listeners.size, 1);
});


test('native observer ignores UI dispatch, scopes loaded messages and detaches all listeners', async()=>{
 const {watchNative}=await import('./transport.mjs');const vm=await import('node:vm');
 const events=[], listeners=[new Set(),new Set()], busListeners=new Set();
 let state={conversations:{alls:{'12':{messages:[],msgList:[],messageCache:{},needReloadMessage:false}}}};
 const main={getState:()=>state,subscribe:fn=>{listeners[0].add(fn);return()=>listeners[0].delete(fn)}};
 const list={subscribe:fn=>{listeners[1].add(fn);return()=>listeners[1].delete(fn)}};
 const bus={subscribe:fn=>busListeners.add(fn),unsubscribe:fn=>busListeners.delete(fn)};
 const modules={'dThN':{default:{userId:'123'}},'emRR':{default:main},'CzFt':{a:list},'Ydol':{default:bus},'97kL':{a:{RECALL_MESSAGE:'recall'}}};
 const req={c:Object.fromEntries(Object.entries(modules).map(([id,exports])=>[id,{exports}])),m:{}};
 const sandbox={crypto:{randomUUID:()=>String(Math.random())},setTimeout,clearTimeout};
 sandbox.webpackJsonp=[];sandbox.webpackJsonp.push=chunk=>{Array.prototype.push.call(sandbox.webpackJsonp,chunk);Object.values(chunk[1])[0](null,null,req)};
 const context=vm.createContext(sandbox);
 const frame={url:()=> 'https://chat.zalo.me/',evaluate:async(fn,args)=>vm.runInContext(`(${fn.toString()})`,context)(args)};
 const page={frames:()=>[frame],exposeBinding:async(name,fn)=>sandbox[name]=async(...a)=>fn({frame},...a)};
 await watchNative(page,'123',e=>events.push(e));
 const tick=()=>new Promise(r=>setTimeout(r,180));
 try{
  state={...state,ui:{clock:1}};listeners[0].forEach(fn=>fn());await tick();assert.equal(events.length,0);
  state.conversations.alls['12']={...state.conversations.alls['12'],lastActive:9};listeners[0].forEach(fn=>fn());await tick();assert.equal(events.length,0);
  state.conversations.alls['12']={...state.conversations.alls['12'],messages:[{id:'5'}]};listeners[0].forEach(fn=>fn());await tick();
  assert.deepEqual(Array.from(events[0].conversationIds),['12']);assert.ok(events[0].areas.includes('messages'));
  busListeners.forEach(fn=>fn('recall',{conversationId:'13'}));await tick();assert.deepEqual(Array.from(events[1].conversationIds),['13']);
  busListeners.forEach(fn=>fn('recall',{messageId:'13',userId:'999'}));await tick();assert.equal(events[2].conversationIds,undefined,'ambiguous actor/message ID must not be treated as conversation');
  listeners[1].forEach(fn=>fn());await tick();assert.deepEqual(Array.from(events[3].areas),['inbox']);
 }finally{sandbox.__zaloTeamWatch.dispose();}
 assert.equal(listeners[0].size+listeners[1].size+busListeners.size,0);
});
