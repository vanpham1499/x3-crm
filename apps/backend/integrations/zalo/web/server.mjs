import { InboxUpdates } from './inbox-updates.mjs';
import { randomUUID } from 'node:crypto';
import {searchMessages} from "./message-search.mjs";
import {Directory, directoryReads} from "./directory.mjs";
import { FriendActions } from "./friend-actions.mjs";
import { GroupLinks } from "./group-links.mjs";
import { TopicActions } from "./topics.mjs";
import { readCallCapabilities } from "./call-capabilities.mjs";
import { historySync } from "./history-sync.mjs";
import { callSession } from "./call-session.mjs";
import { PollActions } from "./polls.mjs";
import { GroupActions } from "./group-actions.mjs";
import { conversationSettings } from "./conversation-settings.mjs";
import { assertConversationNotHidden } from "./conversation-privacy.mjs";
import { readMentions } from "./mentions.mjs";
import { MessageActions } from "./message-actions.mjs";
import { readExpressions } from "./expressions.mjs";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { inspect } from "./adapter.mjs";
import { authorized, validCommand } from "./guards.mjs";
import { Accounts, migrateLegacy } from "./accounts.mjs";
import { readConversations } from "./conversations.mjs";
import { readMessages } from "./messages.mjs";
import { readConversationInfo } from "./conversation-info.mjs";
import { SendReceipts, nativeText } from "./send.mjs";
import { Uploads, validUpload } from "./uploads.mjs";
import { Scheduler, Events, watchNative } from "./transport.mjs";
const scheduler = new Scheduler(),
  events = new Events();

