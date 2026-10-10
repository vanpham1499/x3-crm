import dgram from 'node:dgram';
import { randomInt } from 'node:crypto';
import { createVoiceRequest } from './voice-request.mjs';
import { encodeCallerInit, decodeCallerInitResponse } from './zrtc-init.mjs';
import { encodeMediaPacket, decodeIncomingMedia } from './zrtc-media.mjs';
import { SrtpContext, masterFromSession } from './srtp.mjs';
import { OpusBridge } from './opus-bridge.mjs';

const codec=JSON.stringify([{dynamicFptime:0,frmPtime:20,name:'opus/16000/1',payload:112}])+'\n';
export class PortableCall {
  constructor(connector,onFailure=()=>{}) {
    this.connector=connector;this.onFailure=onFailure;this.state='prepared';this.closed=false;
    this.sequence=randomInt(1,65535);this.timestamp=randomInt(0,0x100000000);this.transportSequence=0;
    this.stats={sent:0,received:0,dropped:0,authenticated:0};
    this.bridge=new OpusBridge(payload=>this.sendAudio(payload));
  }
  async prepare() { this.metadata=await this.connector.prepare();return this.metadata; }
  check() { if(this.closed)throw Error('CALL_ENDED'); }
  start() {
    if(this.starting)return this.starting;
    this.starting=this.run().catch(error=>{if(!this.closed){this.onFailure(error);void this.close().catch(()=>{});}throw error;});
    return this.starting;
  }
  async run() {
    this.check();if(!this.metadata)throw Error('CALL_NOT_PREPARED');
    this.state='negotiating';this.request=createVoiceRequest(this.metadata.peer.id);this.attempted=true;
    const response=await this.connector.signal(this.request);this.check();
    if(response.type!=='recvSignal' || response.data?.status!==0)throw Error('CALL_NEGOTIATION_FAILED');
    const info=this.info=response.data, config=info.zrtc_config||{};
    if(config.audioSampleRate!==16000 || config.audioChannel!==1)throw Error('CALL_CODEC_UNSUPPORTED');
    const endpoint=info.servers?.[0]?.rtpaddr;
    const match=typeof endpoint==='string' && endpoint.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
    if(!match || +match[2]<1 || +match[2]>65535)throw Error('CALL_ENDPOINT_UNSUPPORTED');
    this.endpoint={address:match[1],port:+match[2]};
    const master=masterFromSession(info.sessId,config);
    try {this.sender=new SrtpContext(master);this.receiver=new SrtpContext(master);} finally {master.fill(0);}
    this.socket=dgram.createSocket('udp4');
    const ack=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('CALL_UDP_TIMEOUT')),4000);
      this.cancelInit=()=>{clearTimeout(timeout);reject(Error('CALL_ENDED'));};
      this.socket.on('error',()=>{clearTimeout(timeout);reject(Error('CALL_UDP_FAILED'));if(this.token&&!this.closed)this.fail('CALL_UDP_FAILED');});
      this.socket.on('message',(packet,peer)=>{
        if(peer.address!==this.endpoint.address || peer.port!==this.endpoint.port || this.closed)return;
        if(this.token){this.receiveMedia(packet);return;}
        try {const result=decodeCallerInitResponse(packet,this.request.data.callId);clearTimeout(timeout);resolve(result);}catch {/* unrelated datagrams do not settle negotiation */}
      });
      this.socket.send(encodeCallerInit({callerId:info.fromId,calleeId:info.toId,callId:this.request.data.callId,session:info.sessId}),this.endpoint.port,this.endpoint.address,error=>{if(error){clearTimeout(timeout);reject(Error('CALL_UDP_FAILED'));}});
    });
    this.cancelInit=null;this.check();if(ack.status!==0||!ack.token)throw Error('CALL_UDP_REJECTED');this.token=ack.token;
    const ext={callType:0,fecTP:0,gccAudio:1,gccEarlyCall:0,gccMode:1,gccSVLR:1,maxFT:60,newZrtc:1,
      p2p:[],packetMode:2,platform:2,sP2P:0,serverAddr:[{rtcp:endpoint,rtcpIPv6:'::FFFF:'+endpoint,rtp:endpoint,rtpIPv6:'::FFFF:'+endpoint,tpType:0}],
      spTcp:0,srtcp:0,srtpMode:1,supportCallBusy:1,supportHevcDecode:0,tpType:0};
    const invited=await this.connector.signal({type:'sendSignal',command:416,data:{calleeId:this.metadata.peer.id,callId:this.request.data.callId,codec,extendData:JSON.stringify(ext),rtcpAddress:endpoint,rtpAddress:endpoint,session:info.sessId}});
    if(invited.type!=='recvSignal'||(invited.data?.status!==undefined&&invited.data.status!==0))throw Error('CALL_INVITATION_FAILED');
    this.invitationAccepted=true;this.check();this.state='ringing';
    this.ringTimer=setTimeout(()=>this.fail('CALL_NO_ANSWER'),35000);
    void this.poll();
  }
  async poll() {
    if(this.closed)return;
    try {await this.connector.poll(event=>this.control(event));}
    catch {if(!this.closed)this.fail('CALL_SIGNAL_LOST');}
    if(!this.closed)this.pollTimer=setTimeout(()=>void this.poll(),250);
  }
  async control(event) {
    if(this.closed||String(event?.data?.callId)!==String(this.request?.data.callId))return;
    if(event.act==='answer') {
      if(Number(event.data.status)!==0){this.rejectedStatus=Number(event.data.status);this.fail('CALL_REJECTED');return;}
      if(this.state==='connected')return;
      let params,ext,codecs;
      try {params=JSON.parse(event.data.params);ext=JSON.parse(params.extendData);codecs=JSON.parse(params.codec);}catch {throw Error('CALL_ANSWER_INVALID');}
      if(ext.srtpMode!==1||ext.packetMode!==2||!codecs.some(c=>c.name==='opus/16000/1'&&c.payload===112))throw Error('CALL_CODEC_UNSUPPORTED');
      const ack=await this.connector.signal({type:'sendSignal',command:408,data:{calleeId:this.metadata.peer.id,callId:this.request.data.callId}});
      this.check();if(ack.type!=='recvSignal')throw Error('CALL_ANSWER_ACK_FAILED');
      clearTimeout(this.ringTimer);this.state='connected';this.bridge.active=true;this.connectedAt=Date.now();
    } else if(['end_call','cancel'].includes(event.act)){this.state='ended';void this.close().catch(()=>{});}
  }
  sendAudio(payload) {
    if(this.closed||this.state!=='connected')return;
    const header=Buffer.alloc(20);header[0]=0x90;header[1]=112|(this.stats.sent===0?128:0);
    header.writeUInt16BE(this.sequence,2);header.writeUInt32BE(this.timestamp,4);header.writeUInt32BE(this.info.fromId,8);
    header.writeUInt16BE(0xbede,12);header.writeUInt16BE(1,14);header[16]=0x51;
    header.writeUInt16BE(++this.transportSequence&65535,17);
    this.sequence=(this.sequence+1)&65535;this.timestamp=(this.timestamp+320)>>>0;
    const packet=encodeMediaPacket(this.token,this.sender.protect(Buffer.concat([header,payload])));
    this.socket.send(packet,this.endpoint.port,this.endpoint.address,error=>{if(error&&!this.closed)this.fail('CALL_MEDIA_SEND_FAILED');});this.stats.sent++;
  }
  receiveMedia(packet) {
    if(this.state!=='connected'||packet[0]!==4)return;
    try {
      const plain=this.receiver.unprotect(decodeIncomingMedia(packet,this.token).payload);this.stats.authenticated++;
      if((plain[1]&127)!==112||plain.readUInt32BE(8)!==this.info.toId){this.stats.dropped++;return;}
      let offset=12+(plain[0]&15)*4;
      if(plain[0]&16)offset+=4+plain.readUInt16BE(offset+2)*4;
      const end=plain.length-((plain[0]&32)?plain.at(-1):0);
      this.bridge.receiveNetwork(plain.subarray(offset,end),plain.readUInt32BE(4),plain.readUInt16BE(2));this.stats.received++;
    }catch {this.stats.dropped++;}
  }
  fail(code) {if(!this.closed){this.onFailure(Error(code));void this.close().catch(()=>{});}}
  async close() {
    if(this.closing)return this.closing;
    this.closed=true;this.endedAt=Date.now();this.bridge.active=false;clearTimeout(this.pollTimer);clearTimeout(this.ringTimer);this.cancelInit?.();
    this.closing=(async()=>{
      await this.starting?.catch(()=>{});
      this.sender?.close();this.receiver?.close();this.bridge.close();
      try {this.socket?.close();}catch{}
      if(this.attempted) {
        try {const response=await this.connector.signal({type:'sendSignal',command:409,data:{toId:this.connector.scope.conversationId,callId:this.request.data.callId}});this.endAccepted=response.type==='recvSignal';}catch {this.endAccepted=false;}
      }
      // PC 26.9.10 emits 406 separately from transport teardown. This creates
      // the native synchronized call message; never synthesize a text message.
      if(this.invitationAccepted) {
        const status=this.connectedAt?50:this.rejectedStatus===3?106:this.rejectedStatus?null:103;
        if(status!==null) {
          try {
            const response=await this.connector.signal({type:'sendSignal',command:406,data:{
              callId:this.request.data.callId,partnerId:this.connector.scope.conversationId,
              status,duration:this.connectedAt?Math.max(0,Math.floor((this.endedAt-this.connectedAt)/1000)):0,role:true,
              data:JSON.stringify({CallType:0,NewZRTC:1,SrtpMode:1,packetMode:2,
                Codec:['opus/16000/1','20'],TxTotalPkt:this.stats.sent,RxTotalPkt:this.stats.received}),
            }});
            this.historyAccepted=response.type==='recvSignal' && (response.data?.status===undefined || response.data.status===0);
          }catch {this.historyAccepted=false;}
        }
      }
      try {await this.connector.close();} finally {this.info=null;this.state='ended';}
    })();return this.closing;
  }
}
