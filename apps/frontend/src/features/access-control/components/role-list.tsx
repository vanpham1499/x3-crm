'use client';

import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Checkbox, IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { getPermissionModuleLabel, groupPermissionsByModule } from '@/lib/access-control-utils';
import { formatDate } from '@/lib/utils';
import type { Role, RoleFilters } from '@/types/access-control';

type RoleListProps = {
  roles: Role[];
  filters: RoleFilters;
  isFetching: boolean;
  onFiltersChange: (filters: RoleFilters) => void;
  onDelete: (role: Role) => void;
  onBulkDelete: (roleIds: number[]) => void;
  isDeleting?: boolean;
};

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px,minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '-'}</dd>
    </div>
  );
}

function RoleDetailDialog({ role, onClose }: { role: Role | null; onClose: () => void }) {
  if (!role) return null;

  const groups = groupPermissionsByModule(role.permissions || []);

  return (
    <AppDetailDialog
      open
      title={role.name || 'Vai trò'}
      eyebrow={`Vai trò #${role.id}`}
      subtitle={`${role.permissions?.length || 0} quyền được gán`}
      onClose={onClose}
      actions={
        <DialogActionButton
          href={`/users/roles/${role.id}`}
          tone="primary"
          startIcon={<EditRoundedIcon />}
        >
          Chỉnh sửa
        </DialogActionButton>
      }
    >
      <div className="bg-slate-50/60 p-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <dl>
            <DetailRow label="Mô tả" value={role.description} />
            <DetailRow label="Ngày tạo" value={formatDate(role.createdAt || '')} />
            <DetailRow label="Cập nhật" value={formatDate(role.updatedAt || '')} />
          </dl>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-bold text-slate-950">Danh sách quyền</p>
            {Object.keys(groups).length > 0 ? (
              <div className="mt-3 space-y-3">
                {Object.entries(groups).map(([module, permissions]) => (
                  <div key={module} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {getPermissionModuleLabel(module)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {permissions.map((permission) => (
                        <span
                          key={permission.id}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                        >
                          {permission.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Vai trò chưa được gán quyền.</p>
            )}
          </div>
        </section>
      </div>
    </AppDetailDialog>
  );
}

export function RoleList({
  roles,
  filters,
  isFetching,
  onFiltersChange,
  onDelete,
  onBulkDelete,
  isDeleting = false,
}: RoleListProps) {
  const [viewTarget, setViewTarget] = useState<Role | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(roles, {
    resetKey: filters,
  });

  const visibleRoleIds = useMemo(() => pageItems.map((role) => role.id), [pageItems]);
  const selectedVisibleCount = visibleRoleIds.filter((id) => selectedRoleIds.includes(id)).length;
  const hasSelectedRows = selectedRoleIds.length > 0;
  const isAllVisibleSelected = visibleRoleIds.length > 0 && selectedVisibleCount === visibleRoleIds.length;
  const isSomeVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected;

  const toggleAllVisibleRows = (checked: boolean) => {
    if (checked) {
      setSelectedRoleIds((current) => Array.from(new Set([...current, ...visibleRoleIds])));
      return;
    }

    setSelectedRoleIds((current) => current.filter((id) => !visibleRoleIds.includes(id)));
  };

  const toggleRoleRow = (roleId: number, checked: boolean) => {
    setSelectedRoleIds((current) => {
      if (checked) return Array.from(new Set([...current, roleId]));
      return current.filter((id) => id !== roleId);
    });
  };

  const updateFilters = (nextFilters: Partial<RoleFilters>) => {
    setSelectedRoleIds([]);
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, role: Role) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveRole(role);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveRole(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Vai trò"
        action={{ label: 'Thêm vai trò', href: '/users/roles/new', icon: <AddRoundedIcon /> }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm tên vai trò hoặc mô tả..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
        </div>

        {hasSelectedRows && (
          <div className="flex h-14 items-center justify-between bg-emerald-100 px-5 text-sm font-bold text-emerald-700">
            <div className="flex items-center gap-4">
              <Checkbox
                color="success"
                size="small"
                checked
                onChange={(event) => toggleAllVisibleRows(event.target.checked)}
              />
              <span>{selectedRoleIds.length} đã chọn</span>
            </div>
            <IconButton
              size="small"
              color="success"
              disabled={isDeleting}
              onClick={() => {
                onBulkDelete(selectedRoleIds);
                setSelectedRoleIds([]);
              }}
              title="Xóa các vai trò đã chọn"
            >
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </div>
        )}

        <AppDataTable
          columns={[
            { key: 'select', className: 'sticky left-0 z-20 w-12 bg-slate-100' },
            {
              key: 'role',
              label: 'Vai trò',
              className: 'sticky left-12 z-20 w-64 bg-slate-100',
            },
            { key: 'description', label: 'Mô tả', className: 'w-96' },
            { key: 'permissions', label: 'Số quyền', className: 'w-32' },
            { key: 'created', label: 'Ngày tạo', className: 'w-36' },
            { key: 'updated', label: 'Cập nhật', className: 'w-36' },
            { key: 'actions', className: 'w-32' },
          ]}
          isLoading={isFetching}
          isEmpty={roles.length === 0}
          emptyText="Không có dữ liệu vai trò"
          minWidthClassName="min-w-[1120px]"
        >
          {pageItems.map((role) => {
            const isSelected = selectedRoleIds.includes(role.id);

            return (
              <tr
                key={role.id}
                className={`group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
              >
                <td
                  className={`sticky left-0 z-10 px-3 py-4 ${
                    isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    color="success"
                    size="small"
                    checked={isSelected}
                    onChange={(event) => toggleRoleRow(role.id, event.target.checked)}
                  />
                </td>
                <td
                  className={`sticky left-12 z-10 px-3 py-4 ${
                    isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SecurityRoundedIcon className="!text-[19px]" />
                    </span>
                    <p className="truncate font-bold text-slate-950" title={role.name || ''}>
                      {role.name || '-'}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <p className="line-clamp-2 text-slate-600" title={role.description || ''}>
                    {role.description || '-'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <span className="inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
                    {role.permissions?.length || 0} quyền
                  </span>
                </td>
                <td className="px-3 py-4 text-slate-700">{formatDate(role.createdAt || '')}</td>
                <td className="px-3 py-4 text-slate-500">{formatDate(role.updatedAt || '')}</td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      aria-label="Xem chi tiết vai trò"
                      title="Xem chi tiết vai trò"
                      onClick={() => setViewTarget(role)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      component={Link}
                      href={`/users/roles/${role.id}`}
                      size="small"
                      aria-label="Chỉnh sửa vai trò"
                      title="Chỉnh sửa vai trò"
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Mở tác vụ vai trò"
                      title="Tác vụ"
                      onClick={(event) => openActionMenu(event, role)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setViewTarget(activeRole);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        <MenuItem
          component={Link}
          href={activeRole ? `/users/roles/${activeRole.id}` : '/users/roles'}
          onClick={closeActionMenu}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting}
          onClick={() => {
            if (activeRole) onDelete(activeRole);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <RoleDetailDialog role={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
