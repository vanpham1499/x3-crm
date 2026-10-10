'use client';
import { useSyncExternalStore } from 'react';
import type { ChatMessage, ExpressionCatalog } from './types';
type Artwork = { sprite: string; position: string };
type Catalog = { map: Map<string, Artwork>; pattern: RegExp | null };
const empty: Catalog = { map: new Map(), pattern: null };
const catalogs = new Map<number, Catalog>();
const listeners = new Set<() => void>();
export function registerEmojiArtwork(accountId: number, catalog: ExpressionCatalog) {
  if (!catalog.sprite) return;
  const map = new Map<string, Artwork>();
  for (const item of catalog.emojiGroups.flatMap((group) => group.items)) {
    const art = { sprite: catalog.sprite, position: item.position };
    if (item.key) map.set(item.key, art);
    if (item.text) map.set(item.text, art);
  }
  const keys = [...map.keys()]
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  catalogs.set(accountId, { map, pattern: keys.length ? new RegExp(keys.join('|'), 'gu') : null });
  listeners.forEach((fn) => fn());
}
export function emojiTokens(text: string, accountId?: number): NonNullable<ChatMessage['inline']> {
  const catalog = catalogs.get(accountId || 0);
  if (!catalog?.pattern) return [{ text }];
  const tokens: NonNullable<ChatMessage['inline']> = [];
  let offset = 0;
  for (const match of text.matchAll(catalog.pattern)) {
    const start = match.index!;
    if (start > offset) tokens.push({ text: text.slice(offset, start) });
    tokens.push({ text: match[0], ...catalog.map.get(match[0])! });
    offset = start + match[0].length;
  }
  if (offset < text.length) tokens.push({ text: text.slice(offset) });
  return tokens;
}
export function useEmojiArtwork(accountId?: number) {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => catalogs.get(accountId || 0) || empty,
    () => empty,
  );
}
