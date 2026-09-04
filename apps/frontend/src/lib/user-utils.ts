import { ROLE_LABELS } from '@/lib/utils';
import type { User } from '@/types/user';

export const USER_ALL_FILTER = 'Tất cả';

export type UserLabelSource = {
  code?: string | null;
  name?: string | null;
  email?: string | null;
};

/**
 * One canonical employee label for tables, filters, forms and detail dialogs.
 * It also avoids duplicating the code when an API value is already formatted.
 */
export function formatUserLabel(user?: UserLabelSource | null, fallback = '-', separator = ' - ') {
  const code = user?.code?.trim() || '';
  const name = user?.name?.trim() || '';
  const email = user?.email?.trim() || '';

  if (code && name) {
    const normalizedCode = code.toLocaleUpperCase('vi-VN');
    const normalizedName = name.toLocaleUpperCase('vi-VN');

    if (normalizedName === normalizedCode || normalizedName.startsWith(`${normalizedCode} -`)) {
      return name;
    }

    return `${code}${separator}${name}`;
  }

  return code || name || email || fallback;
}

export function getUserStatusLabel(user: User) {
  return user.isActive === false ? 'Vô hiệu' : 'Hoạt động';
}

export function getUserStatusClass(user: User) {
  return user.isActive === false
    ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
    : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
}

export function getUserRoleClass(role: string) {
  if (role === 'ADMIN') return 'bg-red-100 text-red-700 ring-1 ring-red-200';
  if (role === 'LEADER') return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200';
  if (role === 'ACCOUNTANT') return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
  if (role === 'SALES') return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200';
  return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200';
}

export function getUserRoleLabel(role: string) {
  return ROLE_LABELS[role] || role || '-';
}
