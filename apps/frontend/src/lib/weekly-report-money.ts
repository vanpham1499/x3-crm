import type { WeeklyReportCurrency } from '@/types/weekly-report';

export function getWeeklyReportCurrency(value?: string | null): WeeklyReportCurrency {
  const code = String(value || 'VND')
    .trim()
    .toUpperCase();

  return /^[A-Z]{3,10}$/.test(code) ? code : 'VND';
}

/** Accept plain decimal input and unambiguous vi/en grouped pastes. Never strip cents. */
export function parseWeeklyReportAmount(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  let text = String(value)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, '');
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const separator = decimal === '.' ? ',' : '.';
    const parts = text.split(decimal);
    if (parts.length !== 2 || !/^\d{0,2}$/.test(parts[1])) return null;
    const groups = parts[0].split(separator);
    if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some((group) => !/^\d{3}$/.test(group)))
      return null;
    text = groups.join('') + '.' + parts[1];
  } else if (/^\d{1,3}([.,]\d{3}){2,}$/.test(text)) {
    // Two or more grouping separators are unambiguous. A single "1.234" is not.
    text = text.replace(/[.,]/g, '');
  } else {
    text = text.replace(',', '.');
  }
  if (!/^\d{1,13}(?:\.\d{0,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

export function formatWeeklyReportNumber(
  value: string | number | null | undefined,
  currency?: string | null,
) {
  const code = getWeeklyReportCurrency(currency);
  const amount = value === null || value === undefined ? '0.00' : parseWeeklyReportAmount(value);
  if (amount === null) return '—';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: code === 'VND' ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatWeeklyReportMoney(
  value: string | number | null | undefined,
  currency?: string | null,
) {
  return `${formatWeeklyReportNumber(value, currency)} ${getWeeklyReportCurrency(currency)}`;
}

export function weeklyReportMoneyDefaults(
  currency: WeeklyReportCurrency,
  monthlyBudget?: string | number | null,
) {
  // Project weekly settings currently contain VND. Foreign-currency reports require native inputs.
  if (currency !== 'VND')
    return { averageWeeklyBudget: '', totalBudget: '', monthlyBudget: '0.00' };
  const monthly = parseWeeklyReportAmount(monthlyBudget ?? '0') ?? '0.00';
  const [whole, fraction] = monthly.split('.');
  // The parser caps the integer part at 13 digits, so integer cents remain safe.
  const cents = Number(whole) * 100 + Number(fraction);
  const quarter = Math.floor((cents + 2) / 4);
  return {
    averageWeeklyBudget: `${Math.floor(quarter / 100)}.${String(quarter % 100).padStart(2, '0')}`,
    totalBudget: monthly,
    monthlyBudget: monthly,
  };
}
