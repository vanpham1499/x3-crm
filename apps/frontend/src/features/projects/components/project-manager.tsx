'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  TextField,
} from '@mui/material';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import {
  formatProjectDate,
  getProjectExternalUrl,
  getProjectStatusColor,
  getRootServiceItem,
} from '@/lib/project-utils';
import {
  getConfigForRoot,
  getProjectRevenueGroupInfo,
  getServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFilters, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type ProjectManagerProps = {
  projects: ProjectItem[];
  customers: Customer[];
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  quoteConfigs: AppOption[];
  filters: ProjectFilters;
  isFetching: boolean;
  isDeleting: boolean;
  onFiltersChange: (filters: ProjectFilters) => void;
  onDelete: (project: ProjectItem) => void;
};

function customerLabel(customer: Customer) {
  return [customer.customerCode, customer.customerName || customer.companyName]
    .filter(Boolean)
    .join(' - ');
}

function userLabel(user?: User | null) {
  if (!user) return '-';
  return [user.code, user.name].filter(Boolean).join(' - ');
}

function projectStatusClass(project: ProjectItem) {
  return project.statusOption ? 'text-white' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

export function ProjectManager({
  projects,
  customers,
  services,
  users,
  statuses,
  quoteConfigs,
  filters,
  isFetching,
  isDeleting,
  onFiltersChange,
  onDelete,
}: ProjectManagerProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const serviceOptions = useMemo(() => flattenServices(services), [services]);

  const updateFilters = (nextFilters: Partial<ProjectFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const getRevenueGroup = (project: ProjectItem) => {
    const rootService = getRootServiceItem(services, String(project.serviceId));
    const configOption = getConfigForRoot(quoteConfigs, rootService);
    const config = configOption ? getServiceQuoteConfigMeta(configOption, rootService) : null;

    return getProjectRevenueGroupInfo(Boolean(config?.enabled));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Dự án</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Dự án</span>
          </div>
        </div>

        <Button
          component={Link}
          href="/projects/new"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm dự án
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2 xl:grid-cols-6">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã, tên dự án, ghi chú..."
            value={filters.keyword}
            onChange={(event) => updateFilters({ keyword: event.target.value })}
            className="xl:col-span-2"
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
            label="Trạng thái"
            value={filters.status_option_id}
            onChange={(event) => updateFilters({ status_option_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {statuses.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                {status.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Khách hàng"
            value={filters.customer_id}
            onChange={(event) => updateFilters({ customer_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {customers.map((customer) => (
              <MenuItem key={customer.id} value={customer.id}>
                {customerLabel(customer)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Dịch vụ"
            value={filters.service_id}
            onChange={(event) => updateFilters({ service_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {serviceOptions.map((service) => (
              <MenuItem key={service.id} value={service.id}>
                {'- '.repeat(service.depth)}
                {service.code} - {service.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Người quản lý"
            value={filters.manager_user_id}
            onChange={(event) => updateFilters({ manager_user_id: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {userLabel(user)}
              </MenuItem>
            ))}
          </TextField>
        </div>

        <div className="relative overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-20">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1380px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-[320px] px-5 py-4">Mã dự án</th>
                <th className="w-[240px] px-3 py-4">Khách hàng</th>
                <th className="w-[220px] px-3 py-4">Dịch vụ</th>
                <th className="w-[190px] px-3 py-4">Nhóm doanh thu</th>
                <th className="w-40 px-3 py-4">Trạng thái</th>
                <th className="w-[180px] px-3 py-4">Người quản lý</th>
                <th className="w-[180px] px-3 py-4">Sales</th>
                <th className="w-32 px-3 py-4">Bắt đầu</th>
                <th className="w-32 px-3 py-4">Kết thúc</th>
                <th className="w-28 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Chưa có dự án nào
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const revenueGroup = getRevenueGroup(project);
                  const isManagementFee = revenueGroup.group === '2.1';

                  return (
                    <tr key={project.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          <p
                            className="truncate font-bold text-blue-700"
                            title={project.projectCode || project.projectName}
                          >
                            {project.projectCode || '-'}
                          </p>
                          <p
                            className="mt-1 truncate text-xs text-slate-500"
                            title={project.projectName}
                          >
                            {project.projectName}
                          </p>
                          {project.planLink ? (
                            <a
                              href={getProjectExternalUrl(project.planLink)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              <LinkRoundedIcon fontSize="inherit" />
                              <span className="truncate">Plan</span>
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="truncate font-semibold text-slate-800"
                          title={
                            project.customer?.customerName || project.customer?.companyName || ''
                          }
                        >
                          {project.customer?.customerName || project.customer?.companyName || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="truncate text-slate-700" title={project.service?.name || ''}>
                          {project.service?.code ? `${project.service.code} - ` : ''}
                          {project.service?.name || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                            isManagementFee
                              ? 'bg-sky-50 text-sky-800 ring-sky-200'
                              : 'bg-amber-50 text-amber-800 ring-amber-200'
                          }`}
                          title={revenueGroup.description}
                        >
                          {revenueGroup.title}
                        </span>
                        <p className="mt-1.5 text-xs leading-4 text-slate-500">
                          {isManagementFee ? 'Theo ngân sách' : 'SL × đơn giá'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${projectStatusClass(project)}`}
                          style={
                            project.statusOption
                              ? { backgroundColor: getProjectStatusColor(project) }
                              : undefined
                          }
                        >
                          {project.statusOption?.label || 'Chưa chọn'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="truncate text-slate-700"
                          title={project.managerUser?.name || ''}
                        >
                          {project.managerUser?.name || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p
                          className="truncate text-slate-700"
                          title={project.salesUser?.name || ''}
                        >
                          {project.salesUser?.name || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {formatProjectDate(project.startDate)}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {formatProjectDate(project.endDate)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            component={Link}
                            href={`/projects/${project.id}`}
                            size="small"
                            title="Chỉnh sửa"
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Xóa"
                            className="hover:text-rose-600"
                            onClick={() => setDeleteTarget(project)}
                          >
                            <DeleteRoundedIcon fontSize="small" />
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
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa dự án?"
        description={`Bạn có chắc muốn xóa dự án "${deleteTarget?.projectName || deleteTarget?.projectCode || ''}"?`}
        confirmText="Xóa dự án"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
