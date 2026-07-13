'use client';

import { useMemo } from 'react';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import { InputAdornment, LinearProgress, MenuItem, TextField } from '@mui/material';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { getPermissionModuleLabel, getPermissionModules } from '@/lib/access-control-utils';
import { formatDate } from '@/lib/utils';
import type { Permission, PermissionFilters } from '@/types/access-control';

type PermissionListProps = {
  permissions: Permission[];
  moduleOptions: Permission[];
  filters: PermissionFilters;
  isFetching: boolean;
  onFiltersChange: (filters: PermissionFilters) => void;
};

export function PermissionList({
  permissions,
  moduleOptions,
  filters,
  isFetching,
  onFiltersChange,
}: PermissionListProps) {
  const modules = useMemo(() => getPermissionModules(moduleOptions), [moduleOptions]);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(permissions, {
    resetKey: filters,
  });

  const updateFilters = (nextFilters: Partial<PermissionFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Phân quyền</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Nhân viên</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Phân quyền</span>
        </div>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã quyền, tên quyền hoặc mô tả..."
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

          <TextField
            select
            label="Module"
            value={filters.module}
            onChange={(event) => updateFilters({ module: event.target.value })}
            className="lg:w-[260px]"
          >
            <MenuItem value="">Tất cả</MenuItem>
            {modules.map((module) => (
              <MenuItem key={module} value={module}>
                {getPermissionModuleLabel(module)}
              </MenuItem>
            ))}
          </TextField>
        </div>

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
                <th className="w-72 px-5 py-4">Quyền</th>
                <th className="w-44 px-3 py-4">Module</th>
                <th className="w-72 px-3 py-4">Mã quyền</th>
                <th className="w-96 px-3 py-4">Mô tả</th>
                <th className="w-32 px-3 py-4">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                pageItems.map((permission) => (
                  <tr key={permission.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <SecurityRoundedIcon className="text-[20px]" />
                        </span>
                        <p className="truncate font-semibold text-slate-950" title={permission.name}>
                          {permission.name || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
                        {getPermissionModuleLabel(permission.module)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <code className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {permission.code || '-'}
                      </code>
                    </td>
                    <td className="px-3 py-4">
                      <p className="line-clamp-2 text-slate-600" title={permission.description || ''}>
                        {permission.description || '-'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {formatDate(permission.createdAt || '')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          Backend hiện chỉ hỗ trợ xem danh sách quyền.
        </div>

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
