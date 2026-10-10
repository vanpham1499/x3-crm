import { teamFetch } from './request';
import type { Conversation, ConversationListResponse } from './types';
export type DirectoryAction =
  | { kind: 'search'; query: string; offset: number }
  | { kind: 'friends' | 'groups' | 'requests' }
  | { kind: 'invitations'; page: number }
  | { kind: 'profile' | 'open'; id: string; conversationId: string; messageId?: string }
  | {
      kind:
        | 'profile'
        | 'open'
        | 'accept'
        | 'reject'
        | 'cancel'
        | 'block'
        | 'unblock'
        | 'remove'
        | 'join'
        | 'decline';
      id: string;
    }
  | { kind: 'label'; id: string; labelId: string | null };
export const directoryReads: string[] = [
  'search',
  'friends',
  'groups',
  'requests',
  'invitations',
  'profile',
  'open',
];
export function validDirectory(value: unknown): value is DirectoryAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>,
    keys = Object.keys(v).sort().join(',');
  if (v.kind === 'search')
    return (
      keys === 'kind,offset,query' &&
      typeof v.query === 'string' &&
      v.query.trim().length > 0 &&
      v.query.length <= 200 &&
      Number.isSafeInteger(v.offset) &&
      Number(v.offset) >= 0 &&
      Number(v.offset) <= 1000000
    );
  if (['friends', 'groups', 'requests'].includes(String(v.kind))) return keys === 'kind';
  if (v.kind === 'invitations')
    return (
      keys === 'kind,page' &&
      Number.isSafeInteger(v.page) &&
      Number(v.page) >= 0 &&
      Number(v.page) < 10000
    );
  if (typeof v.id !== 'string' || !/^g?\d{1,30}$/.test(v.id)) return false;
  if (['profile', 'open'].includes(String(v.kind)) && v.conversationId !== undefined)
    return (
      ['conversationId,id,kind', 'conversationId,id,kind,messageId'].includes(keys) &&
      /^\d+$/.test(v.id) &&
      typeof v.conversationId === 'string' &&
      /^g?\d{1,30}$/.test(v.conversationId) &&
      (v.messageId === undefined ||
        (typeof v.messageId === 'string' && /^\d{1,30}$/.test(v.messageId)))
    );
  if (v.kind === 'label')
    return (
      keys === 'id,kind,labelId' &&
      (v.labelId === null || (typeof v.labelId === 'string' && /^-?\d{1,30}$/.test(v.labelId)))
    );
  return (
    keys === 'id,kind' &&
    [
      'profile',
      'open',
      'accept',
      'reject',
      'cancel',
      'block',
      'unblock',
      'remove',
      'join',
      'decline',
    ].includes(String(v.kind)) &&
    (!['profile', 'accept', 'reject', 'cancel', 'block', 'unblock', 'remove'].includes(
      String(v.kind),
    ) ||
      /^\d+$/.test(v.id)) &&
    (!['join', 'decline'].includes(String(v.kind)) || v.id.startsWith('g'))
  );
}
export type DirectoryPerson = {
  id: string;
  name: string;
  avatarSrc?: string;
  avatarMembers?: Conversation['avatarMembers'];
  group?: boolean;
  memberCount?: number;
  updatedAt?: number;
  blocked?: boolean;
  isFriend?: boolean;
  message?: string;
  time?: number;
  inviter?: string;
  pending?: boolean;
  coverSrc?: string;
  gender?: string;
  birthday?: string;
  phone?: string;
  alias?: string;
};
export type DirectoryData = {
  nextOffset?: number | null;
  accountId: number;
  items?: DirectoryPerson[];
  incoming?: DirectoryPerson[];
  outgoing?: DirectoryPerson[];
  labels?: { id: string; name: string; members: string[]; color?: string }[];
  hasMore?: boolean;
  total?: number;
  person?: DirectoryPerson;
  conversationId?: string;
  status?: string;
};
// Keep the same receipt when a user reopens an action with an uncertain outcome.
const receipts = new Map<string, string>();
export async function directoryRequest(
  accountId: number,
  directory: DirectoryAction,
  signal?: AbortSignal,
  requestId?: string,
): Promise<DirectoryData> {
  const read = directoryReads.includes(directory.kind);
  const key = JSON.stringify([accountId, directory]);
  const receipt = read ? undefined : requestId || receipts.get(key) || crypto.randomUUID();
  if (receipt) receipts.set(key, receipt);
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'directory',
      accountId,
      directory,
      requestId: receipt,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
  if (data.accountId !== accountId) throw Error('WEB_IDENTITY_MISMATCH');
  if (data.status === 'confirmed') receipts.delete(key);
  return data;
}
export function directoryConversation(
  p: DirectoryPerson,
  a: ConversationListResponse['accounts'][number],
): Conversation {
  return {
    ...p,
    id: `${a.id}:${p.id}`,
    conversationId: p.id,
    accountId: a.id,
    accountName: a.name,
    accountAvatarSrc: a.avatarSrc,
    preview: '',
    time: '',
    color: '#e5efff',
  };
}
