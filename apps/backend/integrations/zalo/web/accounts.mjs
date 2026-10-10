import crypto from "node:crypto";
import { InboxReader } from "./inbox-reader.mjs";
import { validateIdentity } from "./guards.mjs";
import { mergeConversations } from "./conversations.mjs";

// Keep the original profile in place; migration never copies or deletes auth data.
export function migrateLegacy(record) {
  return {
    version: 2,
    owner: record.owner || null,
    nextId: 2,
    slots: record.owner
      ? [
          {
            id: 1,
            profile: "profile",
            account: record.account,
            enabled: !!record.enabled,
          },
        ]
      : [],
  };
}

export class Accounts {
  constructor(
    record,
    {
      save,
      launch,
      inspect,
      readConversations,
      readMessages,
      searchMessages,
      readExpressions,
      readMentions,
      readCallCapabilities,
      historySync,
      callSession,
      sendText,
      messageAction,
      conversationSettings,
      guardConversation,
      groupAction,
      directory,
      friendAction,
      pollAction,
      topicAction,
      readConversationInfo,
      now = Date.now,
      inboxTimeout = 8000,
      recover,
    },
  ) {
    this.record = record;
    this.save = () => save(this.record);
    this.launch = launch;
    this.inspect = inspect;
    this.readConversations = readConversations;
    this.readMessages = readMessages;
    this.searchMessages = searchMessages;
    this.readExpressions = readExpressions;
    this.readMentions = readMentions;
    this.readCallCapabilities = readCallCapabilities;
    this.historySync = historySync;
    this.callSession = callSession;
    this.sendText = sendText;
    this.messageAction = messageAction;
    this.conversationSettings = conversationSettings;
    this.guardConversation = guardConversation;
    this.groupAction = groupAction;
    this.directory = directory;
    this.friendAction = friendAction;
    this.pollAction = pollAction;
    this.topicAction = topicAction;
    this.readConversationInfo = readConversationInfo;
    this.now = now;
    this.inboxReader = new InboxReader({ now, timeout: inboxTimeout });
    this.recover = recover;
    this.sessions = new Map();
    this.login = null;
  }
  session(slot) {
    if (!this.sessions.has(slot.id))
      this.sessions.set(slot.id, {
        current: { state: "stopped" },
        handle: null,
        lastActivity: this.now(),
        recoveries: 0,
      });
    return this.sessions.get(slot.id);
  }
  async stop(slot) {
    this.inboxReader.forget(slot.id);
    const session = this.session(slot);
    const handle = session.handle;
    session.handle = null;
    session.current = { state: "stopped" };
    if (handle) await handle.close();
  }
  async start(slot) {
    const session = this.session(slot);
    if (session.handle) return;
    session.current = { state: "starting" };
    try {
      session.handle = await this.launch(slot.profile, () => {
        session.handle = null;
        session.current = { state: "stopped" };
      });
    } catch {
      session.current = { state: "blocked", error: "WEB_START_FAILED" };
    }
  }
  snapshot(owner) {
    if (owner !== this.record.owner)
      return {
        runtime: { available: true, provider: "web", state: "idle" },
        campaignProtocol: 1,
        accounts: [],
        login: null,
      };
    const pending =
      this.login &&
      this.record.slots.find((s) => s.id === this.login.accountId);
    const current = pending
      ? this.session(pending).current
      : { state: "ready" };
    return {
      campaignProtocol: 1,
      runtime: {
        available: true,
        provider: "web",
        state: current.state,
        error: current.error || null,
      },
      accounts: this.record.slots
        .filter((s) => s.account)
        .map((s) => {
          const state = this.session(s).current.state;
          const status =
            state === "connected"
              ? "connected"
              : [
                    "waiting_scan",
                    "expired",
                    "confirming",
                    "identity_mismatch",
                  ].includes(state)
                ? "expired"
                : ["stopped", "offline", "blocked"].includes(state)
                  ? "offline"
                  : "connecting";
          return { ...s.account, id: s.id, status };
        }),
      login: pending
        ? {
            ...this.login,
            state: current.state,
            error: current.error || null,
            name: pending.account?.name || null,
            qr: current.state === "waiting_scan" ? current.qr || null : null,
          }
        : null,
    };
  }
  async refreshSlot(slot) {
    const session = this.session(slot);
    if (!session.handle) return;
    // Native read/send adapters recheck identity themselves. Coalesce status
    // probes when list, detail and sidebar arrive together.
    if (session.probe) return session.probe;
    session.probe = this.inspectSlot(slot, session);
    try {
      await session.probe;
    } finally {
      session.probe = null;
    }
  }
  async inspectSlot(slot, session) {
    try {
      session.current = validateIdentity(
        await this.inspect(session.handle),
        slot.account,
      );
      if (session.current.state === "identity_mismatch") {
        await this.stop(slot);
        session.current = { state: "identity_mismatch" };
      } else if (session.current.state === "connected") {
        const value = session.current;
        if (
          this.record.slots.some(
            (s) =>
              s.id !== slot.id && s.account?.externalId === value.externalId,
          )
        ) {
          await this.stop(slot);
          slot.enabled = false;
          session.current = {
            state: "blocked",
            error: "ACCOUNT_ALREADY_LINKED",
          };
          await this.save();
          return;
        }
        if (
          !slot.account ||
          this.now() - Date.parse(slot.account.updatedAt) > 15000 ||
          !slot.enabled
        ) {
          slot.account = {
            id: slot.id,
            externalId: value.externalId,
            name: value.name,
            avatarSrc: value.avatarSrc,
            color: "#b8c7e3",
            updatedAt: new Date(this.now()).toISOString(),
          };
          slot.enabled = true;
          await this.save();
        }
      }
      if (
        this.login?.accountId === slot.id &&
        this.now() > this.login.expiresAt &&
        session.current.state !== "connected"
      ) {
        await this.stop(slot);
        session.current = { state: "expired" };
      }
    } catch {
      session.current = {
        state: "connecting",
        error: "WEB_STATUS_UNAVAILABLE",
      };
    }
  }
  async refresh() {
    // save() serializes writes; one stalled page must not stall all status probes.
    await Promise.all(this.record.slots.map(async slot => {
      let timer;
      try { await Promise.race([this.refreshSlot(slot), new Promise(resolve => { timer = setTimeout(resolve, 8000); })]); }
      finally { clearTimeout(timer); }
    }));
  }
  async recoverInbox() {
    const due = this.record.slots.filter(slot => {
      const e = this.inboxReader.entries.get(slot.id);
      return slot.enabled && e?.nextRetryAt && !e.waiter &&
        (e.nextRetryAt <= this.now() || (e.firstFailure != null && this.now() - e.firstFailure >= 90000));
    });
    return Promise.all(due.map(async slot => {
      const session = this.session(slot), entry = this.inboxReader.entries.get(slot.id);
      // Never reload during user work/calls or continuously cycle a broken profile.
      if (this.recover && session.handle && entry?.firstFailure != null &&
          this.now() - entry.firstFailure >= 90000 &&
          this.now() - session.lastActivity >= 45000 && !session.activeCommands && !session.recovering &&
          (session.recoveries || 0) < 2 && entry.attempts >= 5) {
        session.recovering = true; session.recoveries = (session.recoveries || 0) + 1;
        const handle = session.handle;
        handle.inboxGeneration = (handle.inboxGeneration || 0) + 1;
        session.current = {state: 'connecting'};
        console.info(JSON.stringify({event:'inbox-recover', accountId:slot.id, attempt:session.recoveries}));
        try { await this.recover(handle); }
        catch { /* Keep the profile and let the next bounded read report its state. */ }
        finally { session.recovering = false; }
      }
      const result = await this.command({owner: this.record.owner, action: 'conversations', accountId: slot.id});
      if (result.accounts[0]?.error === null) { session.recoveries = 0; return slot.id; }
      return null;
    }));
  }
  async command(body, emit) {
    const session = body.accountId !== undefined &&
      !['conversations', 'status', 'begin', 'retry', 'cancel', 'stop'].includes(body.action)
      ? this.session(this.ownedSlot(body)) : null;
    if (session) { session.activeCommands = (session.activeCommands || 0) + 1; session.lastActivity = this.now(); }
    try { return await this.executeCommand(body, emit); }
    finally { if (session) { session.activeCommands--; session.lastActivity = this.now(); } }
  }
  async executeCommand(body, emit) {
    if (
      [
        "history-sync",
        "message-action",
        "messages",
        "message-search",
        "conversation-info",
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
      ].includes(body.action)
    ) {
      const slot = this.ownedSlot(body);
      await this.refreshSlot(slot);
      if (body.expectedExternalId && String(slot.account?.externalId) !== body.expectedExternalId) throw Error('WEB_IDENTITY_MISMATCH');
      const session = this.session(slot);
      if (
        !slot.enabled ||
        !slot.account ||
        !session.handle ||
        session.current.state !== "connected"
      )
        throw Error("WEB_ACCOUNT_OFFLINE");
      if (
        this.guardConversation &&
        body.action !== "history-sync" &&
        body.action !== "friend-action" && body.action !== "directory" &&
        !(body.action === "group-action" && !body.conversationId && ["catalog", "create"].includes(body.group.kind)) &&
        !(
          body.action === "conversation-settings" &&
          ["hide", "unhide", "hidden-list"].includes(body.settings.kind)
        )
      )
        await this.guardConversation(
          session.handle,
          slot.account.externalId,
          body.conversationId,
        );
      if (body.action === 'message-search') return {accountId:slot.id,conversationId:body.conversationId,...await this.searchMessages(session.handle,slot.account.externalId,body)};
      if (body.action === 'history-sync') return {accountId:slot.id,...await this.historySync(session.handle,slot.account.externalId,body)};
      if (body.action === "directory") return {accountId:slot.id,...await this.directory(session.handle,slot.account.externalId,body)};
      if (body.action === "friend-action") return {accountId: slot.id, ...await this.friendAction(session.handle, slot.account.externalId, body)};
      if (body.action === "call-capabilities")
        return {
          accountId: slot.id,
          conversationId: body.conversationId,
          ...(await this.readCallCapabilities(
            session.handle,
            slot.account.externalId,
            body,
          )),
        };
      if (body.action === "call-session")
        return {
          accountId: slot.id,
          conversationId: body.conversationId,
          ...(await this.callSession(
            session.handle,
            slot.account.externalId,
            body,
          )),
        };
      return {
        accountId: slot.id,
        conversationId: body.conversationId,
        ...(["send-text", "send-sticker", "send-media"].includes(body.action)
          ? await this.sendText(
              session.handle,
              slot.account.externalId,
              body,
              emit &&
                ((data) =>
                  emit({
                    accountId: slot.id,
                    conversationId: body.conversationId,
                    ...data,
                  })),
            )
          : body.action === "topic-action"
            ? await this.topicAction(
                session.handle,
                slot.account.externalId,
                body,
              )
            : body.action === "poll-action"
              ? await this.pollAction(
                  session.handle,
                  slot.account.externalId,
                  body,
                )
              : body.action === "group-action"
                ? await this.groupAction(
                    session.handle,
                    slot.account.externalId,
                    body,
                  )
                : body.action === "conversation-settings"
                  ? await this.conversationSettings(
                      session.handle,
                      slot.account.externalId,
                      body,
                    )
                  : body.action === "message-action"
                    ? await this.messageAction(
                        session.handle,
                        slot.account.externalId,
                        body,
                      )
                    : body.action === "mentions"
                      ? await this.readMentions(
                          session.handle,
                          slot.account.externalId,
                          body,
                        )
                      : body.action === "expressions"
                        ? await this.readExpressions(
                            session.handle,
                            slot.account.externalId,
                            body,
                          )
                        : body.action === "conversation-info"
                          ? await this.readConversationInfo(
                              session.handle,
                              slot.account.externalId,
                              body.conversationId,
                              body.section,
                              body.cursor,
                              emit &&
                                ((data) =>
                                  emit({
                                    accountId: slot.id,
                                    conversationId: body.conversationId,
                                    ...data,
                                  })),
                            )
                          : await this.readMessages(
                              session.handle,
                              slot.account.externalId,
                              body.conversationId,
                              body.before,
                              emit &&
                                ((data) =>
                                  emit({
                                    accountId: slot.id,
                                    conversationId: body.conversationId,
                                    ...data,
                                  })),
                              body.refresh,
                            )),
        fetchedAt: new Date(this.now()).toISOString(),
      };
    }
    if (body.action === "conversations") {
      if (body.owner !== this.record.owner)
        throw Error("WEB_OWNED_BY_ANOTHER_USER");
      if (body.accountId !== undefined) this.ownedSlot(body);
      const slots = this.record.slots.filter(s => s.account && (body.accountId === undefined || s.id === body.accountId));
      const results = await Promise.all(slots.map(async slot => {
        const session = this.session(slot);
        const result = await this.inboxReader.read(slot, session, async () => {
          await this.refreshSlot(slot);
          if (slot.enabled && session.handle && ['starting','connecting','offline'].includes(session.current.state))
            throw Error("WEB_CONVERSATIONS_NOT_READY:frame_loading");
          if (!slot.enabled || !session.handle || session.current.state !== "connected")
            throw Error("WEB_ACCOUNT_OFFLINE");
          return this.readConversations(session.handle, slot.account.externalId);
        });
        const state = {
          id: slot.id, name: slot.account.name, avatarSrc: slot.account.avatarSrc,
          state: session.current.state, count: result.rows.length,
          error: result.error, readiness: result.readiness,
        };
        emit?.({accounts:[state], conversations:mergeConversations([{account:slot.account,rows:result.rows}]),
          partial:true, fetchedAt:new Date(this.now()).toISOString()});
        return {slot,result,state};
      }));
      const sources = results.map(({slot, result}) => ({account: slot.account, rows: result.rows}));
      const accountStates = results.map(r => r.state);
      return {
        conversations: mergeConversations(sources),
        accounts: accountStates,
        fetchedAt: new Date(this.now()).toISOString(),
      };
    }
    if (body.action === "status") {
      if (body.accountId !== undefined) {
        const slot = this.ownedSlot(body);
        await this.refreshSlot(slot);
      }
      return this.snapshot(body.owner);
    }
    if (this.record.owner && body.owner !== this.record.owner)
      throw Error("WEB_OWNED_BY_ANOTHER_USER");
    if (body.action === "begin") {
      if (
        this.login &&
        this.session(
          this.record.slots.find((s) => s.id === this.login.accountId),
        ).current.state !== "connected"
      ) {
        if (
          body.accountId !== undefined &&
          body.accountId !== this.login.accountId
        )
          throw Error("LOGIN_IN_PROGRESS");
        return this.snapshot(body.owner);
      }
      let slot;
      if (body.accountId !== undefined) slot = this.ownedSlot(body);
      else {
        // Abandoned attempts keep their files, but are never reused for another identity.
        slot = {
          id: this.record.nextId++,
          profile: "profiles/" + crypto.randomUUID(),
          account: null,
          enabled: false,
        };
        this.record.slots.push(slot);
      }
      this.record.owner = body.owner;
      await this.save();
      this.login = {
        id: crypto.randomUUID(),
        accountId: slot.id,
        expiresAt: this.now() + 180000,
      };
      await this.start(slot);
      await this.refreshSlot(slot);
    } else if (["cancel", "retry"].includes(body.action)) {
      if (!this.login || body.loginId !== this.login.id)
        throw Error("LOGIN_REQUEST_CHANGED");
      const slot = this.record.slots.find((s) => s.id === this.login.accountId);
      const connected = this.session(slot).current.state === "connected";
      if (body.action === "cancel") {
        this.login = null;
        if (!connected) {
          await this.stop(slot);
          slot.enabled = false;
          await this.save();
        }
      } else if (!connected) {
        const duplicate =
          this.session(slot).current.error === "ACCOUNT_ALREADY_LINKED";
        await this.stop(slot);
        if (duplicate && !slot.account) {
          slot.profile = "profiles/" + crypto.randomUUID();
          await this.save();
        }
        this.login = {
          id: crypto.randomUUID(),
          accountId: slot.id,
          expiresAt: this.now() + 180000,
        };
        await this.start(slot);
        await this.refreshSlot(slot);
      }
    } else if (body.action === "stop") {
      const slot = this.ownedSlot(body);
      slot.enabled = false;
      await this.save();
      if (this.login?.accountId === slot.id) this.login = null;
      await this.stop(slot);
    }
    return this.snapshot(body.owner);
  }
  ownedSlot(body) {
    if (body.owner !== this.record.owner)
      throw Error("WEB_OWNED_BY_ANOTHER_USER");
    const slot = this.record.slots.find(
      (s) => s.id === body.accountId && s.account,
    );
    if (!slot) throw Error("ACCOUNT_NOT_FOUND");
    return slot;
  }
  async restore() {
    for (const slot of this.record.slots)
      if (slot.enabled && slot.account) await this.start(slot);
  }
  async close() {
    for (const slot of this.record.slots) await this.stop(slot);
  }
}
