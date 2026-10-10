// Resolve official sticker resources using the already authenticated native manager.
// Input references must come from messages read from the verified PC conversation.
export async function pcStickerSources({ accountId, references }) {
  let req; const key='team-sticker-sources-'+Date.now();
  const chunk=[[key],{[key]:(m,e,r)=>{req=r;}},[[key]]];
  try { globalThis.webpackJsonp.push(chunk); }
  finally { if(req){delete req.c[key];delete req.m[key];} const i=globalThis.webpackJsonp.indexOf(chunk);if(i>=0)globalThis.webpackJsonp.splice(i,1); }
  const get=id=>req?.c[id]?.exports;
  const verify=()=>{if(String(get('dThN')?.default?.userId)!==accountId||String(get('fdn9')?.a?.userId)!==accountId)throw Error('PC_ACCOUNT_CHANGED');};
  verify();
  const manager=get('vSga')?.default, helper=get('Ullg')?.a?.Helper;
  if(!manager?.getStickerIfNotExist||!helper?.getStickerThumbUrl)throw Error('PC_STICKER_ADAPTER_UNAVAILABLE');
  const out=[];
  for(const ref of references){
    if(!Number.isSafeInteger(ref.categoryId)||!Number.isSafeInteger(ref.stickerId)||ref.categoryId<0||ref.stickerId<0)continue;
    let timer;
    try{
      const item=await Promise.race([manager.getStickerIfNotExist(ref.categoryId,ref.stickerId),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('STICKER_TIMEOUT')),5000);})]);
      verify();
      const url=helper.getStickerThumbUrl(item,{onlyUseLocal:false,usingFileProtocol:false})||item?.stickerUrl;
      if(typeof url==='string'&&url.startsWith('https://'))out.push({...ref,url});
    }catch(e){if(e.message==='PC_ACCOUNT_CHANGED')throw e;}
    finally{clearTimeout(timer);}
  }
  verify(); return out;
}

export async function enrichPcStickers(cdp, snapshot, descriptor, messages, cache=new Map()) {
  const raw=new Map(snapshot.messages.map(m=>[String(m.msgId),m]));
  const references=[];
  for(const m of messages){
    if(m.attachments?.[0]?.kind!=='sticker'||m.attachments[0].url)continue;
    let body=raw.get(m.id)?.message;
    if(typeof body==='string'){try{body=JSON.parse(body);}catch{continue;}}
    if(body?.catId==null||body?.id==null)continue;
    const ref={categoryId:Number(body.catId),stickerId:Number(body.id)};
    const key=ref.categoryId+':'+ref.stickerId;
    if(!cache.has(key)&&!references.some(r=>r.categoryId===ref.categoryId&&r.stickerId===ref.stickerId))references.push(ref);
  }
  for(let i=0;i<references.length;i+=8){
    const batch=references.slice(i,i+8);
    let resolved;
    try {
      resolved=await cdp.evaluate(`(${pcStickerSources.toString()})(${JSON.stringify({accountId:descriptor.accountId,references:batch})})`,60000);
    } catch (error) {
      // A missing optional media adapter must not discard readable text history.
      // Identity changes and transport failures still abort the verified import.
      if(!String(error?.message).includes('PC_STICKER_ADAPTER_UNAVAILABLE'))throw error;
      resolved=[];
    }
    for(const ref of batch)cache.set(ref.categoryId+':'+ref.stickerId,null);
    for(const ref of resolved)cache.set(ref.categoryId+':'+ref.stickerId,ref.url);
  }
  for(const m of messages){
    if(m.attachments?.[0]?.kind!=='sticker'||m.attachments[0].url)continue;
    let body=raw.get(m.id)?.message;
    if(typeof body==='string'){try{body=JSON.parse(body);}catch{continue;}}
    const url=cache.get(Number(body?.catId)+':'+Number(body?.id));
    if(url)m.attachments[0].url=url;
  }
}
