import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const directoryReads = ['friends','groups','requests','invitations','profile','open','search'];
export function validDirectory(v) {
  if (!v || typeof v!=='object' || Array.isArray(v)) return false;
  const keys=Object.keys(v).sort().join(',');
  if(v.kind==='search') return keys==='kind,offset,query' && typeof v.query==='string' && v.query.trim().length>0 && v.query.length<=200 && Number.isSafeInteger(v.offset) && v.offset>=0 && v.offset<=1000000;
  if (['friends','groups','requests'].includes(v.kind)) return keys==='kind';
  if(v.kind==='invitations') return keys==='kind,page' && Number.isSafeInteger(v.page) && v.page>=0 && v.page<10000;
  if(!/^[g]?\d{1,30}$/.test(v.id || '') || typeof v.id!=='string') return false;
  if(['profile','open'].includes(v.kind)&&v.conversationId!==undefined) return ['conversationId,id,kind','conversationId,id,kind,messageId'].includes(keys)&&/^\d+$/.test(v.id)&&typeof v.conversationId==='string'&&/^g?\d{1,30}$/.test(v.conversationId)&&(v.messageId===undefined||(typeof v.messageId==='string'&&/^\d{1,30}$/.test(v.messageId)));
  if(v.kind==='label') return keys==='id,kind,labelId' && (v.labelId===null || (typeof v.labelId==='string' && /^-?\d{1,30}$/.test(v.labelId)));
  return keys==='id,kind' && ['profile','open','accept','reject','cancel','block','unblock','remove','join','decline'].includes(v.kind) && (!['profile','accept','reject','cancel','block','unblock','remove'].includes(v.kind) || /^\d+$/.test(v.id)) && (!['join','decline'].includes(v.kind)||v.id.startsWith('g'));
}
export class Directory {
  constructor(root,adapter=nativeDirectory){this.root=root;this.adapter=adapter;}
  async run(page,expectedId,body){
    if(!validDirectory(body.directory)) throw Error('INVALID_REQUEST');
    const args={expectedId,directory:body.directory};
    if(directoryReads.includes(body.directory.kind)) return this.adapter(page,args);
    const file=path.join(this.root,crypto.createHash('sha256').update(body.owner+':'+body.requestId).digest('hex')+'.json');
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify([body.accountId,args])).digest('hex');
    try {const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.fingerprint!==fingerprint)throw Error('WEB_ACTION_REQUEST_CONFLICT');return saved.result;}catch(e){if(e.code!=='ENOENT')throw e;}
    await this.adapter(page,{...args,prepare:true});
    await fs.mkdir(this.root,{recursive:true,mode:0o700});
    const receipt={fingerprint,result:{status:'unknown'}};
    try {await fs.writeFile(file,JSON.stringify(receipt),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')return this.run(page,expectedId,body);throw e;}
    let timer;
    try {receipt.result=await Promise.race([this.adapter(page,args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('WEB_ACTION_TIMEOUT')),25000);})]);}catch(e){receipt.result.errorCode=/^WEB_[A-Z_]+$/.test(e.message)?e.message:'WEB_DIRECTORY_ACTION_UNKNOWN';}finally{clearTimeout(timer);}
    await fs.writeFile(file+'.tmp',JSON.stringify(receipt),{mode:0o600});await fs.rename(file+'.tmp',file);return receipt.result;
  }
}
export async function nativeDirectory(page,args){
  const frame=page.frames().find(f=>/^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if(!frame)throw Error('WEB_DIRECTORY_NOT_READY');
  return frame.evaluate(directoryInPage,args);
}
export async function directoryInPage({expectedId,directory:d,prepare=false}){
  let req;const id='zalo-team-directory-'+Date.now(),chunk=[[id],{[id]:(m,e,r)=>{req=r}},[[id]]];
  if(!Array.isArray(globalThis.webpackJsonp))throw Error('WEB_DIRECTORY_NOT_READY');
  globalThis.webpackJsonp.push(chunk);if(!req)throw Error('WEB_DIRECTORY_NOT_READY');
  delete req.c[id];delete req.m[id];globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk),1);
  const get=k=>req.c[k]?.exports, core=get('dThN')?.default, users=get('UiPd')?.default, groups=get('Gm1y')?.default, hidden=get('EFQ6')?.a, requests=get('Py3H')?.a;
  if(String(core?.userId)!==expectedId)throw Error('WEB_IDENTITY_MISMATCH');
  if(!users?.getFriendsSync||!groups?.getGroupsListSync||!hidden?.isThreadHidden||!requests)throw Error('WEB_DIRECTORY_NOT_READY');
  const list=v=>Array.isArray(v)?v:Object.values(v||{}), safeUrl=v=>typeof v==='string'&&/^https:\/\//.test(v)?v:undefined;
  const visible=uid=>uid!==expectedId&&!hidden.isThreadHidden(uid);
  const person=(p)=>{const uid=String(p?.userId||p?.id||p);const info=typeof p==='object'?p:users.getProfileFriendSync(uid)||users.getMiniInfo(uid)||{};return {id:uid,name:String(users.getDName(uid)||info.displayName||info.zaloName||'Người dùng Zalo').slice(0,200),avatarSrc:safeUrl(users.getAvatar(uid)||info.avatar),blocked:!!users.isBlocked(uid),isFriend:!!users.isFriend(uid),message:String(info.message||info.msg||info.friendRequestMsg||''),time:Number(info.timestamp||info.ts||info.friendRequestTime||0)};};
  const friendRows=()=>list(users.getFriendsSync()).map(person).filter(p=>/^\d+$/.test(p.id)&&visible(p.id)&&p.isFriend);
  const groupRows=()=>list(groups.getGroupsListSync()).map(p=>{
    const raw=String(p?.groupId||p?.userId||p?.id||p),uid=raw.startsWith('g')?raw:'g'+raw,info=groups.getGroupByIdSync(uid)||p;
    const previews=get('yzMR')?.PreviewDataManager,preview=previews&&get('jDHv')?.ModuleContainer.resolve(previews).getPreviewByIDSync(uid);
    return {id:uid,name:String(info.displayName||info.name||'Nhóm Zalo'),group:true,avatarSrc:safeUrl(info.avatar||info.fullAvt),memberCount:Number(info.totalMember||0),updatedAt:Number(preview?.messageTime||info.lastActionTime||info.lastMsgTime||info.createdTime||0),avatarMembers:(info.topMember||[]).slice(0,4).map(p=>{const id=String(p?.id||p?.userId||p?.uid||p);return {name:String(users.getDName(id)||p.dName||p.displayName||p.zaloName||''),avatarSrc:safeUrl(users.getAvatar(id)||p.avatar)};})};
  }).filter(p=>/^g\d+$/.test(p.id)&&visible(p.id));
  const labels=async()=>{const manager=get('l+Gc')?.a;if(!manager?.getAll)throw Error('WEB_DIRECTORY_NOT_READY');return list(await manager.getAll(null,false)).map(l=>({id:String(l.id),name:String(l.text||''),color:l.color,members:(l.conversations||[]).map(String).filter(visible)}));};
  const invitationRows=async(page=0)=>{
    const r=await core.getGroupInvitationList(page,20,4);
    if(!Array.isArray(r?.invitations))throw Error('WEB_DIRECTORY_NOT_READY');
    return {items:r.invitations.filter(p=>p.groupInfo&&Number(p.expiredTs)>Date.now()).map(p=>({id:'g'+String(p.groupInfo.groupId),name:String(p.groupInfo.name||''),group:true,avatarSrc:safeUrl(p.groupInfo.avt),memberCount:Number(p.groupInfo.totalMember||0),inviter:String(p.inviterInfo?.displayName||p.inviterInfo?.zaloName||p.inviterInfo?.name||''),time:Number(p.createdTs||0),pending:p.type===1})).filter(p=>visible(p.id)),hasMore:!!r.hasMore,total:Number(r.total||0)};
  };
  const requestRows=async()=>{
    const incomingRaw=await get('XS0u').default.getFriends(null,true);
    const expanded=await get('wcaV').a.expandFriendInfo(incomingRaw);
    const incoming=list(expanded).filter(p=>p.friendRequestType===get('1pet').FRIEND_REQUEST_TYPE_REQUEST&&!users.isFriend(String(p.userId))&&!requests._hasInCacheReject(String(p.userId))).map(person).filter(p=>visible(p.id));
    const outgoing=list(await core.getRequestedFriends()).map(person).filter(p=>/^\d+$/.test(p.id)&&visible(p.id)&&!p.isFriend);
    return {incoming,outgoing};
  };
  if(d.kind==='search'){
    const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
    const query=norm(d.query);
    // Search the complete native friend/group catalog, independently of recent inbox rows.
    const matches=[...friendRows(),...groupRows()].filter(p=>{
      const info=p.group?{}:users.getProfileFriendSync(p.id)||{};
      return [p.name,info.displayName,info.zaloName].some(name=>norm(name).includes(query));
    }).sort((a,b)=>a.id.localeCompare(b.id));
    const items=matches.slice(d.offset,d.offset+50);
    return {items,total:matches.length,nextOffset:d.offset+50<matches.length?d.offset+50:null};
  }
  if(d.kind==='friends')return {items:friendRows(),labels:await labels()};
  if(d.kind==='groups')return {items:groupRows(),labels:await labels()};
  if(d.kind==='requests')return requestRows();
  if(d.kind==='invitations')return invitationRows(d.page);
  if(!visible(d.id))throw Error('WEB_CONVERSATION_HIDDEN');
  if(['join','decline'].includes(d.kind)){
    const inv=await core.getGroupInvitationInfo(d.id.slice(1));
    if(String(inv?.groupInfo?.groupId)!==d.id.slice(1)||!(Number(inv.expiredTs)>Date.now())||inv.type===1)throw Error('WEB_DIRECTORY_STALE');
    if(prepare)return {ready:true};
    if(d.kind==='join')await core.joinGroupFromInvitation(d.id.slice(1));else await core.deleteGroupInvitation([{grid:d.id.slice(1)}],false);
    return {status:'confirmed'};
  }
  let target=d.id.startsWith('g')?groupRows().find(p=>p.id===d.id):friendRows().find(p=>p.id===d.id);
  if(d.conversationId){
    const source=d.conversationId;
    const ids=get('jDHv')?.ModuleContainer.resolve(get('iZzu')?.ConvListController).getList({key:get('3xbP')?.c});
    if(hidden.isThreadHidden(source)||(!ids?.includes(source)&&!globalThis.__zaloTeamPhonePeers?.allows(expectedId,source)))throw Error('WEB_CONVERSATION_NOT_FOUND');
    if(d.messageId){
      const m=await get('XS0u')?.default.getMessage(d.messageId,source);
      if(!m||String(m.msgId)!==d.messageId||String(m.toUid)!==source||String(m.fromUid)!==d.id)throw Error('WEB_MESSAGE_NOT_FOUND');
    }else if(source!==d.id)throw Error('WEB_DIRECTORY_STALE');
    target=person(await users.getProfileFriendById(d.id));
    if(target.id!==d.id)throw Error('WEB_IDENTITY_MISMATCH');
  }
  if(['accept','reject','cancel'].includes(d.kind)||(!target&&['profile','open'].includes(d.kind))){const r=await requestRows();target=(d.kind==='cancel'?r.outgoing:d.kind==='accept'||d.kind==='reject'?r.incoming:[...r.incoming,...r.outgoing]).find(p=>p.id===d.id);}
  if(!target)throw Error('WEB_DIRECTORY_STALE');
  if(d.kind==='profile'){
    const p=await users.getProfileFriendById(d.id);return {person:{...target,coverSrc:safeUrl(p.cover),gender:p.gender===0?'Nam':p.gender===1?'Nữ':'',birthday:p.sdob||'',phone:p.phoneNumber||'',alias:users.getAliasName(d.id)||''}};
  }
  if(d.kind==='open'){
    const visibleList=get('iZzu')?.ConvListController;
    const existing=visibleList&&get('jDHv')?.ModuleContainer.resolve(visibleList).getList({key:get('3xbP')?.c});
    if(existing?.includes(d.id)||globalThis.__zaloTeamPhonePeers?.allows(expectedId,d.id))return {status:'opened',person:target,conversationId:d.id};
    const navigation=get('WQAo');
    const profile=d.id.startsWith('g')?groups.getGroupByIdSync(d.id):await users.getProfileFriendById(d.id);
    const opened=await get('jDHv').ModuleContainer.resolve(navigation.b).openConversation(d.id,navigation.c.fromSearchList({...profile,userId:d.id,displayName:target.name}));
    if(opened!==true)throw Error('WEB_CONVERSATION_NOT_READY');
    let scope=globalThis.__zaloTeamPhonePeers;
    if(scope?.accountId!==expectedId){const peers=new Set();scope={accountId:expectedId,peers,allows:(a,p)=>a===expectedId&&String(core.userId)===expectedId&&peers.has(p)&&!hidden.isThreadHidden(p)};globalThis.__zaloTeamPhonePeers=scope;}
    scope.peers.add(d.id);return {status:'opened',person:target,conversationId:d.id};
  }
  if(d.kind==='label'){
    if(d.labelId!==null&&!(await labels()).some(l=>l.id===d.labelId))throw Error('WEB_DIRECTORY_STALE');
    if(prepare)return {ready:true};
    if(d.labelId===null)await get('l+Gc').a.removeConversation(d.id);else await get('l+Gc').a.updateConversation(d.id,d.labelId,true);
  }else{
    if(prepare)return {ready:true};
    if(d.kind==='accept')await requests.acceptAddFriend(d.id);
    else if(d.kind==='reject')await requests.rejectRequestAddFriend(d.id);
    else if(d.kind==='cancel')await requests.undoRequestAddFriend(d.id);
    else if(d.kind==='remove')await users.removeFriend(d.id);
    else if(d.kind==='block'||d.kind==='unblock')await users.blockFriend(d.id,get('1pet')[d.kind==='block'?'SET_BLOCK':'UNSET_BLOCK']);
    else throw Error('INVALID_REQUEST');
  }
  return {status:'confirmed'};
}
