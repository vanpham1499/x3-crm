import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeCallSession } from './native-session.mjs';

const names = { inputName: 'CABLE Output (VB-Audio Virtual Cable)', outputName: 'Hi-Fi Cable Input (VB-Audio Hi-Fi Cable)' };
const input = {name:names.inputName,guid:'input',id:'1'}, output = {name:names.outputName,guid:'output',id:'2'};
function fake(confirm) {
  const native = new NativeCallSession('unused.exe');
  native.metadata = { peer: {id:'222',name:'Peer'} };
  native.sent = []; native.send = p => native.sent.push(p);
  let reads=0;
  native.devices = async () => ++reads === 1 ? { otherAudInputDevice:[input],otherAudOutputDevice:[output] } : confirm;
  return native;
}
test('native refuses makeCall before selecting confirmed virtual devices', async () => {
  const native = fake({});
  assert.throws(()=>native.makeCall(),/NATIVE_VIRTUAL_AUDIO_REQUIRED/);
  await assert.rejects(native.configureVirtualDevices({...names,inputName:'Microphone Array (Realtek)'}),/VIRTUAL_AUDIO_CONFIGURATION_REQUIRED/);
  assert.equal(native.sent.length,0);
});
test('native refuses silent fallback to physical/default devices', async () => {
  const native = fake({autoAudioInput:true,autoAudioOutput:false,defaultAudInputDevice:input,defaultAudOutputDevice:output});
  await assert.rejects(native.configureVirtualDevices(names),/NATIVE_VIRTUAL_DEVICE_NOT_SELECTED/);
  assert.throws(()=>native.makeCall(),/NATIVE_VIRTUAL_AUDIO_REQUIRED/);
});
test('confirmed virtual pair permits a single voice request for the verified peer', async () => {
  const native = fake({autoAudioInput:false,autoAudioOutput:false,defaultAudInputDevice:input,defaultAudOutputDevice:output});
  await native.configureVirtualDevices(names); native.makeCall();
  assert.deepEqual(native.sent.at(-1),{type:'request',command:'makeCall',data:{partner:[{id:'222',name:'Peer'}],type:1}});
  assert.throws(()=>native.makeCall(),/NATIVE_CALL_ALREADY_STARTED/);
});
