import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVirtualDevices, toMono48k } from './windows-audio.mjs';

test('refuses physical/default devices, absent endpoints, ambiguous names and reversed direction', () => {
  const names = { inputName: 'Hi-Fi Cable Output (VB-Audio Hi-Fi Cable)', outputName: 'CABLE Input (VB-Audio Virtual Cable)' };
  const devices = [{ id: 1, name: names.inputName, inputChannels: 2 }, { id: 2, name: names.outputName, outputChannels: 2 }];
  assert.deepEqual(selectVirtualDevices(devices, names), { input: devices[0], output: devices[1] });
  assert.throws(() => selectVirtualDevices([], names), /VIRTUAL_AUDIO_DEVICES_MISSING/);
  assert.throws(() => selectVirtualDevices([...devices, devices[0]], names), /VIRTUAL_AUDIO_DEVICES_MISSING/);
  assert.throws(() => selectVirtualDevices(devices, { inputName: names.outputName, outputName: names.inputName }), /VIRTUAL_AUDIO_DEVICES_MISSING/);
  assert.throws(() => selectVirtualDevices(devices, { ...names, outputName: 'Speakers (Realtek)' }), /VIRTUAL_AUDIO_CONFIGURATION_REQUIRED/);
});

test('normalizes 10ms stereo/mono frames to bounded 48kHz PCM without channel duplication', () => {
  const samples = new Int16Array(960); for (let i = 0; i < 480; i++) { samples[i * 2] = 3000; samples[i * 2 + 1] = -1000; }
  const data = { samples, sampleRate: 48000, channelCount: 2, bitsPerSample: 16 };
  const pcm = toMono48k(data);
  assert.equal(pcm.length, 960); for (let i = 0; i < 480; i++) assert.equal(pcm.readInt16LE(i * 2), 1000);
  assert.equal(toMono48k({ ...data, samples: new Int16Array(80).fill(700), sampleRate: 8000, channelCount: 1 }).readInt16LE(958), 700);
  assert.throws(() => toMono48k({ ...data, samples: new Int16Array(20) }), /AUDIO_FORMAT_UNSUPPORTED/);
});
