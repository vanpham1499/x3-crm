import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSrtpKeys, masterFromSession, SrtpContext } from './srtp.mjs';

const master = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRST');
const packet = (seq = 1) => { const p = Buffer.from('807000010000014012345678f8fffe','hex'); p.writeUInt16BE(seq, 2); return p; };

test('RFC 3711 Appendix B.3 key derivation', () => {
  const keys = deriveSrtpKeys(Buffer.from('e1f97a0d3e018be0d64fa32c06de41390ec675ad498afeebb6960b3aabe6','hex'));
  assert.equal(keys.encryption.toString('hex'),'c61e7a93744f39ee10734afe3ff7a087');
  assert.equal(keys.authentication.toString('hex'),'cebe321f6ff7716b6fd4ab49af256a156d38baa4');
  assert.equal(keys.salt.toString('hex'),'30cbbc08863d8c85d49db34a9ae1');
});
test('exact pinned PC dummy-session SRTP vector, both directions', () => {
  const cipher = Buffer.from('807000010000014012345678dd860520548cbe189c5ff206a4','hex');
  const s = new SrtpContext(master), r = new SrtpContext(master);
  assert.deepEqual(s.protect(packet()),cipher);
  assert.deepEqual(r.unprotect(cipher),packet());
});
test('rollover, delayed packet and replay rejection', () => {
  const s = new SrtpContext(master), r = new SrtpContext(master);
  const packets = [65534,65535,0,1].map(seq => s.protect(packet(seq)));
  for (const index of [0,2,1,3]) assert.deepEqual(r.unprotect(packets[index]),packet([65534,65535,0,1][index]));
  assert.throws(()=>r.unprotect(packets[1]),/SRTP_REPLAY/);
  assert.throws(()=>s.protect(packet(1)),/SEQUENCE_REUSED/);
});
test('failed authentication does not advance receiver state', () => {
  const s = new SrtpContext(master), r = new SrtpContext(master), valid=s.protect(packet());
  const damaged=Buffer.from(valid); damaged[12]^=1;
  assert.throws(()=>r.unprotect(damaged),/AUTH_FAILED/);
  assert.deepEqual(r.unprotect(valid),packet());
});
test('validates profile, RTP extensions and closed lifecycle', () => {
  assert.deepEqual(masterFromSession(master.toString()+'dummy',{srtpMode:1}),master);
  assert.throws(()=>masterFromSession('short',{srtpMode:1}),/KEY_SOURCE/);
  assert.throws(()=>masterFromSession(master.toString(),{srtpMode:3}),/PROFILE/);
  const s = new SrtpContext(master), invalid=packet(); invalid[0]|=16;
  assert.throws(()=>s.protect(invalid),/EXTENSION/);
  s.close();s.close();assert.throws(()=>s.protect(packet()),/CLOSED/);
});
