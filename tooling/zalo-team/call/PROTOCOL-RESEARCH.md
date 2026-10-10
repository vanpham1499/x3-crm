# Personal voice calling: verified protocol checkpoint

## 02 October 2026 — native call-history completion

- Offline owned-child PC 26.9.10 probes (dummy identities, localhost UDP) emit
  `406/sendLogEndCall` independently of media/end teardown. Fields:
  `callId, partnerId, status, data, duration, role`. Duration is integer seconds;
  role true is caller. Connected local/remote end: status 50; local cancellation
  before answer: 103; injected answer status 3: 106. Other nonzero answer codes
  are not guessed. Artifacts: `native-local-{log,cancel,reject,remote}-proof.json`.
- PortableCall sends 406 once after stopping media/end 409 and before disposing
  the scoped connector; duration freezes before network cleanup. Logdata only
  contains actual codec/counters and CallType 0, never session/SDP/device dumps.
- Live Chrome Duy → Hoà Ads: 15-second connected call, 406 accepted, native
  calltime message/preview delivered and survived frontend reload. There is no
  synthetic chat message or separate local history cache. Earlier calls without
  logs are not fabricated or backfilled.
- Web qLCR/r6Qt: params.duration overrides body.duration; isCaller controls
  direction; calltype 1 means video; action misscall plus reason controls labels.
  Frontend uses core static SVGs, duration, callback via existing voice controller,
  external time pill, and excludes call cards from ordinary reply/reaction actions.

## 02 October 2026

Current checkpoint: a real Chrome `/zalo-team` voice call from Duy to Hoà Ads
connected for 39 seconds; the user confirmed both sides could hear each other.
The user changed the live target from Anh Nguyen to Hoà Ads during UI testing.
Do not reuse the earlier hardcoded Anh Nguyen probe for further live calls.
The following early negotiation sections describe the investigation history.

### Implemented media and current limits

- `portable-call.mjs`: 401, caller UDP initialization, 416 invitation, answer
  control/408 acknowledgement, media, 409 hangup and scoped connector cleanup.
- SRTP AES_CM_128_HMAC_SHA1_80, KDR 0, no MKI. Core `0x8e9b60` uses the first
  30 ASCII session bytes when no explicit key is supplied: 16 key + 14 salt.
  Never treat the UDP token as key material. The encoder matches an isolated
  core dummy-session vector and RFC 3711 Appendix B.3 derived keys.
- Uplink routing: type 3 + token uint32 LE + SRTP. Downlink: type 4 + SRTP,
  with no token prefix. Validate negotiated server source before SRTP auth.
- RTP uses PT112, 16 kHz timestamp clock (+320 per 20 ms), internal user ID as
  SSRC, BEDE one-byte extension ID 5 with a 2-byte transport sequence.
- The Opus codec bridge takes browser PCM and returns 48 kHz mono PCM for
  browser playback. It creates no OS audio devices and launches no PC engine.
- Real browser proof: 1,898 packets sent, 1,862 received/authenticated, no SRTP
  drops; physical two-way hearing confirmed by the user. No audio was recorded.
- A coarse Windows timer caused playout queue drops during that call. The
  subsequent dedicated audio clock fixes cadence in a real WebRTC/Opus synthetic
  roundtrip (499 frames/5 seconds, zero drops). This clock revision has not been
  heard in another live call yet.
- Remaining: long-call keepalive/RTCP, jitter/loss handling, incoming calls,
  video/groups, network changes, Linux and production deployment. A 39-second
  call proves the implemented path, not reliability across these scenarios.

Local startup: install dependencies in this directory, then run
`tooling/zalo-team/call/start-local.ps1` from the repository. It binds loopback
port 9260. The authenticated Next API handles `/api/zalo-team/call`; credentials
stay server-side. No Wine/virtual device/native runtime is required by this path.

### Proven independently of the PC runtime

1. Generate a command 401 using a positive signed-32-bit numeric call ID,
   peer ID kept as a decimal string, codec `[]\n`, and native type 1.
2. The existing account connector executes the client's `requestCall`.
   The upstream response has status 0, numeric `fromId`/`toId`, `sessId`,
   `rtpIP`/`rtcpIP`, candidate servers, and audio configuration.
3. Encode the initial caller datagram. A packet emitted by our Node encoder
   matched the vendor's 183-byte loopback capture exactly.
4. Send this packet to one RTP endpoint supplied for the authorized session.
   Actual upstream replies were 55–56 bytes, status 0, matched the call ID,
   and contained a nonzero connection token. No native executable ran for this
   test. This was Node on Windows; a Linux runtime has not yet been tested.

