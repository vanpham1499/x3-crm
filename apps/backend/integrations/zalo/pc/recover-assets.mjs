import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectInstallation, DEFAULT_INSTALLATION } from '../shared/asar.mjs';
import { listTargets, CdpConnection } from '../shared/cdp.mjs';
import { nativeConversationSourceExpression } from '../shared/native-conversation-source.mjs';
import { pcDescriptor, projectPcPage, pcMediaPaths } from './archive-reader.mjs';
import { enrichPcStickers } from './sticker-sources.mjs';

// Local maintenance only. Input is the owner-scoped recovery manifest captured by PHP.
const directory=path.resolve(process.argv[2]);
const plan=JSON.parse(await fs.readFile(path.join(directory,'targets.json'),'utf8'));
const localOnly=process.argv.includes('--local-only');
if(localOnly)for(const source of plan.sources)source.targets=source.targets.filter(t=>['video','audio'].includes(t.kind));
const build=await inspectInstallation(DEFAULT_INSTALLATION);
const targets=(await listTargets('http://127.0.0.1:9333')).filter(t=>/^file:/.test(t.url)&&/\/pc-dist\/(?:index|main)\.html(?:[?#]|$)/.test(t.url));
if(targets.length!==1)throw Error('PC_MAIN_WINDOW_NOT_FOUND');
const cdp=await new CdpConnection(targets[0].webSocketDebuggerUrl).connect();
const assets=localOnly?JSON.parse(await fs.readFile(path.join(directory,'resolved.json'),'utf8')).assets:[], report=[], stickerCache=new Map();
try{
 const descriptor=await cdp.evaluate(`(${pcDescriptor.toString()})()`);
 for(const source of plan.sources){
  if(!source.targets.length)continue;
  if(source.externalId!==descriptor.accountId){report.push({sourceId:source.sourceId,state:'different-account'});continue;}
  const byId=new Map();for(const target of source.targets){const old=byId.get(target.messageId)||[];old.push(target);byId.set(target.messageId,old);}
  const spec={...build,expectedAccountId:source.externalId,accountSlot:'account-1',threadType:source.conversationId.startsWith('g')?'group':'user',threadId:source.conversationId.replace(/^g/,''),limit:100};
  let cursor=null,pages=0,found=0;const seen=new Set();
  do{
   const snapshot=await cdp.evaluate(nativeConversationSourceExpression({...spec,cursor}),60000);
   const messages=projectPcPage(snapshot,descriptor).filter(m=>byId.has(m.id));
   await enrichPcStickers(cdp,snapshot,descriptor,messages,stickerCache);
   let local=[];
   if(messages.some(m=>m.attachments.length===1))local=await cdp.evaluate(`(${pcMediaPaths.toString()})(${JSON.stringify({accountId:source.externalId,conversationId:source.conversationId,cursor,messageIds:messages.filter(m=>m.attachments.length===1).map(m=>m.id)})})`,60000);
   for(const m of messages){
    for(const target of byId.get(m.id)){
     if(target.time!==m.time||target.clientId!==m.clientId)continue;
     const parts=target.slot.split('.'),a=m.attachments[Number(parts[1])];
     if(a?.kind!==target.kind)continue;
     const url=a[parts[2]],file=local.find(v=>v.messageId===m.id&&v.slot===target.slot)?.path;
     if(url||file){const prior=assets.findIndex(a=>a.assetId===target.assetId);const record={...target,sourceId:source.sourceId,externalId:source.externalId,url:typeof url==='string'&&url.startsWith('https://')?url:null,path:file||null};if(prior>=0)assets[prior]=record;else assets.push(record);}
    }
    byId.delete(m.id);found++;
   }
   pages++;cursor=snapshot.nextCursor;
   if(cursor){const key=JSON.stringify(cursor);if(seen.has(key))throw Error('PC_CURSOR_STALLED');seen.add(key);}
   if(pages%25===0)console.log(JSON.stringify({phase:'scanning',pages,found,remaining:byId.size}));
  }while(cursor&&byId.size&&pages<1000);
  report.push({sourceId:source.sourceId,state:'scanned',pages,found,remaining:byId.size});
  await fs.writeFile(path.join(directory,'resolved.json'),JSON.stringify({owner:plan.owner,assets,report}));
  console.log(JSON.stringify({phase:'source-complete',pages,found,remaining:byId.size,assets:assets.length}));
 }
 await fs.writeFile(path.join(directory,'resolved.json'),JSON.stringify({owner:plan.owner,assets,report}));
 console.log(JSON.stringify({phase:'complete',assets:assets.length,stickerResources:stickerCache.size}));
}finally{cdp.close();}
