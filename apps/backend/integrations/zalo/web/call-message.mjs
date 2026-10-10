// Native qLCR call UIContent: params takes precedence over legacy fields.
export function normalizeCallMessage(body) {
  let params=body.params;
  if(typeof params==='string') {try {params=JSON.parse(params);}catch {params={};}}
  if(!params || typeof params!=='object')params={};
  const value=params.duration ?? body.duration;
  const duration=Number(value);
  const callId = params.callId ?? params.call_id ?? body.callId ?? body.call_id;
  return {
    ...(/^\d{1,30}$/.test(String(callId ?? '')) ? { id: String(callId) } : {}),
    direction: params.isCaller!=null ? (params.isCaller?'outgoing':'incoming') : body.action==='recommened.calling'?'outgoing':'incoming',
    missed:body.action==='recommened.misscall',
    video:params.calltype===1,
    durationSeconds:value!=null && Number.isFinite(duration) && duration>=0 ? Math.floor(duration):null,
    callback:!!params.isEnableCallback,
    reason:Number.isInteger(params.reason)?params.reason:0,
  };
}
