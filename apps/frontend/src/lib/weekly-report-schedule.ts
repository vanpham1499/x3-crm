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

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function getIsoWeekdayFromDateString(value?: string | null): number | null {
  return value ? getIsoWeekday(parseDate(value)) : null;
}

export function addDaysToDateString(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function getTodayDateString(): string {
  return formatDate(new Date());
}

export function getIsoWeekMondayString(value?: string): string {
  const date = value ? parseDate(value) : new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - (getIsoWeekday(date) - 1));
  return formatDate(date);
}

export function getWeeklyReportCycle(
  weekStart: string,
  reportWeekday?: number | null,
  projectStartDate?: string | null,
) {
  if (!weekStart || !reportWeekday) return null;

  const normalizedWeekStart = getIsoWeekMondayString(weekStart);
  const dueDate = addDaysToDateString(normalizedWeekStart, reportWeekday - 1);
  const normalizedProjectStart = projectStartDate ? formatDate(parseDate(projectStartDate)) : '';

  // A reporting deadline must happen after the project has actually started.
  if (normalizedProjectStart && dueDate <= normalizedProjectStart) return null;

  const fullPeriodStart = addDaysToDateString(dueDate, -7);
  const periodStartDate =
    normalizedProjectStart && fullPeriodStart < normalizedProjectStart
      ? normalizedProjectStart
      : fullPeriodStart;

  return {
    weekStart: normalizedWeekStart,
    weekEnd: addDaysToDateString(normalizedWeekStart, 6),
    dueDate,
    periodStartDate,
    periodEndDate: addDaysToDateString(dueDate, -1),
  };
}

export function getFirstEligibleReportWeekStart(
  weekStart: string,
  reportWeekday?: number | null,
  projectStartDate?: string | null,
): string {
  const normalizedWeekStart = getIsoWeekMondayString(weekStart);
  if (!reportWeekday || !projectStartDate) return normalizedWeekStart;

  const normalizedProjectStart = formatDate(parseDate(projectStartDate));
  const projectWeekStart = getIsoWeekMondayString(normalizedProjectStart);
  const candidateWeekStart =
    normalizedWeekStart < projectWeekStart ? projectWeekStart : normalizedWeekStart;
  const candidateDueDate = addDaysToDateString(candidateWeekStart, reportWeekday - 1);

  return candidateDueDate <= normalizedProjectStart
    ? addDaysToDateString(candidateWeekStart, 7)
    : candidateWeekStart;
}

/** Monday of the current ISO week, formatted as YYYY-MM-DD. */
export function getCurrentIsoWeekMondayString(): string {
  return getIsoWeekMondayString();
}

/** Sunday of the current ISO week, formatted as YYYY-MM-DD. */
export function getCurrentIsoWeekSundayString(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - getIsoWeekday(now)));
  return formatDate(sunday);
}
