# Zalo Team: native loading and change notifications

Updated 2026-10-01. Implemented locally; not a VPS release or user acceptance record.

## Boundary

The authenticated Next.js endpoints remain a narrow bridge to the selected account's Web profile. They enforce CRM owner, Origin, connected identity and inbox membership. They do not reproduce Zalo's HTTP protocol, expose cookies/keys to the frontend, select native chats or send read receipts. UI state and response projection are application code; history/cache/cloud loading remains vendor code.

## Source evidence

- Current Web assets observed in Chrome: `1.e0ef5e98f8f9d8970e2c.js`, `web-startup.17b0ef90dff987d682d1.js`. Downloaded public source hashes matched the research copies.
- `ZCU6.d` owns initial/top loading, verification, local/cloud fallback and grouped messages. Native dispatch already contains parsed rows. An instance per request captures its output and supplies only the request's current rows/cursor via `getState`. No shared native loader/store method is replaced. Constructor has no subscription/interval; no extra persistent loader cache is introduced.
- `MPLC.b.messageCache` and `enz2.a` provide the vendor cache/local path. Native first-page sizes are adaptive; forcing 50 DB rows after every open bypassed that behavior.
- `dEOl.default.getChatMedia` calls `handleSuccess` with available local results before cloud completion. Each section is streamed when available. For inactive conversations, an insufficient page may still need native `loadMiniPreview` because of the vendor's active-chat guard. Thus cloud latency is not eliminated.
- `emRR.default` and `CzFt.a` expose actual store subscriptions. Event bridge coalesces notifications for 100 ms; payload contains account/revision only. No message bodies or authentication material are broadcast.
- PC 26.9.10 `pc-dist/compact-app-pc.bee53f6b7719d6a93320.js` has the same loader-manager pattern: cached loaders, `getLastMessagesForConversation`, `loadTopMessagesForConversation`, and deactivation/cleanup. This supports the architectural comparison, not binary/API compatibility. PC was checked from source, not controlled through Computer Use.

## Transport and lifecycle

`Accept: application/x-ndjson` opts in to streaming on existing messages/info commands. Intermediate packets carry `partial: true`; final packet carries `partial: false`. Scope is attached by the worker and checked by the frontend. Errors after headers are an error packet. Plain JSON clients retain the final-response contract.

One `events` connection per page replaces the 10-second list/history timers. Server closes each connection after 25 seconds; client reconnects and resynchronizes list/current cache, with up to 10 seconds backoff on failure. This is bounded HTTP streaming, not a new Zalo WebSocket protocol. Account health probing remains every 5 seconds. Events trigger a cache read, not an unconditional cloud history reload. Reaction/deletion semantics for every message type are outside this change.

Scheduler lanes use account/action/conversation; send and unrelated reads progress independently. Account lifecycle commands wait for existing lanes and block new work through a barrier. Aborted frontend requests stop their transport and queued canceled work is skipped; already running native operations may finish until their bounded timeout. Metadata writes are serialized; concurrent status probes share one in-flight inspection.

Only in-flight rows and frontend view state are retained by this bridge. Account profiles and vendor IndexedDB remain in the existing persistent Docker volume. This change adds no long-term media/history archive.

## Measurements

Read-only measurements against Duy / My Documents, loopback worker, warm profile/cache. Time includes command processing and serialization, excludes browser layout and CRM authentication proxy.

| Operation | Before | After |
| --- | --- | --- |
| List, complete | 86 ms | 88–112 ms |
| Open, first usable data / complete | 201 / 201 ms | 31–41 / 42–46 ms |
| Sidebar, first media section / complete | 333 / 333 ms | 24–33 / 350–352 ms |
| Refresh, complete | 76 ms | 56–60 ms |

Small samples with different native batch sizes; not a controlled benchmark, p95, throughput or a global speed guarantee. Sidebar completion did not improve in these samples; visible cache content arrives earlier. Cold startup/list after container restart took about 4 seconds in the first measurement.

Native history returned 13, 15 and 4 items across pages (32 unique IDs), then a null cursor. All 32 items returned by native cache refresh were present in those pages. Old raw-DB row counts are not a completeness reference because native grouping may differ.

## Verification

- Worker tests: ownership/identity, profile lifecycle, send receipts/idempotency, scheduler independence/barrier/failure recovery, event owner isolation/unsubscribe, native cache emitted before cloud completion, top cursor, no double parsing and wrong-identity rejection.
- Browser fixtures: send/drafts/unknown outcome, sidebar/library/viewer, pagination/scroll anchor/delayed media/cancellation. No real profile is used by these fixtures. Fixture retry selector was scoped to chat; viewer assertion waits for React's reset effect.
- Live `/zalo-team`: Duy and Ánh lists; Duy My Documents history/sidebar; one authorized multiline Vietnamese/emoji test sent successfully, preview updated automatically. Screenshot: `.local/send-proof/native-loader-send.png`.
- Web reference inspected live in Duy Anh Web Chrome; Team emoji/composer remains consistent with the preceding Web/PC style fix. PC source and user's supplied screenshot provide PC comparison; no live PC interaction test.
- Unverified: sustained multi-account traffic, long disconnections, every incoming/E2EE event variant, all old-message types and end-to-end browser p95. No claim of full parity with Zalo Web performance or permanent history retention.

## Maintenance

Run `npm test` in `tooling/zalo-team/web`; run frontend TypeScript and the send/sidebar/message-scroll browser fixtures. If vendor module contracts change, return adapter errors and re-inspect source; do not silently switch to raw DB scans or send/read actions. Build only `tooling/zalo-team/web/compose.yml` for this runtime.
