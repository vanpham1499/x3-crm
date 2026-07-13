const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

export function getReportWeekdayLabel(weekday?: number | null) {
  return weekday ? WEEKDAY_LABELS[weekday] || '' : '';
}

/** ISO weekday: 1 (Monday) .. 7 (Sunday). */
export function getIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Monday of the current ISO week, formatted as YYYY-MM-DD. */
export function getCurrentIsoWeekMondayString(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (getIsoWeekday(now) - 1));
  return formatDate(monday);
}

/** Sunday of the current ISO week, formatted as YYYY-MM-DD. */
export function getCurrentIsoWeekSundayString(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - getIsoWeekday(now)));
  return formatDate(sunday);
}
