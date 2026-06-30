import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export function formatDate(date: string | Date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
}

export const STATUS_LABELS = {
  ACTIVE: { label: 'Đang chạy', color: 'bg-green-100 text-green-700' },
  PAUSED: { label: 'Dừng chạy', color: 'bg-red-100 text-red-700' },
  PENDING: { label: 'Đang chờ', color: 'bg-yellow-100 text-yellow-700' },
  STOPPED: { label: 'Đã dừng', color: 'bg-gray-100 text-gray-700' },
  DRAFT: { label: 'Nháp', color: 'bg-gray-100 text-gray-700' },
  SENT: { label: 'Đã gửi', color: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Đã duyệt', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Từ chối', color: 'bg-red-100 text-red-700' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-700' },
  SUBMITTED: { label: 'Đã nộp', color: 'bg-blue-100 text-blue-700' },
  EXPIRED: { label: 'Hết hạn', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-gray-100 text-gray-700' },
};

export const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  LEADER: 'Trưởng nhóm',
  EMPLOYEE: 'Nhân viên',
  ACCOUNTANT: 'Kế toán',
  SALES: 'Sales',
};
