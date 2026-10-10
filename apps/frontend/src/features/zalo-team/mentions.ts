export type Mention = { pos: number; len: number; uid: string; type: 0 | 1 };
export type MentionMember = { id: string; name: string; avatarSrc?: string; all: boolean };
export const noMentions: Mention[] = [];
export function validMentions(value: unknown, text: string): value is Mention[] {
  if (typeof text !== 'string' || !Array.isArray(value) || value.length > 100) return false;
  let end = 0;
  const ids = new Set<string>();
  return value.every((m) => {
    if (
      !m ||
      typeof m !== 'object' ||
      Object.keys(m).sort().join() !== 'len,pos,type,uid' ||
      !Number.isSafeInteger(m.pos) ||
      !Number.isSafeInteger(m.len) ||
      m.pos < end ||
      m.len < 2 ||
      m.pos + m.len > text.length ||
      text[m.pos] !== '@' ||
      /[\r\n]/.test(text.slice(m.pos, m.pos + m.len)) ||
      typeof m.uid !== 'string' ||
      !(m.type === 0 ? /^\d{1,30}$/.test(m.uid) : m.type === 1 && m.uid === '-1') ||
      ids.has(m.uid)
    )
      return false;
    end = m.pos + m.len;
    ids.add(m.uid);
    return true;
  });
}
// Edits inside a mention invalidate it; edits before it move the native UTF-16 range.
export function editMentions(before: string, after: string, mentions: Mention[]): Mention[] {
  if (before === after) return mentions;
  let start = 0,
    tail = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  while (
    tail < Math.min(before.length, after.length) - start &&
    before[before.length - tail - 1] === after[after.length - tail - 1]
  )
    tail++;
  const end = before.length - tail,
    delta = after.length - before.length;
  return mentions.flatMap((m) => {
    if (m.pos + m.len <= start) return [m];
    if (m.pos >= end) return [{ ...m, pos: m.pos + delta }];
    return [];
  });
}
export function mentionQuery(text: string, caret: number, mentions: Mention[]) {
  const pos = text.lastIndexOf('@', caret - 1);
  if (
    pos < 0 ||
    caret <= pos ||
    (pos > 0 && !/[ \n]/.test(text[pos - 1])) ||
    mentions.some((m) => pos < m.pos + m.len && caret > m.pos)
  )
    return null;
  const query = text.slice(pos + 1, caret);
  return /^\s|[\n@]/.test(query) ? null : { pos, len: caret - pos, query };
}
const strip = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
export function filterMembers(members: MentionMember[], query: string, mentions: Mention[]) {
  const words = strip(query).trim().split(/\s+/).filter(Boolean);
  return members.filter((m) => {
    if (mentions.some((v) => v.uid === m.id)) return false;
    const name = strip(m.name).split(/\s+/),
      used = new Set<number>();
    return words.every((word) => {
      const at = name.findIndex((part, i) => !used.has(i) && part.startsWith(word));
      if (at < 0) return false;
      used.add(at);
      return true;
    });
  });
}
