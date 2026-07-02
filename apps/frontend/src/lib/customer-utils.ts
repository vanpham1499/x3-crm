import type { Customer } from '@/types/customer';

export const CUSTOMER_ALL_STATUS = 'Tất cả';

export const CUSTOMER_STATUS_TABS = [CUSTOMER_ALL_STATUS, 'Fail', 'Theo dõi', '4.CHỐT'];

export type CustomerPillTone = 'blue' | 'violet' | 'slate';

export function getCustomerStatusClass(status: string) {
  if (status === '4.CHỐT') return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  if (status === 'Theo dõi') return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  if (status === 'Fail') return 'bg-red-100 text-red-700 ring-1 ring-red-200';
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

export function getCustomerLink(customer: Customer) {
  return customer.website || customer.planLink;
}

export function getExternalUrl(value: string) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getLinkLabel(value: string) {
  if (!value) return '';

  try {
    const url = new URL(getExternalUrl(value));
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

export function getCustomerSearchText(customer: Customer) {
  return [
    customer.customerCode,
    customer.leadCode,
    customer.owner,
    customer.source,
    customer.service,
    customer.phone,
    customer.website,
    customer.planLink,
    customer.industry,
    customer.note,
  ]
    .join(' ')
    .toLowerCase();
}

export function getCustomerPillToneClass(tone: CustomerPillTone) {
  return {
    blue: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
    violet: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
    slate: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  }[tone];
}
