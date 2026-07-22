'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Avatar, IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { getMediaPreviewUrl } from '@/lib/media-url';
import { canCreateUsers, canDeleteUsers, canEditUsers } from '@/lib/ownership';
import { formatDate } from '@/lib/utils';
import {
  getUserRoleClass,
  getUserRoleLabel,
  getUserStatusClass,
  getUserStatusLabel,
} from '@/lib/user-utils';
import type { RoleOption, User, UserFilters } from '@/types/user';

type UserListProps = {
  users: User[];
  roles: RoleOption[];
  filters: UserFilters;
  isFetching: boolean;
  currentUser: User | null;
  onFiltersChange: (filters: UserFilters) => void;
  onDelete: (user: User) => void;
  isDeleting?: boolean;
};

function getUserInitial(user: User) {
  return (user.name || user.email || user.code || 'X').trim().charAt(0).toUpperCase();
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-[128px,minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '-'}</dd>
    </div>
  );
}

function UserDetailDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  if (!user) return null;

  return (
    <AppDetailDialog
      open
      title={user.name || user.email || user.code || 'Nhân viên'}
      eyebrow={user.code || `User #${user.id}`}
      subtitle={user.email}
      onClose={onClose}
      actions={
        <DialogActionButton
          href={`/users/${user.id}`}
          tone="primary"
          startIcon={<EditRoundedIcon />}
        >
          Chỉnh sửa
        </DialogActionButton>
      }
    >
      <div className="bg-slate-50/60 p-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-5">
            <Avatar
              src={getMediaPreviewUrl(user.avatar) || undefined}
              alt={user.name || user.email || user.code}
              className="!h-12 !w-12 !bg-primary/10 !font-bold !text-primary"
            >
              {getUserInitial(user)}
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-950">{user.name || '-'}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{user.email || '-'}</p>
            </div>
          </div>

          <dl>
            <DetailRow label="Mã nhân viên" value={user.code} />
            <DetailRow label="Số điện thoại" value={user.phone} />
            <DetailRow
              label="Vai trò"
              value={
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserRoleClass(user.role)}`}
                >
                  {getUserRoleLabel(user.role)}
                </span>
              }
            />
            <DetailRow
              label="Trạng thái"
              value={
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass(user)}`}
                >
                  {getUserStatusLabel(user)}
                </span>
              }
            />
            <DetailRow label="Ngày tạo" value={formatDate(user.createdAt || '')} />
            <DetailRow label="Cập nhật" value={formatDate(user.updatedAt || '')} />
          </dl>
        </section>
      </div>
    </AppDetailDialog>
  );
}

export function UserList({
  users,
  roles,
  filters,
  isFetching,
  currentUser,
  onFiltersChange,
  onDelete,
  isDeleting = false,
}: UserListProps) {
  const canCreate = canCreateUsers(currentUser);
  const canEdit = canEditUsers(currentUser);
  const canDelete = canDeleteUsers(currentUser);
  const [viewTarget, setViewTarget] = useState<User | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(users, {
    resetKey: filters,
  });

  const updateFilters = (nextFilters: Partial<UserFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, user: User) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveUser(user);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveUser(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Nhân viên"
        action={{
          label: 'Thêm nhân viên',
          href: '/users/new',
          icon: <AddRoundedIcon />,
          disabled: !canCreate,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_176px_176px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã, tên, email, số điện thoại..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
          <CompactSelectField
            label="Vai trò"
            value={filters.role_id}
            options={roles.map((role) => ({
              value: String(role.id),
              label: getUserRoleLabel(role.name),
            }))}
            onChange={(role_id) => updateFilters({ role_id })}
          />
          <CompactSelectField
            label="Trạng thái"
            value={filters.is_active}
            options={[
              { value: 'true', label: 'Hoạt động' },
              { value: 'false', label: 'Vô hiệu' },
            ]}
            onChange={(is_active) => updateFilters({ is_active })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'code',
              label: 'Mã NV',
              className: 'sticky left-0 z-20 w-32 bg-slate-100',
            },
            { key: 'user', label: 'Nhân viên', className: 'w-64' },
            { key: 'contact', label: 'Liên hệ', className: 'w-64' },
            { key: 'role', label: 'Vai trò', className: 'w-40' },
            { key: 'status', label: 'Trạng thái', className: 'w-36' },
            { key: 'created', label: 'Ngày tạo', className: 'w-36' },
            { key: 'updated', label: 'Cập nhật', className: 'w-36' },
            { key: 'actions', className: 'w-32' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Không có dữ liệu nhân viên"
          minWidthClassName="min-w-[1310px]"
        >
          {pageItems.map((user) => (
            <tr key={user.id} className="group hover:bg-slate-50/80">
              <td className="sticky left-0 z-10 bg-white px-3 py-4 font-bold text-slate-900 group-hover:bg-slate-50">
                <span className="block truncate" title={user.code || ''}>
                  {user.code || '-'}
                </span>
              </td>
              <td className="px-3 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={getMediaPreviewUrl(user.avatar) || undefined}
                    alt={user.name || user.email || user.code}
                    className="!h-9 !w-9 !shrink-0 !bg-primary/10 !text-sm !font-bold !text-primary"
                  >
                    {getUserInitial(user)}
                  </Avatar>
                  <p className="truncate font-semibold text-slate-950" title={user.name || ''}>
                    {user.name || '-'}
                  </p>
                </div>
              </td>
              <td className="px-3 py-4">
                <p className="truncate font-medium text-slate-700" title={user.email || ''}>
                  {user.email || '-'}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">{user.phone || '-'}</p>
              </td>
              <td className="px-3 py-4">
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserRoleClass(user.role)}`}
                >
                  {getUserRoleLabel(user.role)}
                </span>
              </td>
              <td className="px-3 py-4">
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass(user)}`}
                >
                  {getUserStatusLabel(user)}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">{formatDate(user.createdAt || '')}</td>
              <td className="px-3 py-4 text-slate-500">{formatDate(user.updatedAt || '')}</td>
              <td className="py-4">
                <div className="flex items-center justify-end gap-1 pr-3">
                  <IconButton
                    size="small"
                    aria-label="Xem chi tiết nhân viên"
                    title="Xem chi tiết nhân viên"
                    onClick={() => setViewTarget(user)}
                  >
                    <VisibilityRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    component={Link}
                    href={`/users/${user.id}`}
                    size="small"
                    aria-label="Chỉnh sửa nhân viên"
                    title="Chỉnh sửa nhân viên"
                    disabled={!canEdit}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Mở tác vụ nhân viên"
                    title="Tác vụ"
                    onClick={(event) => openActionMenu(event, user)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
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
            setViewTarget(activeUser);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        <MenuItem
          component={Link}
          href={activeUser ? `/users/${activeUser.id}` : '/users'}
          onClick={closeActionMenu}
          disabled={!canEdit}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting || !canDelete}
          onClick={() => {
            if (activeUser) onDelete(activeUser);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <UserDetailDialog user={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
