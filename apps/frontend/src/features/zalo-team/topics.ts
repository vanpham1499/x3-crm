export type TopicCreate =
  | { kind: 'note'; title: string; pin: boolean }
  | {
      kind: 'reminder';
      title: string;
      startTime: number;
      onlyMe: boolean;
      repeat: 'none' | 'daily' | 'weekly' | 'weeklyMultiDays' | 'monthly' | 'yearly';
      byDay: string[];
    };
export type TopicCatalog = {
  canNote: boolean;
  canPin: boolean;
  canReminder: boolean;
  onlyMe: boolean;
  advancedRepeat: boolean;
  minLeadMs: number;
};
export function validTopic(value: unknown): boolean {
  const p = value as TopicCreate | { kind: 'catalog' };
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const keys = Object.keys(p).sort().join(',');
  if (p.kind === 'catalog') return keys === 'kind';
  if (
    typeof p.title !== 'string' ||
    !p.title.trim() ||
    p.title.length > 3000 ||
    new TextEncoder().encode(p.title.trim()).length > 3700
  )
    return false;
  if (p.kind === 'note') return keys === 'kind,pin,title' && typeof p.pin === 'boolean';
  return (
    p.kind === 'reminder' &&
    keys === 'byDay,kind,onlyMe,repeat,startTime,title' &&
    typeof p.onlyMe === 'boolean' &&
    Number.isSafeInteger(p.startTime) &&
    p.startTime > 0 &&
    p.startTime < 8640000000000000 &&
    ['none', 'daily', 'weekly', 'weeklyMultiDays', 'monthly', 'yearly'].includes(p.repeat) &&
    Array.isArray(p.byDay) &&
    p.byDay.length <= 7 &&
    new Set(p.byDay).size === p.byDay.length &&
    p.byDay.every((d) => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(d)) &&
    (p.repeat === 'weeklyMultiDays' ? p.byDay.length > 0 : p.byDay.length === 0)
  );
}
