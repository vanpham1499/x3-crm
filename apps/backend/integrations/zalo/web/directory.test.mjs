import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Directory, directoryInPage, validDirectory } from './directory.mjs';
import { validCommand } from './guards.mjs';
const base={owner:'a'.repeat(64),accountId:1,action:'directory',directory:{kind:'friends'}};
const requestId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('directory requires account, exact fields and mutation receipts',()=>{
  assert.equal(validCommand(base),true);
  assert.equal(validCommand({...base,directory:{kind:'search',query:'Nguyen',offset:0}}),true);
  for(const value of [{kind:'search',query:'',offset:0},{kind:'search',query:'x',offset:-1},{kind:'search',query:'x',offset:0,id:'11'},{kind:'search',query:'x'.repeat(201),offset:0}]) assert.equal(validDirectory(value),false);
  for(const patch of [{accountId:undefined},{conversationId:'123'},{directory:{kind:'friends',id:'123'}},{directory:{kind:'evaluate'}},{directory:{kind:'invitations',page:-1}}])assert.equal(validCommand({...base,...patch}),false);
  for(const kind of ['accept','reject','cancel','block','unblock','remove']){
    assert.equal(validCommand({...base,directory:{kind,id:'123'}}),false);
    assert.equal(validCommand({...base,requestId,directory:{kind,id:'123'}}),true);
    assert.equal(validDirectory({kind,id:'g123'}),false);
  }
  assert.equal(validDirectory({kind:'join',id:'123'}),false);
  assert.equal(validDirectory({kind:'label',id:'123',labelId:'<script>'}),false);
  assert.equal(validDirectory({kind:'profile',id:'15',conversationId:'g77',messageId:'100'}),true);
  assert.equal(validDirectory({kind:'open',id:'15',conversationId:'15'}),true);
  for(const kind of ['block','remove']) assert.equal(validDirectory({kind,id:'15',conversationId:'g77',messageId:'100'}),false);
});
test('uncertain writes are never repeated; receipt cannot be reused across accounts or targets',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'directory-test-'));
  let writes=0;
  const d=new Directory(root,async(_,args)=>{if(args.prepare)return {ready:true};writes++;throw Error('WEB_DIRECTORY_ACTION_UNKNOWN');});
  const command={...base,requestId,directory:{kind:'remove',id:'123'}};
  try{
    assert.equal((await d.run({},'42',command)).status,'unknown');
    await d.run({},'42',command);assert.equal(writes,1);
    await assert.rejects(d.run({},'43',{...command,accountId:2}),/CONFLICT/);
    await assert.rejects(d.run({},'42',{...command,directory:{kind:'remove',id:'124'}}),/CONFLICT/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('native directory scopes hidden peers, relationship direction, labels and pending group invitations',async()=>{
  const friends=new Set(['11','12']),hidden=new Set(['12']);let rejected=false,pending=0,expired=false;
  const calls=[];
  const modules={
    dThN:{default:{userId:'42',getRequestedFriends:async()=>[{userId:'14',displayName:'Outgoing'}],getGroupInvitationInfo:async id=>({groupInfo:{groupId:id},type:pending,expiredTs:expired?0:Date.now()+10000}),joinGroupFromInvitation:async()=>calls.push('join'),deleteGroupInvitation:async()=>calls.push('decline'),getGroupInvitationList:async()=>({invitations:[],hasMore:false,total:0})}},
    UiPd:{default:{getFriendsSync:()=>[...friends],getProfileFriendSync:id=>({userId:id}),getMiniInfo:()=>({}),getDName:id=>'Person '+id,getAvatar:()=>'',isBlocked:()=>false,isFriend:id=>friends.has(id),getProfileFriendById:async id=>({userId:id}),removeFriend:async id=>calls.push('remove:'+id),blockFriend:async(id,v)=>calls.push('block:'+id+':'+v)}},
    Gm1y:{default:{getGroupsListSync:()=>['g77'],getGroupByIdSync:()=>({name:'Test group',topMember:['11'],totalMember:2})}},
    EFQ6:{a:{isThreadHidden:id=>hidden.has(id)}},
    Py3H:{a:{_hasInCacheReject:()=>rejected,acceptAddFriend:async id=>calls.push('accept:'+id),rejectRequestAddFriend:async id=>{rejected=true;calls.push('reject:'+id)},undoRequestAddFriend:async id=>calls.push('cancel:'+id)}},
    XS0u:{default:{getMessage:async()=>({msgId:'100',toUid:'g77',fromUid:'15'}),getFriends:async()=>[{userId:'13',friendRequestType:2}]}},wcaV:{a:{expandFriendInfo:async x=>x}},'1pet':{FRIEND_REQUEST_TYPE_REQUEST:2,SET_BLOCK:1,UNSET_BLOCK:0},
    'l+Gc':{a:{getAll:async()=>[{id:1,text:'Friends',conversations:['11','12']}],updateConversation:async(id,label)=>calls.push('label:'+id+':'+label),removeConversation:async id=>calls.push('unlabel:'+id)}},
    WQAo:{b:'navigation',c:{fromSearchList:x=>x}},jDHv:{ModuleContainer:{resolve:()=>({openConversation:async()=>true})}},
  };
  modules.UiPd.default.getAliasName=()=>'';
  modules.iZzu={ConvListController:'list'};
  modules['3xbP']={c:'main'};
  modules.jDHv.ModuleContainer.resolve=key=>key==='list'?{getList:()=>['g77','15','12']}:{openConversation:async()=>true};
  const req={c:Object.fromEntries(Object.entries(modules).map(([k,exports])=>[k,{exports}])),m:{}};
  const old=globalThis.webpackJsonp,oldPeers=globalThis.__zaloTeamPhonePeers;
  globalThis.webpackJsonp=[];globalThis.webpackJsonp.push=chunk=>{Object.values(chunk[1])[0]({}, {},req);return Array.prototype.push.call(globalThis.webpackJsonp,chunk);};
  const run=(directory,extra={})=>directoryInPage({expectedId:'42',directory,...extra});
  try{
    await assert.rejects(run({kind:'friends'},{expectedId:'43'}),/IDENTITY/);
    const result=await run({kind:'friends'});assert.deepEqual(result.items.map(p=>p.id),['11']);assert.deepEqual(result.labels[0].members,['11']);
    assert.deepEqual((await run({kind:'search',query:'PERSON',offset:0})).items.map(p=>p.id),['11'],'search includes friend absent from recent inbox and excludes hidden peers');
    assert.deepEqual((await run({kind:'search',query:'test group',offset:0})).items.map(p=>p.id),['g77']);
    await assert.rejects(run({kind:'search',query:'person',offset:0},{expectedId:'43'}),/IDENTITY/);
    const originalName=modules.UiPd.default.getDName;
    modules.UiPd.default.getDName=()=> 'Nguyễn Duy Anh';
    assert.equal((await run({kind:'search',query:'nguyen duy anh',offset:0})).items[0].id,'11');
    for(let i=100;i<152;i++)friends.add(String(i));
    const first=await run({kind:'search',query:'nguyen',offset:0});
    const next=await run({kind:'search',query:'nguyen',offset:first.nextOffset});
    assert.equal(first.items.length,50);assert.equal(next.items.length,3);assert.equal(next.nextOffset,null);
    assert.equal(new Set([...first.items,...next.items].map(p=>p.id)).size,53);
    assert.deepEqual(calls,[],'search never opens or mutates a conversation');
    for(let i=100;i<152;i++)friends.delete(String(i));
    modules.UiPd.default.getDName=originalName;
    await run({kind:'open',id:'11'});
    assert.equal(globalThis.__zaloTeamPhonePeers.allows('42','11'),true,'search-only friend opens through native navigation');
    await assert.rejects(run({kind:'open',id:'12'}),/HIDDEN/);
    await assert.rejects(run({kind:'remove',id:'13'}),/STALE/);
    await assert.rejects(run({kind:'open',id:'999'}),/STALE/);
    assert.equal((await run({kind:'profile',id:'15',conversationId:'15'})).person.id,'15');
    assert.equal((await run({kind:'profile',id:'15',conversationId:'g77',messageId:'100'})).person.isFriend,false);
    await assert.rejects(run({kind:'profile',id:'16',conversationId:'g77',messageId:'100'}),/MESSAGE_NOT_FOUND/);
    await assert.rejects(run({kind:'profile',id:'15',conversationId:'g77',messageId:'101'}),/MESSAGE_NOT_FOUND/);
    await assert.rejects(run({kind:'profile',id:'15',conversationId:'g77'}),/STALE/);
    await assert.rejects(run({kind:'profile',id:'15',conversationId:'g99',messageId:'100'}),/CONVERSATION_NOT_FOUND/);
    await assert.rejects(run({kind:'profile',id:'15',conversationId:'12',messageId:'100'}),/CONVERSATION_NOT_FOUND/);
    await assert.rejects(run({kind:'accept',id:'14'}),/STALE/);
    await assert.rejects(run({kind:'cancel',id:'13'}),/STALE/);
    await assert.rejects(run({kind:'label',id:'11',labelId:'999'}),/STALE/);
    await run({kind:'remove',id:'11'},{prepare:true});assert.deepEqual(calls,[]);
    await run({kind:'cancel',id:'14'});await run({kind:'accept',id:'13'});await run({kind:'reject',id:'13'});
    assert.equal((await run({kind:'requests'})).incoming.length,0);
    await run({kind:'block',id:'11'});await run({kind:'unblock',id:'11'});await run({kind:'label',id:'g77',labelId:'1'});
    pending=1;await assert.rejects(run({kind:'join',id:'g88'}),/STALE/);await assert.rejects(run({kind:'decline',id:'g88'}),/STALE/);
    pending=0;expired=true;await assert.rejects(run({kind:'join',id:'g88'}),/STALE/);expired=false;await run({kind:'join',id:'g88'});
    assert.deepEqual(calls,['cancel:14','accept:13','reject:13','block:11:1','block:11:0','label:g77:1','join']);
    await run({kind:'open',id:'14'});assert.equal(globalThis.__zaloTeamPhonePeers.allows('42','14'),true);assert.equal(globalThis.__zaloTeamPhonePeers.allows('43','14'),false);
  }finally{globalThis.webpackJsonp=old;globalThis.__zaloTeamPhonePeers=oldPeers;}
});
