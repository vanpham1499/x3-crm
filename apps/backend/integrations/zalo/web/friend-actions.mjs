import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function validFriend(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  const uid=typeof value.userId === "string" && /^\d{1,30}$/.test(value.userId);
  if(value.kind === "status") return keys === "kind,userId" && uid;
  if(value.phone !== undefined && (typeof value.phone !== "string" || !/^\+[1-9]\d{7,14}$/.test(value.phone))) return false;
  if(value.kind === "open") return keys === "kind,phone,userId" && uid && !!value.phone;
  if (value.kind === "search") return keys === "kind,phone" && !!value.phone;
  return value.kind === "send" && ["kind,message,phone,userId","kind,message,userId"].includes(keys) && uid &&
    typeof value.message === "string" && !!value.message.trim() && value.message.length <= 150 &&
    !/[\x00-\x08\x0b-\x1f]/.test(value.message);
}

export class FriendActions {
  constructor(root, adapter = nativeFriend) { this.root = root; this.adapter = adapter; }
  async run(page, expectedId, body) {
    if (!validFriend(body.friend)) throw Error("INVALID_REQUEST");
    const args = { expectedId, friend: body.friend };
    if (body.friend.kind !== "send") return this.adapter(page, {...args, phase: body.friend.kind === "open" ? "apply" : "prepare"});
    await fs.mkdir(this.root, {recursive:true, mode:0o700});
    const key = crypto.createHash("sha256").update(`${body.owner}:${body.requestId}`).digest("hex");
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify([body.accountId,args])).digest("hex");
    const file = path.join(this.root,key+".json");
    try {
      const saved = JSON.parse(await fs.readFile(file,"utf8"));
      if (saved.fingerprint !== fingerprint) throw Error("WEB_ACTION_REQUEST_CONFLICT");
      return saved.result;
    } catch(e) { if(e.code !== "ENOENT") throw e; }
    const prepared = await this.adapter(page,{...args,phase:"prepare"});
    if (prepared.person?.isFriend || prepared.person?.requested) return {...prepared,status:"confirmed"};
    const receipt = {fingerprint,result:{status:"unknown",requestId:body.requestId}};
    try { await fs.writeFile(file,JSON.stringify(receipt),{flag:"wx",mode:0o600}); }
    catch(e) { if(e.code === "EEXIST") return this.run(page,expectedId,body); throw e; }
    let timer;
    try {
      receipt.result = {...receipt.result,...await Promise.race([
        this.adapter(page,{...args,phase:"apply"}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("WEB_ACTION_TIMEOUT")),25000);})
      ])};
    } catch(e) {
      if (/^WEB_[A-Z_]+$/.test(e?.message || "")) receipt.result.errorCode=e.message;
      // An uncertain transport response must never repeat the invitation.
    } finally {clearTimeout(timer);}
    await fs.writeFile(file+".tmp",JSON.stringify(receipt),{mode:0o600});
    await fs.rename(file+".tmp",file);
    return receipt.result;
  }
}

