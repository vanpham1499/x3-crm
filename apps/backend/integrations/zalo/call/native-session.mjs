import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { CALL_SHA256, createNativeCodec, readTransportKey } from './native-codec.mjs';

// Own process + own pipes only; never attaches to the user's running Zalo PC.
export class NativeCallSession extends EventEmitter {
  constructor(executable) {
    super(); this.executable = path.resolve(executable); this.sockets = new Set();
    this.servers = []; this.closed = false; this.ready = false;
  }
  async start(metadata) {
    if (this.started || this.closed) throw Error('NATIVE_SESSION_ALREADY_USED');
    this.started = true;
    if (process.platform !== 'win32') throw Error('WINDOWS_REQUIRED');
    if (createHash('sha256').update(await fs.readFile(this.executable)).digest('hex') !== CALL_SHA256) throw Error('UNVERIFIED_CALL_BUILD');
    this.key = readTransportKey(path.resolve(path.dirname(this.executable), '../../../../../tooling'));
    this.codec = createNativeCodec(this.key);
    this.metadata = metadata;
    const id = randomUUID();
    this.directory = path.resolve('.local/zalo-call-assets/sessions', id);
    await fs.mkdir(this.directory, { recursive: true });
    const pipes = ['recv', 'send'].map(side => `\\\\.\\pipe\\x3-team-call-${id}-${side}`);
    const connected = new Promise((resolve, reject) => {
      this.finishStart = () => {
        if (this.ready && this.writer) { clearTimeout(this.startTimer); resolve(); }
      };
      this.rejectStart = reject;
      this.startTimer = setTimeout(() => reject(Error('NATIVE_READY_TIMEOUT')), 10000);
    });
    // Attach rejection now, even if spawn/listen fails before awaiting connected.
    connected.catch(() => {});
    try {
      for (const [i, pipe] of pipes.entries()) {
        const server = net.createServer(socket => {
          this.sockets.add(socket);
          socket.on('error', () => this.fail('NATIVE_PIPE_LOST'));
          socket.on('close', () => { this.sockets.delete(socket); if (!this.closed) this.fail('NATIVE_PIPE_LOST'); });
          if (i === 1) { this.writer = socket; this.finishStart(); }
          else socket.on('data', data => {
            try {
              for (const packet of this.codec.push(data)) {
                if (packet.type === 'update' && packet.command === 'native-ready') { this.ready = true; this.finishStart(); }
                this.emit('packet', packet);
              }
            } catch { this.fail('NATIVE_PROTOCOL_ERROR'); }
          });
        });
        this.servers.push(server);
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
        server.on('error', () => this.fail('NATIVE_PIPE_FAILED'));
      }
      this.child = spawn(this.executable, pipes, { cwd: path.dirname(this.executable), windowsHide: true, stdio: 'ignore' });
      this.child.once('error', () => this.fail('NATIVE_SPAWN_FAILED'));
      this.child.once('exit', () => { if (!this.closed) this.fail('NATIVE_EXITED'); });
      await connected;
      this.send({ type: 'update', command: 'init', data: {
        local: metadata.local, mainWindowId: metadata.local.id,
        osInfo: `${os.platform()}_${os.release()}_${os.arch()}`, clientVersion: metadata.clientVersion,
        logPath: path.join(this.directory, 'call.log'), zrtcLogPath: path.join(this.directory, 'zrtc.log'), dumpPath: path.join(this.directory, 'crash.dmp'),
        language: 'vi', autoAudioInput: false, autoAudioOutput: false,
        enablePreviewDeviceOutgoing: false, enablePreviewDeviceIncall: false,
      } });
    } catch (error) { await this.close(); throw error; }
  }
  send(packet) {
    if (this.closed || !this.ready || !this.writer) throw Error('NATIVE_NOT_READY');
    if (this.writer.writableLength > 1024 * 1024) throw Error('NATIVE_BACKPRESSURE');
    this.writer.write(this.codec.encode(packet));
  }
  async devices() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.off('packet', receive); reject(Error('NATIVE_DEVICE_TIMEOUT')); }, 5000);
      const receive = packet => {
        if (['response', 'update'].includes(packet.type) && packet.command === 'listDevice') {
          clearTimeout(timer); this.off('packet', receive); resolve(packet.data);
        }
      };
      this.on('packet', receive);
      try { this.send({ type: 'request', command: 'listDevice', data: null }); }
      catch (error) { clearTimeout(timer); this.off('packet', receive); reject(error); }
    });
  }
  async configureVirtualDevices({ inputName, outputName }) {
    this.virtualDevicesVerified = false;
    if (![inputName, outputName].every(name => typeof name === 'string' && /VB-Audio/i.test(name) && /Cable/i.test(name))) throw Error('VIRTUAL_AUDIO_CONFIGURATION_REQUIRED');
    const current = await this.devices();
    const find = (items, name) => {
      const matches = (items || []).filter(d => d?.name === name && typeof d.guid === 'string');
      if (matches.length !== 1) throw Error('NATIVE_VIRTUAL_DEVICE_MISSING');
      return matches[0];
    };
    const input = find(current.otherAudInputDevice, inputName), output = find(current.otherAudOutputDevice, outputName);
    this.send({ type: 'update', command: 'listDevice', data: {
      autoAudioInput: false, autoAudioOutput: false,
      defaultAudInputDevice: input, defaultAudOutputDevice: output,
    } });
    const confirmed = await this.devices();
    if (confirmed.autoAudioInput !== false || confirmed.autoAudioOutput !== false ||
      confirmed.defaultAudInputDevice?.guid !== input.guid || confirmed.defaultAudOutputDevice?.guid !== output.guid)
      throw Error('NATIVE_VIRTUAL_DEVICE_NOT_SELECTED');
    this.virtualDevicesVerified = true;
  }
  makeCall() {
    if (!this.virtualDevicesVerified) throw Error('NATIVE_VIRTUAL_AUDIO_REQUIRED');
    if (this.callStarted) throw Error('NATIVE_CALL_ALREADY_STARTED');
    this.callStarted = true;
    this.send({ type: 'request', command: 'makeCall', data: { partner: [this.metadata.peer], type: 1 } });
  }
  receiveSignal(packet) {
    if (packet.type !== 'recvSignal') throw Error('INVALID_NATIVE_SIGNAL_RESPONSE');
    this.send({ type: 'recvSignal', command: packet.command, data: packet.data });
  }
  receiveControl(event) { this.send({ type: 'control', data: event }); }
  end() { if (!this.closed && this.ready && this.writer) this.send({ type: 'request', command: 'endCall', data: null }); }
  fail(code) {
    if (this.closed) return;
    this.rejectStart?.(Error(code)); this.emit('failure', code); void this.close();
  }
  async close() {
    if (this.closing) return this.closing;
    this.closed = true; clearTimeout(this.startTimer);
    this.rejectStart?.(Error('NATIVE_SESSION_CLOSED'));
    this.closing = (async () => {
      for (const socket of this.sockets) socket.destroy();
      await Promise.all(this.servers.map(server => new Promise(resolve => server.close(resolve))));
      if (this.child?.pid && this.child.exitCode === null) {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 3000);
          this.child.once('exit', () => { clearTimeout(timer); resolve(); }); this.child.kill();
        });
      }
      this.key?.fill(0); this.removeAllListeners();
    })();
    return this.closing;
  }
}
