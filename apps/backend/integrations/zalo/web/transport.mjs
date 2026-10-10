import crypto from "node:crypto";

// Only callbacks for in-flight responses. No message/history cache in the bridge.
const channels = new WeakMap();
export async function channel(page, receive) {
  let state = channels.get(page);
  if (!state) {
    state = { callbacks: new Map() };
    channels.set(page, state);
    state.ready = page.exposeBinding(
      "__zaloTeamPacket",
      ({ frame }, id, packet) => {
        if (/^https:\/\/chat\.zalo\.me\//.test(frame.url()))
          state.callbacks.get(id)?.(packet);
      },
    );
  }
  await state.ready;
  const id = crypto.randomUUID();
  state.callbacks.set(id, receive);
  return { id, close: () => state.callbacks.delete(id) };
}

// Independent read/send lanes, with lifecycle mutations as a barrier. A slow
// account/history request cannot block another account or its own send lane.
export class Scheduler {
  constructor() {
    this.barrier = Promise.resolve();
    this.lanes = new Map();
  }
  run(key, task) {
    const wait = key
      ? [this.barrier, this.lanes.get(key)]
      : [this.barrier, ...this.lanes.values()];
    const job = Promise.all(wait).then(task);
    const tail = job.catch(() => {});
    if (key) {
      this.lanes.set(key, tail);
      tail.then(() => {
        if (this.lanes.get(key) === tail) this.lanes.delete(key);
      });
    } else this.barrier = tail;
    return job;
  }
  idle() {
    return Promise.all([this.barrier, ...this.lanes.values()]);
  }
}

export class Events {
  constructor() {
    this.listeners = new Set();
    this.revision = 0;
  }
  publish(owner, accountId, detail = {}) {
    const event = { ...detail, accountId, revision: ++this.revision };
    for (const listener of this.listeners)
      if (listener.owner === owner) listener.emit(event);
  }
  subscribe(owner, emit) {
    const listener = { owner, emit };
    this.listeners.add(listener);
    emit({ resync: true, revision: this.revision });
    return () => this.listeners.delete(listener);
  }
}

const watchers = new WeakMap();
export async function watchNative(page, expectedId, changed) {
  let state = watchers.get(page);
  if (!state) {
    state = await channel(page, changed);
    watchers.set(page, state);
  }
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) return;
  await frame.evaluate(
    ({ expectedId, id }) => {
      if (globalThis.__zaloTeamWatch?.identity === expectedId) return;
      globalThis.__zaloTeamWatch?.dispose();
      let req;
      const key = "zt-watch-" + crypto.randomUUID();
      const chunk = [
        [key],
        {
          [key]: (m, e, r) => {
            req = r;
          },
        },
        [[key]],
      ];
      globalThis.webpackJsonp.push(chunk);
      delete req.c[key];
      delete req.m[key];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (k) => req.c[k]?.exports;
      if (String(get("dThN")?.default?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const stores = [get("emRR")?.default, get("CzFt")?.a];
      if (stores.some((s) => !s?.subscribe))
        throw Error("WEB_EVENTS_ADAPTER_CHANGED");
      let timer;
      let areas = new Set(), ids = new Set(), all = false;
      const notify = (hint = { areas: ['inbox'] }) => {
        for (const area of hint.areas) areas.add(area);
        if (hint.areas.some(a => a !== 'inbox')) {
          if (!hint.conversationIds?.length) all = true;
          else for (const cid of hint.conversationIds) ids.add(cid);
        }
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          const packet = { areas: [...areas], conversationIds: all ? undefined : [...ids] };
          areas.clear(); ids.clear(); all = false;
          globalThis.__zaloTeamPacket(id, packet).catch(() => {});
        }, 150);
      };
      // Redux subscribers fire even for clocks/typing/UI state. Compare only
      // message-bearing references, not the entire conversation object.
      const select = () => {
        const state = stores[0].getState?.();
        if (!state?.conversations?.alls) return null;
        return new Map(Object.entries(state.conversations.alls).filter(([cid]) => /^g?\d+$/.test(cid))
          .map(([cid,c]) => [cid, [c.messages, c.msgList, c.messageCache, c.needReloadMessage]]));
      };
      let previous = select();
      const messageChanged = () => {
        const next = select();
        if (!next || !previous) { previous = next; notify({areas:['inbox','messages']}); return; }
        const changed = [...new Set([...previous.keys(), ...next.keys()])].filter(cid => {
          const a = previous.get(cid), b = next.get(cid);
          return !a || !b || a.some((v,i) => v !== b[i]);
        });
        previous = next;
        if (changed.length) notify({areas:['inbox','messages'], conversationIds:changed});
      };
      const off = [stores[0].subscribe(messageChanged), stores[1].subscribe(() => notify())];
      // Use the client's existing event bus for recall/delete/group/privacy
      // changes that may not alter a loaded message array. No dispatch wrapping.
      const bus = get('Ydol')?.default, constants = get('97kL');
      const names = new Map();
      for (const group of Object.values(constants || {}))
        if (group && typeof group === 'object') for (const [name,value] of Object.entries(group)) names.set(value,name);
      const targets = value => {
        const values = Array.isArray(value) ? value : [value];
        return [...new Set(values.flatMap(v => [v?.conversationId,v?.convId,v?.conversation?.userId,v?.delConversationId])
          .map(v=>String(v||'')).filter(v=>/^g?\d{1,30}$/.test(v)))];
      };
      const busChanged = (type, payload) => {
        const name = names.get(type) || '';
        if (/UNDO|RECALL|DELETE_MESSAGE|DELETE_EVERYONE|POLL|REACTION/.test(name))
          notify({areas:['inbox','messages','info'],conversationIds:targets(payload)});
        else if (/GROUP_UPDATED|FRIENDS_REMOVED|CHANGE_INFO|UPDATE_FRIEND_PROFILE|UPDATE_CONVERSATION_SETTINGS|HIDDEN|TTL/.test(name))
          notify({areas:['inbox','info','privacy','directory'],conversationIds:targets(payload)});
      };
      if (bus?.subscribe && bus?.unsubscribe) { bus.subscribe(busChanged); off.push(()=>bus.unsubscribe(busChanged)); }
      const reactions = get("ofhN")?.b;
      const reacted = value => notify({areas:['messages'],conversationIds:targets(value)});
      if (reactions?.addUpdateReactListener && reactions?.removeUpdateReactListener) {
        reactions.addUpdateReactListener(reacted);
        off.push(() => reactions.removeUpdateReactListener(reacted));
      }
      globalThis.__zaloTeamWatch = {
        identity: expectedId,
        dispose() {
          clearTimeout(timer);
          off.forEach((f) => f());
        },
      };
    },
    { expectedId, id: state.id },
  );
}
