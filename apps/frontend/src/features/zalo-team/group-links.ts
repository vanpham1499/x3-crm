import { teamFetch } from './request';
import type { Conversation } from './types';
export type LinkedGroup = {
  id: string;
  sources: string[];
  preferredAccountId: number | null;
  automatic?: boolean;
};
export type GroupLinkAction =
  | { kind: 'link'; sources: string[] }
  | { kind: 'unlink'; groupId: string; source: string }
  | { kind: 'remember'; groupId: string; accountId: number | null };
export function validGroupLink(value: unknown): value is GroupLinkAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>,
    keys = Object.keys(v).sort().join(',');
  if (v.kind === 'link')
    return (
      keys === 'kind,sources' &&
      Array.isArray(v.sources) &&
      v.sources.length >= 2 &&
      v.sources.length <= 30 &&
      v.sources.every((s) => typeof s === 'string' && /^[1-9]\d*:g\d{1,30}$/.test(s)) &&
      new Set(v.sources.map((s) => (s as string).split(':')[0])).size === v.sources.length
    );
  if (typeof v.groupId !== 'string' || !/^[a-f0-9-]{36}$/.test(v.groupId)) return false;
  if (v.kind === 'unlink')
    return (
      keys === 'groupId,kind,source' &&
      typeof v.source === 'string' &&
      /^[1-9]\d*:g\d{1,30}$/.test(v.source)
    );
  return (
    v.kind === 'remember' &&
    keys === 'accountId,groupId,kind' &&
    (v.accountId === null || (Number.isSafeInteger(v.accountId) && Number(v.accountId) > 0))
  );
}
export async function changeGroupLink(link: GroupLinkAction) {
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'group-links', link }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
  return data as { groups: LinkedGroup[] };
}
export type GroupedRow = {
  conversation: Conversation;
  sources: Conversation[];
  link?: LinkedGroup;
};
export function groupRows(
  rows: Conversation[],
  links: LinkedGroup[],
  preferred: Record<string, number> = {},
): GroupedRow[] {
  const bySource = new Map(links.flatMap((g) => g.sources.map((s) => [s, g] as const))),
    result = new Map<string, GroupedRow>();
  const identities = new Map<string, Conversation[]>();
  for (const row of rows) {
    const id = row.globalGroupId;
    if (
      !row.group ||
      !id ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
      ['0', 'null', 'undefined'].includes(id)
    )
      continue;
    if (!row.accountId || bySource.has(String(row.id))) continue;
    identities.set(id, [...(identities.get(id) || []), row]);
  }
  for (const [identity, sources] of identities) {
    // Two native conversations in one account claiming the same ID are an
    // ambiguous mapping. Keep them separate instead of guessing by name.
    if (sources.length < 2 || new Set(sources.map((s) => s.accountId)).size !== sources.length)
      continue;
    const id = 'auto:' + identity;
    const link: LinkedGroup = {
      id,
      automatic: true,
      sources: sources.map((s) => String(s.id)),
      preferredAccountId: preferred[id] || null,
    };
    for (const source of link.sources) bySource.set(source, link);
  }
  for (const row of rows) {
    const link = row.group ? bySource.get(String(row.id)) : undefined,
      key = link ? 'linked:' + link.id : String(row.id);
    const existing = result.get(key);
    if (existing) {
      existing.sources.push(row);
      continue;
    }
    result.set(key, { conversation: row, sources: [row], link });
  }
  for (const row of result.values())
    if (row.link) {
      const latest = [...row.sources].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      row.conversation = {
        ...latest,
        id: 'linked:' + row.link.id,
        preview: latest.preview.replace(/^Bạn:/, `${latest.accountName}:`),
        previewInline: latest.previewInline?.map((token, index) =>
          index === 0
            ? { ...token, text: token.text.replace(/^Bạn:/, `${latest.accountName}:`) }
            : token,
        ),
        unread: 0,
        unreadMarked: row.sources.some((s) => !!s.unread || !!s.unreadMarked),
        pinned: row.sources.some((s) => s.pinned),
        muted: row.sources.every((s) => s.muted),
      };
    }
  return [...result.values()].sort(
    (a, b) =>
      Number(!!b.conversation.pinned) - Number(!!a.conversation.pinned) ||
      (b.conversation.updatedAt || 0) - (a.conversation.updatedAt || 0),
  );
}