const root = process.env.DATA_DIR || "/data";
const groupLinks = new GroupLinks(path.join(root,'group-links'));
const topicActions = new TopicActions(path.join(root, "topic-receipts"));
const pollActions = new PollActions(path.join(root, "poll-receipts"));
const directory = new Directory(path.join(root,"directory-receipts"));
const friendActions = new FriendActions(path.join(root, "friend-receipts"));
const groupActions = new GroupActions(path.join(root, "group-receipts"));
const actions = new MessageActions(path.join(root, "action-receipts"));
const uploads = new Uploads(path.join(root, "uploads"));
await uploads.cleanup();
const sends = new SendReceipts(
  path.join(root, "send-receipts"),
  async (page, args) => {
    const media =
      args.media && args.phase !== "check"
        ? await uploads.get(args.media.uploadId, args, args.phase === "send")
        : args.media;
    if (args.mentions?.length && args.phase !== "check") {
      const catalog = await readMentions(page, args.expectedId, args);
      if (
        args.mentions.some(
          (m) =>
            !catalog.members.some(
              (member) =>
                member.id === m.uid &&
                args.text.slice(m.pos, m.pos + m.len) === "@" + member.name,
            ),
        )
      )
        throw Error("WEB_MENTION_UNAVAILABLE");
    }
    return nativeText(page, { ...args, media });
  },
);
const token = (
  await fs.readFile(
    process.env.CONNECTOR_TOKEN_FILE || "/run/secrets/connector_token",
    "utf8",
  )
).trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw Error("INVALID_CONNECTOR_SECRET");
await fs.mkdir(root, { recursive: true });
const file = path.join(root, "accounts.json");
let record;
try {
  record = JSON.parse(await fs.readFile(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw Error("WEB_STATE_INVALID");
  let legacy = {};
  try {
    legacy = JSON.parse(
      await fs.readFile(path.join(root, "account.json"), "utf8"),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw Error("WEB_STATE_INVALID");
  }
  record = migrateLegacy(legacy);
}
if (
  record.version !== 2 ||
  !Array.isArray(record.slots) ||
  !Number.isSafeInteger(record.nextId) ||
  record.nextId < 1 ||
  record.slots.some(
    (s) =>
      !Number.isSafeInteger(s.id) ||
      s.id < 1 ||
      !/^(profile|profiles\/[a-f0-9-]{36})$/.test(s.profile),
  )
)
  throw Error("WEB_STATE_INVALID");
let saving = Promise.resolve();
function save(value) {
  const data = JSON.stringify(value);
  const job = saving.then(async () => {
    await fs.writeFile(file + ".tmp", data, { mode: 0o600 });
    await fs.rename(file + ".tmp", file);
  });
  saving = job.catch(() => {});
  return job;
}
await save(record);
const accounts = new Accounts(record, {
  save,
  recover: handle => handle.page.reload({waitUntil: 'domcontentloaded', timeout: 15000}),
  inspect: async (handle) => {
    const value = await inspect(handle.page);
    if (value.state === "connected")
      await watchNative(handle.page, value.externalId, hint => {
        const slot = accounts.record.slots.find(
          (s) => accounts.session(s).handle === handle,
        );
        if (slot) inboxUpdates.hint(slot.id, hint);
      });
    return value;
  },
  readConversations: (handle, expectedId) =>
    readConversations(handle.page, expectedId),
  readMentions: (handle, expectedId, body) =>
    readMentions(handle.page, expectedId, body),
  readCallCapabilities: (handle, expectedId, body) =>
    readCallCapabilities(handle.page, expectedId, body),
  historySync: (handle, expectedId, body) => historySync(handle.page, expectedId, body),
  callSession: async (handle, expectedId, body) => {
    if (body.crmSender && body.call.kind === 'signal' && body.call.packet.command === 401)
      await sends.attribution.record(body.owner, expectedId, body.conversationId,
        String(body.call.packet.data.callId), body.crmSender, 'call');
    return callSession(handle.page, expectedId, body);
  },
  readExpressions: (handle, expectedId, body) =>
    readExpressions(handle.page, expectedId, body),
  searchMessages: (handle, expectedId, body) => searchMessages(handle.page, expectedId, body),
  readMessages: (handle, expectedId, conversationId, before, emit, refresh) =>
    readMessages(
      handle.page,
      expectedId,
      conversationId,
      before,
      emit,
      refresh,
    ),
  topicAction: (handle, expectedId, body) =>
    topicActions.run(handle.page, expectedId, body),
  pollAction: (handle, expectedId, body) =>
    pollActions.run(handle.page, expectedId, body),
  directory: (handle, expectedId, body) => directory.run(handle.page, expectedId, body),
  friendAction: (handle, expectedId, body) => friendActions.run(handle.page, expectedId, body),
  groupAction: (handle, expectedId, body) =>
    groupActions.run(handle.page, expectedId, body),
  conversationSettings: (handle, expectedId, body) =>
    conversationSettings(handle.page, expectedId, body),
  guardConversation: (handle, expectedId, conversationId) =>
    assertConversationNotHidden(handle.page, expectedId, conversationId),
  messageAction: (handle, expectedId, body) =>
    actions.run(handle.page, expectedId, body),
  sendText: (handle, expectedId, body, emit) =>
    sends.send(handle.page, expectedId, body, emit),
  readConversationInfo: (
    handle,
    expectedId,
    conversationId,
    section,
    cursor,
    emit,
  ) =>
    readConversationInfo(
      handle.page,
      expectedId,
      conversationId,
      section,
      cursor,
      emit,
    ),
  launch: async (profile, onClose) => {
    const context = await chromium.launchPersistentContext(
      path.join(root, profile),
      {
        headless: true,
        viewport: { width: 1280, height: 900 },
        locale: "vi-VN",
        timezoneId: "Asia/Ho_Chi_Minh",
        acceptDownloads: false,
      },
    );
    context.on("close", onClose);
    try {
      const page = context.pages()[0] || (await context.newPage());
      await page.goto("https://chat.zalo.me/", {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      return { page, close: () => context.close() };
    } catch (error) {
      await context.close().catch(() => {});
      throw error;
    }
  },
});
const inboxUpdates = new InboxUpdates({
  read: accountId => scheduler.run(`inbox-update:${accountId}`, () => accounts.command({owner:accounts.record.owner,action:'conversations',accountId})),
  publish: (accountId, detail) => events.publish(accounts.record.owner,accountId,detail),
});
let ready = scheduler.run(null, () => accounts.restore()),
  shuttingDown = false;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET" && req.url === "/health") {
    res.end(JSON.stringify({ok:true, inboxUpdates:inboxUpdates.stats}));
    return;
  }
  if (!authorized(req.headers.authorization, token) || req.headers.origin) {
    res.writeHead(403);
    res.end("{}");
    return;
  }
  if (req.method === "POST" && req.url === "/upload") {
    try {
      const header = req.headers["x-zalo-upload"];
      if (
        typeof header !== "string" ||
        header.length > 4000 ||
        req.headers["content-type"] !== "application/octet-stream"
      )
        throw Error("WEB_UPLOAD_INVALID");
      const meta = JSON.parse(decodeURIComponent(header));
      if (!validUpload(meta)) throw Error("WEB_UPLOAD_INVALID");
      await ready;
      const slot = accounts.ownedSlot(meta);
      if (!slot.enabled || !slot.account) throw Error("WEB_ACCOUNT_OFFLINE");
      res.end(JSON.stringify(await uploads.stage(req, meta)));
    } catch (e) {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          error: /^[A-Z_]+$/.test(e.message) ? e.message : "WEB_UPLOAD_FAILED",
        }),
      );
    }
    return;
  }
  if (req.method !== "POST" || req.url !== "/command") {
    res.writeHead(404);
    res.end("{}");
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20000) {
      res.writeHead(413);
      res.end("{}");
      return;
    }
  }
  try {
    const body = JSON.parse(raw);
    if (!validCommand(body)) throw Error("INVALID_REQUEST");
    await ready;
    const streaming = req.headers.accept === "application/x-ndjson";
    const emit = (value) => {
      if (res.destroyed || res.writableEnded) return;
      if (!res.headersSent)
        res.setHeader("Content-Type", "application/x-ndjson");
      res.write(JSON.stringify(value) + "\n");
    };
    if (body.action === "events") {
      if (body.owner !== accounts.record.owner)
        throw Error("WEB_OWNED_BY_ANOTHER_USER");
      if (!streaming) throw Error("INVALID_REQUEST");
      res.setHeader("Content-Type", "application/x-ndjson");
      const off = events.subscribe(body.owner, emit);
      const end = setTimeout(() => res.end(), 25000);
      res.on("close", () => {
        clearTimeout(end);
        off();
      });
      return;
    }
    const independent = [
      "history-sync",
      "messages",
      "message-search",
      "conversation-info",
      "message-action",
      "conversation-settings",
      "group-action",
      "directory",
      "friend-action",
      "poll-action",
      "topic-action",
      "send-text",
      "send-sticker",
      "send-media",
      "expressions",
      "mentions",
      "call-capabilities",
      "call-session",
      "conversations",
      "status",
    ].includes(body.action);
    const lane = body.action === "conversations" ? `inbox:${randomUUID()}` : independent
      ? `${body.accountId || "all"}:${body.action}:${["messages", "conversation-info"].includes(body.action) ? body.conversationId : ""}`
      : null;
    const decorate = (packet) => sends.attribution.decorate(body.owner,
      accounts.record.slots.find(s => s.id === body.accountId)?.account?.externalId,
      body.conversationId || "", packet);
    let pendingPackets = Promise.resolve(), packetError;
    const attributedEmit = packet => {
      pendingPackets = pendingPackets.then(async () => {
        if (!packetError) emit(await decorate(packet));
      }).catch(error => { packetError = error; });
    };
    let result = await scheduler.run(lane, async () => {
      if (res.destroyed) throw Error("WEB_REQUEST_CANCELLED");
      if(body.action==='group-links') return groupLinks.run(body.owner,body.link,()=>accounts.command({action:'conversations',owner:body.owner}));
      const result=await accounts.command(body, streaming ? attributedEmit : undefined);
      if(body.action==='conversations') result.groups=await groupLinks.project(body.owner,result.conversations);
      return result;
    });
    await pendingPackets;
    if (packetError) throw packetError;
    result = await decorate(result);
    if (
      [
        "message-action",
        "group-links",
        "conversation-settings",
        "group-action",
      "directory",
      "friend-action",
        "poll-action",
        "topic-action",
        "send-text",
        "send-sticker",
        "send-media",
        "begin",
        "retry",
        "stop",
        "cancel",
      ].includes(body.action) &&
      (body.action !== "conversation-settings" ||
        !["read", "privacy", "hidden-list"].includes(body.settings.kind)) &&
      (body.action !== "directory" || !directoryReads.includes(body.directory.kind)) &&
      (body.action !== "friend-action" || ["send", "open"].includes(body.friend.kind)) &&
      (body.action !== "group-action" || body.group.kind !== "catalog") &&
      (body.action !== "topic-action" || body.topic.kind !== "catalog") &&
      (body.action !== "poll-action" || body.poll.kind !== "catalog")
    )
      if (body.accountId && !['begin','retry','stop','cancel'].includes(body.action)) {
        const conversationId = body.conversationId || body.directory?.id || body.friend?.id;
        inboxUpdates.hint(body.accountId, {
          areas: ['inbox','messages','info',
            ...(['conversation-settings','group-action','directory','friend-action'].includes(body.action) ? ['privacy','directory'] : [])],
          conversationIds: conversationId ? [conversationId] : undefined,
        });
      } else {
        if (body.accountId) inboxUpdates.forget(body.accountId);
        events.publish(body.owner, body.accountId);
      }
    if (body.action === 'conversations') for (const account of result.accounts || [])
      inboxUpdates.baseline(account.id, {accounts:[account], conversations:result.conversations.filter(c=>c.accountId===account.id)});
    if (streaming) {
      emit({ ...result, partial: false });
      res.end();
    } else res.end(JSON.stringify(result));
  } catch (e) {
    const failure = {
      error: /^[A-Z_]+$/.test(e.message) ? e.message : "WEB_OPERATION_FAILED",
    };
    if (res.headersSent) res.end(JSON.stringify(failure) + "\n");
    else {
      res.writeHead(409);
      res.end(JSON.stringify(failure));
    }
  }
});
server.requestTimeout = 180000;
const uploadCleanup = setInterval(
  () => uploads.cleanup().catch(() => {}),
  60 * 60 * 1000,
);
uploadCleanup.unref();
server.listen(9250, "0.0.0.0", () =>
  console.log("Zalo Team Web connector ready"),
);
let refreshing = false;
const timer = setInterval(async () => {
  if (shuttingDown || refreshing) return;
  refreshing = true;
  try {
    await ready;
    const status = () =>
      JSON.stringify(
        accounts
          .snapshot(accounts.record.owner)
          .accounts.map((a) => [a.id, a.status, a.name]),
      );
    const before = status();
    await scheduler.run("status-refresh", () => accounts.refresh());
    if (before !== status()) events.publish(accounts.record.owner);
    for (const accountId of await accounts.recoverInbox())
      if (accountId !== null) events.publish(accounts.record.owner, accountId);
  } catch {
    /* Next bounded refresh rechecks connectivity. */
  } finally {
    refreshing = false;
  }
}, 5000);
async function shutdown() {
  shuttingDown = true;
  clearInterval(timer);
  server.close();
  await scheduler.idle();
  await accounts.close();
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