The earlier error 114 used a 13-digit timestamp call ID and null codec.
Replacing these with the core's actual request passed. The individual cause
has not been isolated by varying one field at a time; do not assert that all
114 errors mean an invalid call ID.

### Initial wire format, pinned to PC 26.9.10

Little endian integers. This section covers only caller-init request/response;
the implemented later media framing is documented above.

| Byte offset | Request |
| --- | --- |
| 0 | 1 (request) |
| 1 | 126 |
| 2–9 | Zero in initial capture; semantics not assigned |
| 10–13 | Internal caller ID from the 401 response |
| 14–17 | Zero in initial capture |
| 18–19 | Command 11 |
| 20 | 2 in captured caller initialization |
| 21–24 | Call ID |
| 25–28 | Internal callee ID from the 401 response |
| 29–30 | Session byte length |
| 31 onward | Opaque session bytes |

Response starts with 2 instead of 1. After its common 21-byte header:
signed result at 21, and on success call ID at 25, token at 29, UTF-8 string
length at 33, string at 35. The trailing string's meaning is not established.
Do not assume it is an address or key. Token/session material must stay out of
logs and UI. The parser validates length, command/type, and expected call ID.

### How the core was checked

Pinned `ZaloCall.exe` SHA256 is enforced by `NativeCallSession`. Each probe
owns new named pipes and a child process. It does not attach to the running
PC app or use Computer Use. The first probe withheld all signaling. A second
offline probe used dummy identities/session, zeroed unrecognized response
strings, and loopback RTP/RTCP endpoints. A synthetic ACK advanced the core
to command 416, which was captured and never forwarded.

Static x86 analysis of the same executable corroborates the ACK decoder:

- `0x429118` thunk → `0x8944b6` wrapper → `0x8934fa` packet parser.
- Response command 11/12 branch: `0x893810`.
- LE uint32 readers: `0x8944f0`, `0x89458c`.
- LE uint16-length string reader: `0x892c67`.
- Success handler logs result at object+0x40 and token at object+0x14.

These addresses are specific to the pinned build and are not an API.

### Captured second-stage invitation

The offline core emits command 416 with `callId`, `calleeId`, `codec`,
`extendData`, `rtpAddress`, `rtcpAddress`, `session`.

- Codec: `opus/16000/1`, payload 112, frmPtime 20, dynamicFptime 0.
- `extendData`: callType 0, packetMode 2, newZrtc 1, srtpMode 1,
  serverAddr array and p2p candidates, plus capability/configuration fields.
- `session` has the same dummy bytes as the initial 401 fixture (152 bytes).
- Actual server configuration also reported 16 kHz mono and srtpMode 1.

This differs from the browser-facing Salework SDP (Opus/48000/2/PT111 plus
fallback codecs). Correct framing, timestamps, codec negotiation and SRTP
key handling must be established; simply forwarding browser UDP is not a
working bridge. Whether resampling/transcoding is necessary depends on the
chosen implementation and has not been decided.

### Original investigation plan (superseded by current checkpoint above)

1. Follow core SRTP initialization and packetMode 2 framing. Known entry:
   peer SRTP setup at `0x8879ca`, transport init thunk `0x409ffc` →
   `0x8f35e6`; inputs/derivation still require analysis. Never assume the
   UDP connection token is the SRTP master key.
2. Implement scoped media lifecycle, keepalive/end and invitation 416 using
   the negotiated configuration. Validate with core captures before live use.
3. Join browser WebRTC audio to this media leg, then verify ringing, answer,
   two-way audio, mute, hangup, timeout and reconnection on the authorized pair.
4. Wire the Team UI only after the media leg works. The button remains disabled.

### Evidence and commands

Sanitized results under ignored `.local/zalo-call-assets/`:
`native-offline-proof.json`, `native-negotiation-proof.json`,
`portable-negotiation-proof.json`, `native-local-media-proof.json`,
`native-local-invite-proof.json`. No live session or token is persisted.

`probe-native-negotiation.mjs <scope-file> --portable` performs only 401.
`--udp-init` additionally sends one initial UDP handshake. Both are live,
authorized-account probes, not unit tests; they must not run in CI or retry
automatically. Latest code explicitly sends scoped end 409 before closing.

Focused tests use `node --test --test-isolation=none` on voice-request,
zrtc-init, native-session, and web/call-session test files. Ten passed.
The default isolated test runner hit Windows spawn EPERM; same tests passed
without spawning separate test processes.


2026-10-03 runtime recovery: port 9260 is reserved for start-local.ps1 (ZRTC). The audio-only Docker compose/probe now uses host port 9261. An old audio-test container on 9260 returns no callReady capability and cannot place Zalo calls. Stop that container before starting the live gateway; retained test images/assets are unchanged.
