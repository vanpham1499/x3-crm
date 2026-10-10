export type PrivacyAction =
  | { kind: 'privacy' }
  | { kind: 'ttl'; duration: number }
  | { kind: 'hide'; pin: string; setup?: true }
  | { kind: 'hidden-list'; pin: string }
  | { kind: 'unhide'; pin: string; targetId: string }
  | { kind: 'clear-history'; requestId: string }
  | { kind: 'report'; requestId: string; reason: number; content: string };
export type PrivacyState = {
  ttl: number;
  canTtl: boolean;
  ttlReason: string;
  durations: { value: number; enabled: boolean }[];
  hidden: boolean;
  hasPin: boolean;
  canHide: boolean;
  canReport: boolean;
  reasons: { id: number; label: string; other: boolean }[];
  otherReason: number;
};
export const privacyKinds = [
  'privacy',
  'ttl',
  'hide',
  'hidden-list',
  'unhide',
  'clear-history',
  'report',
];
export function validPrivacy(value: unknown): value is PrivacyAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>,
    keys = Object.keys(v).sort().join(',');
  if (v.kind === 'privacy') return keys === 'kind';
  if (v.kind === 'ttl')
    return (
      keys === 'duration,kind' &&
      typeof v.duration === 'number' &&
      [0, 3600000, 86400000, 604800000, 1209600000, 2592000000].includes(v.duration)
    );
  if (v.kind === 'hidden-list')
    return keys === 'kind,pin' && typeof v.pin === 'string' && /^\d{4}$/.test(v.pin);
  if (v.kind === 'hide')
    return (
      ['kind,pin', 'kind,pin,setup'].includes(keys) &&
      typeof v.pin === 'string' &&
      /^\d{4}$/.test(v.pin) &&
      (v.setup === undefined || v.setup === true)
    );
  if (v.kind === 'unhide')
    return (
      keys === 'kind,pin,targetId' &&
      typeof v.pin === 'string' &&
      /^\d{4}$/.test(v.pin) &&
      typeof v.targetId === 'string' &&
      /^g?\d{1,30}$/.test(v.targetId)
    );
  if (typeof v.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(v.requestId)) return false;
  if (v.kind === 'clear-history') return keys === 'kind,requestId';
  return (
    v.kind === 'report' &&
    keys === 'content,kind,reason,requestId' &&
    typeof v.reason === 'number' &&
    Number.isSafeInteger(v.reason) &&
    v.reason >= 0 &&
    typeof v.content === 'string' &&
    v.content.length <= 1000 &&
    !/[\x00-\x08]/.test(v.content)
  );
}
export const ttlLabel = (value: number) =>
  value === 0
    ? 'Không bao giờ'
    : value < 86400000
      ? `${value / 3600000} giờ`
      : `${value / 86400000} ngày`;
