export function validMessageSearch(v: any) {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).every((k) => ['query', 'sender', 'days', 'before'].includes(k)) &&
    typeof v.query === 'string' &&
    (v.query.trim().length > 0 || v.sender !== 'all' || v.days !== 0) &&
    v.query.length <= 100 &&
    typeof v.sender === 'string' &&
    /^(all|me|others|[0-9]{1,30})$/.test(v.sender) &&
    [0, 7, 30, 90].includes(v.days) &&
    (v.before === undefined ||
      (v.before &&
        Object.keys(v.before).sort().join(',') === 'id,time' &&
        typeof v.before.id === 'string' &&
        /^[\w-]{1,80}$/.test(v.before.id) &&
        typeof v.before.time === 'string' &&
        /^\d{1,16}$/.test(v.before.time)))
  );
}

export type SearchHit = {
  id: string;
  time: number;
  text: string;
  kind: string;
  sender: { id: string; name: string };
};
export type SearchPage = {
  accountId: number;
  conversationId: string;
  items: SearchHit[];
  cursor: { id: string; time: string } | null;
};

export function mergeSearchPages(stored: SearchPage, live: SearchPage | null): SearchPage {
  if (
    live &&
    (live.accountId !== stored.accountId || live.conversationId !== stored.conversationId)
  )
    throw Error('WEB_IDENTITY_MISMATCH');
  const compare = (
    a: { id: string; time: string | number },
    b: { id: string; time: string | number },
  ) => Number(a.time) - Number(b.time) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const frontier = [stored.cursor, live?.cursor]
    .filter((c): c is NonNullable<SearchPage['cursor']> => !!c)
    .sort(compare)
    .at(-1);
  const all = [
    ...new Map([...stored.items, ...(live?.items || [])].map((item) => [item.id, item])).values(),
  ].sort((a, b) => compare(b, a));
  const items = (frontier ? all.filter((item) => compare(item, frontier) >= 0) : all).slice(0, 50);
  const last = items.at(-1);
  return {
    ...stored,
    items,
    cursor: (frontier || all.length > 50) && last ? { id: last.id, time: String(last.time) } : null,
  };
}

/** Preserve original Vietnamese accents while highlighting an accent-insensitive match. */
export function searchExcerpt(text: string, query: string) {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  const positions: number[] = [];
  let normalized = '';
  for (let i = 0; i < text.length; i++) {
    const chunk = normalize(text[i]);
    for (let n = 0; n < chunk.length; n++) positions.push(i);
    normalized += chunk;
  }
  const term = normalize(query.trim()),
    at = term ? normalized.indexOf(term) : -1;
  if (at < 0) return { before: text.slice(0, 240), match: '', after: text.length > 240 ? '…' : '' };
  const start = positions[at],
    end = positions[at + term.length - 1] + 1,
    from = Math.max(0, start - 65),
    to = Math.min(text.length, end + 160);
  return {
    before: (from ? '…' : '') + text.slice(from, start),
    match: text.slice(start, end),
    after: text.slice(end, to) + (to < text.length ? '…' : ''),
  };
}
