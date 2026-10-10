import type { ConversationListResponse } from './types';
export type ChangeArea = 'inbox' | 'messages' | 'info' | 'privacy' | 'directory';
export type InboxDelta = {
  account: ConversationListResponse['accounts'][number];
  upserts: ConversationListResponse['conversations'];
  removed: string[];
};
export type Change = {
  accountId?: number;
  resync?: boolean;
  revision?: number;
  error?: string;
  inbox?: InboxDelta;
  inboxes?: InboxDelta[];
  changes?: { accountId: number; conversationIds?: string[]; areas: string[] }[];
};
export function affects(
  event: Change,
  area: ChangeArea,
  accountId?: number,
  conversationId?: string,
) {
  if (event.error) return false;
  if (event.accountId !== undefined && accountId !== undefined && event.accountId !== accountId)
    return false;
  if (event.resync || !event.changes) return true; // Legacy/unknown events must not lose updates.
  return event.changes.some(
    (change) =>
      change.areas.includes(area) &&
      (accountId === undefined || accountId === change.accountId) &&
      (!conversationId ||
        !change.conversationIds ||
        change.conversationIds.includes(conversationId)),
  );
}
export function mergeChanges(previous: Change | undefined, event: Change): Change {
  const deltas = new Map<number, InboxDelta>();
  for (const delta of [
    ...(previous?.inboxes || []),
    ...(previous?.inbox ? [previous.inbox] : []),
    ...(event.inboxes || []),
    ...(event.inbox ? [event.inbox] : []),
  ]) {
    const old = deltas.get(delta.account.id);
    const rows = new Map((old?.upserts || []).map((row) => [String(row.id), row]));
    const removed = new Set(old?.removed);
    for (const id of delta.removed) {
      rows.delete(id);
      removed.add(id);
    }
    for (const row of delta.upserts) {
      rows.set(String(row.id), row);
      removed.delete(String(row.id));
    }
    deltas.set(delta.account.id, {
      account: delta.account,
      upserts: [...rows.values()],
      removed: [...removed],
    });
  }
  const scoped = new Map<
    string,
    { accountId: number; areas: string[]; conversationIds?: string[] }
  >();
  for (const change of [...(previous?.changes || []), ...(event.changes || [])])
    for (const area of change.areas) {
      const key = `${change.accountId}:${area}`,
        old = scoped.get(key);
      const ids =
        (old && !old.conversationIds) || !change.conversationIds
          ? undefined
          : [...new Set([...(old?.conversationIds || []), ...change.conversationIds])];
      scoped.set(key, {
        accountId: change.accountId,
        areas: [area],
        conversationIds: ids && ids.length <= 200 ? ids : undefined,
      });
    }
  return {
    revision: event.revision,
    resync: previous?.resync || event.resync,
    accountId: previous && previous.accountId !== event.accountId ? undefined : event.accountId,
    inboxes: [...deltas.values()],
    changes: (!previous || previous.changes) && event.changes ? [...scoped.values()] : undefined,
  };
}
export function applyInboxDelta(current: ConversationListResponse, deltas: InboxDelta[]) {
  const rows = new Map(current.conversations.map((row) => [String(row.id), row]));
  const accounts = new Map(current.accounts.map((account) => [account.id, account]));
  for (const delta of deltas) {
    accounts.set(delta.account.id, delta.account);
    for (const id of delta.removed)
      if (rows.get(id)?.accountId === delta.account.id) rows.delete(id);
    for (const row of delta.upserts)
      if (row.accountId === delta.account.id) rows.set(String(row.id), row);
  }
  return {
    ...current,
    accounts: [...accounts.values()].sort((a, b) => a.id - b.id),
    conversations: [...rows.values()].sort(
      (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0),
    ),
  };
}
