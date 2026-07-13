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
import {
  Avatar,
  Checkbox,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { formatDate } from '@/lib/utils';
import {
  USER_ALL_FILTER,
  getUserRoleClass,
  getUserRoleLabel,
  getUserStatusClass,
  getUserStatusLabel,
} from '@/lib/user-utils';
import { getMediaPreviewUrl } from '@/lib/media-url';
import type { RoleOption, User, UserFilters } from '@/types/user';

type UserListProps = {
  users: User[];
  roles: RoleOption[];
  filters: UserFilters;
  isFetching: boolean;
  onFiltersChange: (filters: UserFilters) => void;
  onDelete: (user: User) => void;
  onBulkDelete: (userIds: number[]) => void;
  isDeleting?: boolean;
};

function getUserInitial(user: User) {
  const source = user.name || user.email || user.code || 'X';
  return source.trim().charAt(0).toUpperCase();
}

export function UserList({
  users,
  roles,
  filters,
  isFetching,
  onFiltersChange,
  onDelete,
  onBulkDelete,
  isDeleting = false,
}: UserListProps) {
  const router = useRouter();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(users, {
    resetKey: filters,
  });

  const visibleUserIds = useMemo(() => users.map((user) => user.id), [users]);
  const selectedVisibleCount = visibleUserIds.filter((id) => selectedUserIds.includes(id)).length;
  const hasSelectedRows = selectedUserIds.length > 0;
  const isAllVisibleSelected =
    visibleUserIds.length > 0 && selectedVisibleCount === visibleUserIds.length;
  const isSomeVisibleSelected = selectedVisibleCount > 0 && !isAllVisibleSelected;

  const toggleAllVisibleRows = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds((current) => Array.from(new Set([...current, ...visibleUserIds])));
      return;
    }

    setSelectedUserIds((current) => current.filter((id) => !visibleUserIds.includes(id)));
  };

  const toggleUserRow = (userId: number, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) return Array.from(new Set([...current, userId]));
      return current.filter((id) => id !== userId);
    });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, user: User) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveUser(user);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveUser(null);
  };

  const goToEditUser = () => {
    if (!activeUser) return;
    router.push(`/users/${activeUser.id}`);
    closeActionMenu();
  };

  const deleteActiveUser = () => {
    if (!activeUser) return;
    onDelete(activeUser);
    setSelectedUserIds((current) => current.filter((id) => id !== activeUser.id));
    closeActionMenu();
  };

  const deleteSelectedUsers = () => {
    if (selectedUserIds.length === 0) return;
    onBulkDelete(selectedUserIds);
    setSelectedUserIds([]);
  };

  const updateFilters = (nextFilters: Partial<UserFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
    setSelectedUserIds([]);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Nhân viên</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Nhân viên</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Danh sách</span>
          </div>
        </div>

        <Link
          href="/users/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <AddRoundedIcon className="text-lg" />
          Thêm nhân viên
        </Link>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã, tên, email, số điện thoại..."
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

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <TextField
              select
              label="Vai trò"
              value={filters.role_id}
              onChange={(event) => updateFilters({ role_id: event.target.value })}
            >
              <MenuItem value="">{USER_ALL_FILTER}</MenuItem>
              {roles.map((item) => (
                <MenuItem key={item.id} value={String(item.id)}>
                  {getUserRoleLabel(item.name)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Trạng thái"
              value={filters.is_active}
              onChange={(event) => updateFilters({ is_active: event.target.value })}
            >
              <MenuItem value="">{USER_ALL_FILTER}</MenuItem>
              <MenuItem value="true">Hoạt động</MenuItem>
              <MenuItem value="false">Vô hiệu</MenuItem>
            </TextField>
          </div>

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
              <span>{selectedUserIds.length} selected</span>
            </div>
            <IconButton
              size="small"
              color="success"
              disabled={isDeleting}
              onClick={deleteSelectedUsers}
              title="Xóa nhân viên đã chọn"
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
            className={`w-full min-w-[1160px] table-fixed text-left text-sm transition-opacity ${
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
                <th className="sticky left-12 z-20 w-28 bg-slate-50 px-3 py-4">Mã NV</th>
                <th className="w-56 px-3 py-4">Tên nhân viên</th>
                <th className="w-64 px-3 py-4">Email</th>
                <th className="w-36 px-3 py-4">Số điện thoại</th>
                <th className="w-36 px-3 py-4">Vai trò</th>
                <th className="w-32 px-3 py-4">Trạng thái</th>
                <th className="w-32 px-3 py-4">Ngày tạo</th>
                <th className="w-32 px-3 py-4">Cập nhật</th>
                <th className="w-24 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                pageItems.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);

                  return (
                    <tr
                      key={user.id}
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
                          onChange={(event) => toggleUserRow(user.id, event.target.checked)}
                        />
                      </td>
                      <td
                        className={`sticky left-12 z-10 px-3 py-3 ${
                          isSelected ? 'bg-emerald-50/60' : 'bg-white group-hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-slate-950">{user.code || '-'}</span>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            src={getMediaPreviewUrl(user.avatar) || undefined}
                            alt={user.name || user.email || user.code}
                            className="h-9 w-9 shrink-0 bg-primary/10 text-sm font-bold text-primary"
                          >
                            {getUserInitial(user)}
                          </Avatar>
                          <p className="truncate font-semibold text-slate-950" title={user.name}>
                            {user.name || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <p className="truncate text-slate-600" title={user.email}>
                          {user.email || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-slate-700">{user.phone || '-'}</td>
                      <td className="px-3 py-4">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${getUserRoleClass(user.role)}`}>
                          {getUserRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass(user)}`}>
                          {getUserStatusLabel(user)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-700">{formatDate(user.createdAt || '')}</td>
                      <td className="px-3 py-4 text-slate-500">{formatDate(user.updatedAt || '')}</td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1 pr-3">
                          <IconButton
                            component={Link}
                            href={`/users/${user.id}`}
                            size="small"
                            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Chỉnh sửa nhân viên"
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            className="text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Tác vụ"
                            onClick={(event) => openActionMenu(event, user)}
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
          <MenuItem onClick={goToEditUser}>
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveUser} className="text-rose-600" disabled={isDeleting}>
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
