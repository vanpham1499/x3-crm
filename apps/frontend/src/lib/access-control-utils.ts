import type { Permission } from '@/types/access-control';

export const PERMISSION_MODULE_MENU_ORDER = [
  'dashboard',
  'lead',
  'customer',
  'project',
  'meeting',
  'quotation',
  'payment',
  'cost',
  'weeklyreport',
  'kpi',
  'p2point',
  'media',
  'user',
  'department',
  'role',
  'permission',
  'service',
  'partner',
  'bankaccount',
  'adtopupcard',
  'p2category',
  'option',
  'lookup',
] as const;

const permissionModuleMenuIndex = new Map<string, number>(
  PERMISSION_MODULE_MENU_ORDER.map((module, index) => [module, index]),
);

export function comparePermissionModules(left: string, right: string) {
  const leftIndex = permissionModuleMenuIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = permissionModuleMenuIndex.get(right) ?? Number.MAX_SAFE_INTEGER;

  if (leftIndex !== rightIndex) return leftIndex - rightIndex;

  return getPermissionModuleLabel(left).localeCompare(getPermissionModuleLabel(right), 'vi');
}

export function getRoleInitial(name: string) {
  return (name || 'R').trim().charAt(0).toUpperCase();
}

export function getPermissionModuleLabel(module: string) {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    user: 'Tài khoản',
    department: 'Phòng ban',
    role: 'Vai trò',
    permission: 'Danh mục quyền',
    lead: 'Lead',
    customer: 'Khách hàng',
    project: 'Dự án',
    meeting: 'Lịch hẹn',
    quotation: 'Báo phí',
    payment: 'Thanh toán',
    cost: 'Chi phí',
    weeklyreport: 'Báo cáo tuần',
    p2point: 'Điểm P2',
    kpi: 'KPI',
    media: 'Thư viện',
    service: 'Cài đặt · Dịch vụ',
    partner: 'Cài đặt · Đối tác',
    bankaccount: 'Cài đặt · Ngân hàng',
    adtopupcard: 'Cài đặt · Thẻ nạp quảng cáo',
    p2category: 'Cài đặt · Hạng mục P2',
    option: 'Cài đặt · Danh mục chung',
    lookup: 'Dữ liệu dùng trong biểu mẫu',
  };

  return labels[module] || module || '-';
}

export const PAGE_PERMISSION_BY_MODULE: Record<string, string> = {
  dashboard: 'dashboard.view',
  lead: 'lead.view',
  customer: 'customer.view',
  project: 'project.view',
  meeting: 'meeting.view',
  quotation: 'quotation.view',
  payment: 'payment.view',
  cost: 'cost.view',
  weeklyreport: 'weeklyreport.view',
  kpi: 'kpi.view',
  p2point: 'p2point.view',
  media: 'media.view',
  user: 'user.view',
  department: 'department.view',
  role: 'role.view',
  permission: 'permission.view',
  service: 'service.view',
  partner: 'partner.view',
  bankaccount: 'bankaccount.view',
  adtopupcard: 'adtopupcard.view',
  p2category: 'p2category.view',
  option: 'option.view',
};

export function getPagePermissionCode(module: string) {
  return PAGE_PERMISSION_BY_MODULE[module];
}

export function getPermissionModules(permissions: Permission[]) {
  return Array.from(
    new Set(permissions.map((permission) => permission.module).filter(Boolean)),
  ).sort(comparePermissionModules);
}

export function groupPermissionsByModule(permissions: Permission[]) {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const module = permission.module || 'other';
    groups[module] = groups[module] || [];
    groups[module].push(permission);
    return groups;
  }, {});
}
