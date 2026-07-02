import type { Permission } from '@/types/access-control';

export function getRoleInitial(name: string) {
  return (name || 'R').trim().charAt(0).toUpperCase();
}

export function getPermissionModuleLabel(module: string) {
  const labels: Record<string, string> = {
    users: 'Nhân viên',
    roles: 'Vai trò',
    permissions: 'Phân quyền',
    customers: 'Khách hàng',
    leads: 'Lead',
    projects: 'Dự án',
    contracts: 'Hợp đồng',
    invoices: 'Hóa đơn',
    reports: 'Báo cáo',
  };

  return labels[module] || module || '-';
}

export function getPermissionModules(permissions: Permission[]) {
  return Array.from(new Set(permissions.map((permission) => permission.module).filter(Boolean))).sort();
}

export function groupPermissionsByModule(permissions: Permission[]) {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const module = permission.module || 'other';
    groups[module] = groups[module] || [];
    groups[module].push(permission);
    return groups;
  }, {});
}