export async function nativeFriend(page,args) {
  const frame=page.frames().find(f=>/^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if(!frame) throw Error("WEB_FRIEND_NOT_READY");
  return frame.evaluate(friendInPage,args);
}
export async function friendInPage({expectedId,friend,phase}) {
  let require;
  const id="zalo-team-friend-"+Date.now();
  const chunk=[[id],{[id]:(m,e,r)=>{require=r;}},[[id]]];
  if(!Array.isArray(globalThis.webpackJsonp)) throw Error("WEB_FRIEND_NOT_READY");
  globalThis.webpackJsonp.push(chunk);
  if(!require) throw Error("WEB_FRIEND_NOT_READY");
  delete require.c[id];delete require.m[id];
  globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk),1);
  const get=k=>require.c[k]?.exports;
  const fetcher=get("dThN")?.default,users=get("UiPd")?.default,requests=get("Py3H")?.a;
  if(String(fetcher?.userId)!==expectedId) throw Error("WEB_IDENTITY_MISMATCH");
  if(!users?.getInfoByPhone || !requests?.requestAddFriend || !requests?.getStatusFriendRequest)
    throw Error("WEB_FRIEND_NOT_READY");
  const list=()=>get("jDHv")?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)?.getList({key:get("3xbP")?.c});
  let profile;
  if(!friend.phone) {
    if(!list()?.includes(friend.userId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,friend.userId)) throw Error("WEB_CONVERSATION_NOT_FOUND");
    profile=await users.getProfileFriendById(friend.userId);
  } else try {profile=await users.getInfoByPhone(friend.phone,get("1pet")?.SRC_VIEW_FRIEND_REQ?.SEARCH_PHONE_GLOBAL ?? 85);}
  catch(e) {
    if(e?.error_code) return {status:"not-found"};
    throw Error("WEB_FRIEND_SEARCH_FAILED");
  }
  const uid=String(profile?.userId || "");
  if(!/^\d{1,30}$/.test(uid)) return {status:"not-found"};
  if(friend.userId && uid!==friend.userId) throw Error("WEB_IDENTITY_MISMATCH");
  const hidden=get("EFQ6")?.a;
  if(!hidden?.isThreadHidden) throw Error("WEB_FRIEND_NOT_READY");
  if(hidden.isThreadHidden(uid)) throw Error("WEB_CONVERSATION_HIDDEN");
  const self=uid===expectedId;
  if(!profile.cover && users.getProfileFriendById) {
    const full=await users.getProfileFriendById(uid).catch(()=>null);
    if(full && String(full.userId)===uid) profile={...profile,cover:full.cover};
  }
  if(!self) await requests.getStatusFriendRequest(uid,true,true);
  const project=()=>({
    id:uid,name:String(profile.zaloName || profile.displayName || users.getDName(uid) || "Người dùng Zalo").slice(0,200),
    avatarSrc:typeof profile.avatar === "string" && /^https:\/\//.test(profile.avatar) ? profile.avatar : undefined,
    coverSrc:typeof profile.cover === "string" && /^https:\/\//.test(profile.cover) ? profile.cover : undefined,
    isFriend:!!users.isFriend(uid),requested:!!requests.isIRequestYou(uid),
    incoming:!!requests.isYouRequestMe(uid),self,
  });
  let person=project();
  if(friend.kind === "open") {
    if(self) {
      const conversationId=String(get("NDmK")?.default?.sendToMeId || "");
      if(!list()?.includes(conversationId)) throw Error("WEB_CONVERSATION_NOT_READY");
      return {status:"opened",person,conversationId};
    }
    if(!list()?.includes(uid) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,uid)) {
      const navigation=get("WQAo");
      if(!navigation?.c?.fromSearchList) throw Error("WEB_FRIEND_NOT_READY");
      const opened=await get("jDHv").ModuleContainer.resolve(navigation.b).openConversation(uid,navigation.c.fromSearchList({...profile,userId:uid,displayName:person.name}));
      if(opened !== true) throw Error("WEB_CONVERSATION_NOT_READY");
      // A native search chat is temporary until its first message. Keep only
      // explicitly opened, phone-verified peers in this owned frame's lifetime.
      let scope=globalThis.__zaloTeamPhonePeers;
      if(scope?.accountId !== expectedId) {
        const peers=new Set();
        scope={accountId:expectedId, peers,
          allows:(accountId,peerId)=>accountId===expectedId && String(fetcher.userId)===expectedId && peers.has(peerId) && !hidden.isThreadHidden(peerId)};
        globalThis.__zaloTeamPhonePeers=scope;
      }
      scope.peers.add(uid);
    }
    if(!list()?.includes(uid) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,uid)) throw Error("WEB_CONVERSATION_NOT_READY");
    return {status:"opened",person,conversationId:uid};
  }
  if(friend.kind === "search" || friend.kind === "status" || phase === "prepare") {
    if(friend.kind === "send" && (self || person.incoming || users.isBlocked(uid))) throw Error("WEB_FRIEND_UNAVAILABLE");
    return {status:"found",person};
  }
  if(self || person.incoming || users.isBlocked(uid)) throw Error("WEB_FRIEND_UNAVAILABLE");
  if(person.isFriend || person.requested) return {status:"confirmed",person};
  try {
    await requests.requestAddFriend(uid,friend.message.trim(),friend.phone ? 85 : get("1pet")?.FRIEND_REQUEST_SRC_CHAT ?? -1);
  } catch(e) {
    if(Number.isInteger(e?.error_code)) return {status:"rejected",errorCode:"WEB_FRIEND_REJECTED",nativeCode:e.error_code};
    throw Error("WEB_FRIEND_SEND_UNKNOWN");
  }
  person=project();
  return {status:person.isFriend || person.requested ? "confirmed" : "unknown",person};
}
