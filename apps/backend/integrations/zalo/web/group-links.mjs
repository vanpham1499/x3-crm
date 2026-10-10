import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function validGroupLink(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys=Object.keys(v).sort().join(',');
  if(v.kind==='link') return keys==='kind,sources' && Array.isArray(v.sources) && v.sources.length>=2 && v.sources.length<=30 && v.sources.every(s=>typeof s==='string' && /^[1-9]\d*:g\d{1,30}$/.test(s)) && new Set(v.sources.map(s=>s.split(':')[0])).size===v.sources.length;
  if(typeof v.groupId!=='string' || !/^[a-f0-9-]{36}$/.test(v.groupId)) return false;
  if(v.kind==='unlink') return keys==='groupId,kind,source' && typeof v.source==='string' && /^[1-9]\d*:g\d{1,30}$/.test(v.source);
  return v.kind==='remember' && keys==='accountId,groupId,kind' && (v.accountId===null || (Number.isSafeInteger(v.accountId)&&v.accountId>0));
}

// CRM-only associations. Never change Zalo group membership or merge histories.
export class GroupLinks {
  constructor(root) { this.root=root; this.queue=Promise.resolve(); }
  async read(owner) {
    if(!/^[a-f0-9]{64}$/.test(owner)) throw Error('INVALID_REQUEST');
    try {return JSON.parse(await fs.readFile(path.join(this.root,owner+'.json'),'utf8'));}
    catch(e) {if(e.code!=='ENOENT') throw e; return {version:1,groups:[],audit:[]};}
  }
  async project(owner,rows) {
    const state=await this.read(owner), visible=new Set(rows.filter(r=>r.group).map(r=>r.id));
    return state.groups.map(g=>({id:g.id,sources:g.sources.filter(s=>visible.has(s)),complete:g.sources.every(s=>visible.has(s)),preferredAccountId:g.preferredAccountId})).filter(g=>g.sources.length);
  }
  run(owner,link,load) {
    if(!validGroupLink(link)) return Promise.reject(Error('INVALID_REQUEST'));
    const job=this.queue.then(async()=>{
      const catalog=await load(); // Fresh owned, visible groups, including hidden-chat filtering.
      const visible=new Set(catalog.conversations.filter(r=>r.group).map(r=>r.id));
      const state=await this.read(owner);
      let group;
      if(link.kind==='link') {
        if(link.sources.some(id=>!visible.has(id))) throw Error('WEB_GROUP_LINK_UNAVAILABLE');
        const matches=state.groups.filter(g=>g.sources.some(s=>link.sources.includes(s)));
        if(matches.length>1) throw Error('WEB_GROUP_LINK_CONFLICT');
        group=matches[0] || {id:crypto.randomUUID(),sources:[],preferredAccountId:null};
        const sources=[...new Set([...group.sources,...link.sources])];
        if(new Set(sources.map(s=>s.split(':')[0])).size!==sources.length) throw Error('WEB_GROUP_LINK_CONFLICT');
        if(!matches.length) state.groups.push(group);
        group.sources=sources;
      } else {
        group=state.groups.find(g=>g.id===link.groupId);
        if(!group || !group.sources.some(s=>visible.has(s))) throw Error('WEB_GROUP_LINK_UNAVAILABLE');
        if(link.kind==='unlink') {
          if(!group.sources.includes(link.source)||!visible.has(link.source)) throw Error('WEB_GROUP_LINK_UNAVAILABLE');
          group.sources=group.sources.filter(s=>s!==link.source);
          if(group.preferredAccountId===Number(link.source.split(':')[0])) group.preferredAccountId=null;
          if(group.sources.length<2) state.groups=state.groups.filter(g=>g.id!==group.id);
        } else {
          if(link.accountId!==null && !group.sources.some(s=>visible.has(s)&&Number(s.split(':')[0])===link.accountId)) throw Error('WEB_GROUP_LINK_UNAVAILABLE');
          group.preferredAccountId=link.accountId;
        }
      }
      state.audit.push({time:new Date().toISOString(),kind:link.kind,groupId:group.id,sources:[...group.sources]});
      await fs.mkdir(this.root,{recursive:true,mode:0o700});
      const file=path.join(this.root,owner+'.json');
      await fs.writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});
      await fs.rename(file+'.tmp',file);
      return {status:'confirmed',groups:await this.project(owner,catalog.conversations)};
    });
    this.queue=job.catch(()=>{}); return job;
  }
}
