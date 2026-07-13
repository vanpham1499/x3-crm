'use client';

import { useMemo } from 'react';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
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
      <PageHeader title="Phân quyền" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_220px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã quyền, tên quyền hoặc mô tả..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
          <CompactSelectField
            label="Module"
            value={filters.module}
            options={modules.map((module) => ({
              value: module,
              label: getPermissionModuleLabel(module),
            }))}
            onChange={(module) => updateFilters({ module })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'permission',
              label: 'Quyền',
              className: 'sticky left-0 z-20 w-72 bg-slate-100',
            },
            { key: 'module', label: 'Module', className: 'w-44' },
            { key: 'code', label: 'Mã quyền', className: 'w-72' },
            { key: 'description', label: 'Mô tả', className: 'w-96' },
            { key: 'created', label: 'Ngày tạo', className: 'w-36' },
          ]}
          isLoading={isFetching}
          isEmpty={permissions.length === 0}
          emptyText="Không có dữ liệu phân quyền"
          minWidthClassName="min-w-[1180px]"
        >
          {pageItems.map((permission) => (
            <tr key={permission.id} className="group hover:bg-slate-50/80">
              <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <SecurityRoundedIcon className="!text-[19px]" />
                  </span>
                  <p
                    className="truncate font-semibold text-slate-950"
                    title={permission.name || ''}
                  >
                    {permission.name || '-'}
                  </p>
                </div>
              </td>
              <td className="px-3 py-4">
                <span className="inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
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
              <td className="px-3 py-4 text-slate-700">{formatDate(permission.createdAt || '')}</td>
            </tr>
          ))}
        </AppDataTable>

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
