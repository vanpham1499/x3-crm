import type { InfoMedia } from './types';

export function normalizedSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

export function filterInfoMedia(
  items: InfoMedia[],
  filters: { query: string; sender: string; days: number; kind: string },
  now = Date.now(),
) {
  const query = normalizedSearch(filters.query);
  return items.filter(
    (item) =>
      (!query || normalizedSearch(`${item.name} ${item.url || ''}`).includes(query)) &&
      (!filters.sender || item.sender?.id === filters.sender) &&
      (!filters.days || item.time >= now - filters.days * 86400000) &&
      (!filters.kind ||
        (filters.kind === 'image' || filters.kind === 'video'
          ? item.kind === filters.kind
          : filters.kind === 'document'
            ? /\.(pdf|docx?|txt)$/i.test(item.name)
            : filters.kind === 'sheet'
              ? /\.(xlsx?|csv)$/i.test(item.name)
              : /\.(zip|rar|7z)$/i.test(item.name))),
  );
}
