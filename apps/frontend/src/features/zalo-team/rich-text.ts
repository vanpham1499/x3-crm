import type { CSSProperties } from 'react';

/** Native Zalo RTF v1: UTF-16 offsets, never HTML. */
export type RichStyle = { start: number; len: number; st: string };
export const richCode =
  /^(b|i|u|s|f_(13|15|18|20)|c_[a-fA-F0-9]{6}|lst_[12]|ind_([1-9]|[1-4][0-9]|50))$/;
export function validRichStyles(value: unknown, text: unknown): value is RichStyle[] {
  return (
    typeof text === 'string' &&
    Array.isArray(value) &&
    value.length <= 250 &&
    value.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        Object.keys(s).length === 3 &&
        Number.isSafeInteger(s.start) &&
        Number.isSafeInteger(s.len) &&
        s.start >= 0 &&
        s.len > 0 &&
        s.start + s.len <= text.length &&
        typeof s.st === 'string' &&
        s.st.length <= 100 &&
        s.st.split(',').every((code: string) => richCode.test(code)),
    )
  );
}
export const codesAt = (ranges: RichStyle[], offset: number) => [
  ...new Set(
    ranges
      .filter((s) => offset >= s.start && offset < s.start + s.len)
      .flatMap((s) => s.st.split(',')),
  ),
];
export const family = (code: string) => code.split('_')[0];
export const blockCode = (code: string) => /^(lst|ind)_/.test(code);
export function richCss(codes: string[]): CSSProperties {
  const result: CSSProperties = {};
  if (codes.includes('b')) result.fontWeight = 500;
  if (codes.includes('i')) result.fontStyle = 'italic';
  if (codes.includes('u')) result.textDecorationSkipInk = 'none';
  result.textDecoration =
    [codes.includes('u') && 'underline', codes.includes('s') && 'line-through']
      .filter(Boolean)
      .join(' ') || undefined;
  for (const code of codes) {
    if (code.startsWith('f_')) result.fontSize = `${Number(code.slice(2))}px`;
    if (code.startsWith('c_')) result.color = `#${code.slice(2)}`;
  }
  return result;
}
export function packStyles(text: string, matrix: string[][]): RichStyle[] {
  const result: RichStyle[] = [];
  for (let start = 0; start < text.length;) {
    const st = [...new Set(matrix[start]?.filter((c) => !blockCode(c)) || [])].sort().join(',');
    let end = start + 1;
    while (
      end < text.length &&
      [...new Set(matrix[end]?.filter((c) => !blockCode(c)) || [])].sort().join(',') === st
    )
      end++;
    if (st) result.push({ start, len: end - start, st });
    start = end;
  }
  let start = 0;
  for (const line of text.split('\n')) {
    const len = line.length + (start + line.length < text.length ? 1 : 0);
    const st = (matrix[start] || []).filter(blockCode).join(',');
    if (len && st) result.push({ start, len, st });
    start += len;
  }
  return result;
}
export function editStyles(oldText: string, next: string, ranges: RichStyle[], pending?: string[]) {
  if (!ranges.length && !pending?.length) return ranges;
  let start = 0,
    end = 0;
  while (start < Math.min(oldText.length, next.length) && oldText[start] === next[start]) start++;
  while (
    end < Math.min(oldText.length - start, next.length - start) &&
    oldText[oldText.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  const inherited = pending ?? codesAt(ranges, Math.max(0, start - 1));
  return packStyles(
    next,
    Array.from({ length: next.length }, (_, i) =>
      i < start
        ? codesAt(ranges, i)
        : i >= next.length - end
          ? codesAt(ranges, oldText.length - next.length + i)
          : inherited,
    ),
  );
}
