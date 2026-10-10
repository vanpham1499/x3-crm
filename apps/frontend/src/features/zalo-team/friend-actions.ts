import { teamFetch } from './request';
export type FriendAction =
  | { kind: 'search'; phone: string }
  | { kind: 'open'; phone: string; userId: string }
  | { kind: 'status'; userId: string }
  | { kind: 'send'; phone?: string; userId: string; message: string };
export type FriendPerson = {
  id: string;
  name: string;
  avatarSrc?: string;
  coverSrc?: string;
  isFriend: boolean;
  requested: boolean;
  incoming: boolean;
  self: boolean;
};
export function validFriend(value: unknown): value is FriendAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v).sort().join(',');
  const uid = typeof v.userId === 'string' && /^\d{1,30}$/.test(v.userId);
  if (v.kind === 'status') return keys === 'kind,userId' && uid;
  if (v.phone !== undefined && (typeof v.phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(v.phone)))
    return false;
  if (v.kind === 'open') return keys === 'kind,phone,userId' && uid && !!v.phone;
  if (v.kind === 'search') return keys === 'kind,phone' && !!v.phone;
  return (
    v.kind === 'send' &&
    ['kind,message,phone,userId', 'kind,message,userId'].includes(keys) &&
    typeof v.userId === 'string' &&
    /^\d{1,30}$/.test(v.userId) &&
    typeof v.message === 'string' &&
    !!v.message.trim() &&
    v.message.length <= 150 &&
    !/[\x00-\x08\x0b-\x1f]/.test(v.message)
  );
}
export function internationalPhone(input: string) {
  const clean = input.replace(/[\s().-]/g, '');
  return clean.startsWith('0')
    ? '+84' + clean.slice(1)
    : clean.startsWith('84')
      ? '+' + clean
      : clean;
}

export async function requestFriend(
  accountId: number,
  friend: FriendAction,
  signal?: AbortSignal,
  requestId?: string,
) {
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'friend-action', accountId, friend, requestId }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
  if (data.accountId !== accountId) throw Error('WEB_IDENTITY_MISMATCH');
  if ('userId' in friend && data.person && data.person.id !== friend.userId)
    throw Error('WEB_IDENTITY_MISMATCH');
  return data as {
    accountId: number;
    status: string;
    person?: FriendPerson;
    conversationId?: string;
  };
}
