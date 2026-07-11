'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Checkbox, IconButton, InputAdornment, LinearProgress, Menu, MenuItem, TextField } from '@mui/material';
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

export function RoleList({
  roles,
  filters,
  isFetching,
  onFiltersChange,
  onDelete,
  onBulkDelete,
  isDeleting = false,
}: RoleListProps) {
  const router = useRouter();
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  const visibleRoleIds = useMemo(() => roles.map((role) => role.id), [roles]);
  const selectedVisibleCount = visibleRoleIds.filter((id) => selectedRoleIds.includes(id)).length;
  const hasSelectedRows = selectedRoleIds.length > 0;
  const isAllVisibleSelected =
    visibleRoleIds.length > 0 && selectedVisibleCount === visibleRoleIds.length;
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

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, role: Role) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveRole(role);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveRole(null);
  };

  const goToEditRole = () => {
    if (!activeRole) return;
    router.push(`/users/roles/${activeRole.id}`);
    closeActionMenu();
  };

  const deleteActiveRole = () => {
    if (!activeRole) return;
    onDelete(activeRole);
    setSelectedRoleIds((current) => current.filter((id) => id !== activeRole.id));
    closeActionMenu();
  };

  const deleteSelectedRoles = () => {
    if (selectedRoleIds.length === 0) return;
    onBulkDelete(selectedRoleIds);
    setSelectedRoleIds([]);
  };

  const updateFilters = (nextFilters: Partial<RoleFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
    setSelectedRoleIds([]);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Vai trò</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Nhân viên</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Vai trò</span>
          </div>
        </div>

        <Link
          href="/users/roles/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <AddRoundedIcon className="text-lg" />
          Thêm vai trò
        </Link>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm tên vai trò hoặc mô tả..."
            value={filters.keyword}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
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
              onClick={deleteSelectedRoles}
              title="Xóa vai trò đã chọn"
            >
              <DeleteRoundedIcon fontSize="small" />
            </IconButton>
          </div>
        )}

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[980px] table-fixed text-left text-sm transition-opacity ${
              isFetching ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 z-20 w-12 bg-slate-50 px-5 py-4">
                  <Checkbox
                    color="success"
                    size="small"
                    checked={isAllVisibleSelected}
                    indeterminate={isSomeVisibleSelected}
                    onChange={(event) => toggleAllVisibleRows(event.target.checked)}
                  />
                </th>
                <th className="sticky left-12 z-20 w-72 bg-slate-50 px-3 py-4">Vai trò</th>
                <th className="w-96 px-3 py-4">Mô tả</th>
                <th className="w-32 px-3 py-4">Số quyền</th>
                <th className="w-32 px-3 py-4">Ngày tạo</th>
                <th className="w-24 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const isSelected = selectedRoleIds.includes(role.id);

                  return (
                    <tr
                      key={role.id}
                      className={`group ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-5 py-3 ${
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
                        <p className="truncate font-semibold text-slate-950" title={role.name}>
                          {role.name || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="line-clamp-2 text-slate-600" title={role.description || ''}>
                          {role.description || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
                          {role.permissions?.length || 0} quyền
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-700">{formatDate(role.createdAt || '')}</td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1 pr-3">
                          <IconButton
                            component={Link}
                            href={`/users/roles/${role.id}`}
                            size="small"
                            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Chỉnh sửa vai trò"
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Tác vụ"
                            onClick={(event) => openActionMenu(event, role)}
                          >
                            <MoreVertRoundedIcon fontSize="small" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={goToEditRole}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveRole} className="text-rose-600" disabled={isDeleting}>
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị <strong className="text-slate-950">{roles.length}</strong> / {roles.length} vai trò
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg px-3 py-2 font-semibold text-slate-400">
              Trước
            </button>
            <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">
              1
            </button>
            <button type="button" className="rounded-lg px-3 py-2 font-semibold text-slate-400">
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
