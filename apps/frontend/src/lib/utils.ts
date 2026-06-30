export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

export function formatDate(date: string | Date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(date),
  );
}

export const STATUS_LABELS = {
  ACTIVE: { label: 'Đang chạy', color: 'success' },
  PAUSED: { label: 'Dừng chạy', color: 'error' },
  PENDING: { label: 'Đang chờ', color: 'warning' },
  STOPPED: { label: 'Đã dừng', color: 'default' },
  DRAFT: { label: 'Nháp', color: 'default' },
  SENT: { label: 'Đã gửi', color: 'primary' },
  APPROVED: { label: 'Đã duyệt', color: 'success' },
  REJECTED: { label: 'Từ chối', color: 'error' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'success' },
  SUBMITTED: { label: 'Đã nộp', color: 'primary' },
  EXPIRED: { label: 'Hết hạn', color: 'error' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
};

export const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  LEADER: 'Trưởng nhóm',
  EMPLOYEE: 'Nhân viên',
  ACCOUNTANT: 'Kế toán',
  SALES: 'Sales',
};
