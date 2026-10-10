import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FriendActions, friendInPage } from './friend-actions.mjs';
import { validCommand } from './guards.mjs';
const body={owner:'a'.repeat(64),accountId:1,action:'friend-action',friend:{kind:'search',phone:'+84325094258'}};
test('friend commands require account, strict phone, target and receipt; standalone group cannot add members',()=>{
  assert.equal(validCommand(body),true);
  for(const change of [{accountId:undefined},{conversationId:'123'},{friend:{...body.friend,phone:'bad'}},{friend:{...body.friend,url:'x'}}])assert.equal(validCommand({...body,...change}),false);
  const send={...body,requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',friend:{...body.friend,kind:'send',userId:'123',message:'Xin chào'}};
  assert.equal(validCommand(send),true);assert.equal(validCommand({...send,requestId:undefined}),false);
  assert.equal(validCommand({...send,friend:{...send.friend,message:' '.repeat(3)}}),false);
  assert.equal(validCommand({...body,action:'group-action',friend:undefined,group:{kind:'catalog'}}),true);
  assert.equal(validCommand({...body,action:'group-action',friend:undefined,group:{kind:'add',members:['123']},requestId:send.requestId}),false);
});
test('invitation receipt prevents repeat sends and cross-account receipt reuse',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'zalo-friend-'));
  let calls=0;
  const action=new FriendActions(root,async(p,args)=>{if(args.phase==='apply'){calls++;throw Error('WEB_FRIEND_SEND_UNKNOWN');}return {person:{isFriend:false,requested:false}};});
  const send={...body,requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',friend:{...body.friend,kind:'send',userId:'123',message:'Xin chào'}};
  try { assert.equal((await action.run({},'42',send)).status,'unknown');await action.run({},'42',send);assert.equal(calls,1);await assert.rejects(action.run({},'43',{...send,accountId:2}),/CONFLICT/);}
  finally {await fs.rm(root,{recursive:true,force:true});}
});
test('native friend lookup and send verify account and phone target; already requested never sends twice',async()=>{
  let sends=0,requested=false,lookupId='123',expectedSource=85,openResult=true;
  const visible=['123'];let hidden=false,opens=0;
  const modules={NDmK:{default:{sendToMeId:'999'}},EFQ6:{a:{isThreadHidden:()=>hidden}},WQAo:{b:'navigation',c:{fromSearchList:p=>p}},jDHv:{ModuleContainer:{resolve:type=>type==='navigation'?{openConversation:async id=>{opens++;return openResult;}}:{getList:()=>visible}}},iZzu:{ConvListController:'list'},'3xbP':{c:'main'},dThN:{default:{userId:'42'}},UiPd:{default:{getInfoByPhone:async()=>({userId:lookupId,zaloName:'Test'}),getProfileFriendById:async id=>({userId:id,zaloName:'Test'}),isFriend:()=>false,isBlocked:()=>false}},Py3H:{a:{getStatusFriendRequest:async()=>{},isIRequestYou:()=>requested,isYouRequestMe:()=>false,requestAddFriend:async(id,text,src)=>{assert.equal(id,'123');assert.equal(src,expectedSource);sends++;requested=true;}}}};
  const require={c:Object.fromEntries(Object.entries(modules).map(([k,exports])=>[k,{exports}])),m:{}};
  const prev=globalThis.webpackJsonp, oldScope=globalThis.__zaloTeamPhonePeers;
  globalThis.webpackJsonp=[];globalThis.webpackJsonp.push=chunk=>{Object.values(chunk[1])[0]({}, {},require);return Array.prototype.push.call(globalThis.webpackJsonp,chunk);};
  const args={expectedId:'42',friend:{...body.friend,kind:'send',userId:'123',message:'Xin chào'},phase:'apply'};
  try {
    await assert.rejects(friendInPage({...args,expectedId:'43'}),/IDENTITY/);
    await assert.rejects(friendInPage({...args,friend:{...args.friend,userId:'124'}}),/IDENTITY/);
    assert.equal(sends,0);
    await assert.rejects(friendInPage({...args,friend:{kind:'status',userId:'999'}}),/CONVERSATION_NOT_FOUND/);
    hidden=true;await assert.rejects(friendInPage(args),/CONVERSATION_HIDDEN/);hidden=false;
    visible.length=0;openResult=false;await assert.rejects(friendInPage({...args,friend:{kind:'open',phone:body.friend.phone,userId:'123'}}),/CONVERSATION_NOT_READY/);assert.equal(globalThis.__zaloTeamPhonePeers?.allows('42','123')||false,false);openResult=true;opens=0;assert.equal((await friendInPage({...args,friend:{kind:'open',phone:body.friend.phone,userId:'123'}})).status,'opened');assert.equal(opens,1);assert.equal(visible.length,0);assert.equal(globalThis.__zaloTeamPhonePeers.allows('43','123'),false);hidden=true;assert.equal(globalThis.__zaloTeamPhonePeers.allows('42','123'),false);hidden=false;
    await friendInPage({...args,friend:{kind:'open',phone:body.friend.phone,userId:'123'}});assert.equal(opens,1);
    assert.equal((await friendInPage({...args,friend:{kind:'status',userId:'123'}})).person.id,'123');
    assert.equal((await friendInPage(args)).status,'confirmed');await friendInPage(args);assert.equal(sends,1);
    requested=false;expectedSource=-1;assert.equal((await friendInPage({...args,friend:{kind:'send',userId:'123',message:'Xin chào'}})).status,'confirmed');assert.equal(sends,2);
    lookupId='42';visible.push('999');const own=await friendInPage({...args,friend:{kind:'open',phone:'+84386987693',userId:'42'}});assert.equal(own.person.self,true);assert.equal(own.conversationId,'999');assert.equal(opens,1);await assert.rejects(friendInPage({...args,friend:{...args.friend,userId:'42'}}),/FRIEND_UNAVAILABLE/);assert.equal(sends,2);
  } finally {globalThis.webpackJsonp=prev;globalThis.__zaloTeamPhonePeers=oldScope;}
});
