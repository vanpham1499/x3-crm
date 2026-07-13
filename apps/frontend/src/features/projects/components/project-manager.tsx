'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
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
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(projects, {
    resetKey: filters,
  });

  const updateFilters = (nextFilters: Partial<ProjectFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const getRevenueGroup = (project: ProjectItem) => {
    const rootService = getRootServiceItem(services, String(project.serviceId));
    const configOption = getConfigForRoot(quoteConfigs, rootService);
    const config = configOption ? getServiceQuoteConfigMeta(configOption, rootService) : null;

    return getProjectRevenueGroupInfo(Boolean(config?.enabled));
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, project: ProjectItem) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveProject(project);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveProject(null);
  };

  const deleteActiveProject = () => {
    if (activeProject) setDeleteTarget(activeProject);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Dự án"
        action={{
          label: 'Thêm dự án',
          href: '/projects/new',
          icon: <AddRoundedIcon />,
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(260px,1.4fr)_repeat(5,minmax(150px,1fr))]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã, tên dự án, ghi chú..."
            value={filters.keyword}
            onChange={(value) => updateFilters({ keyword: value })}
          />

          <CompactSelectField
            label="Trạng thái"
            value={filters.status_option_id}
            options={statuses.map((status) => ({
              value: String(status.id),
              label: status.label,
            }))}
            onChange={(value) => updateFilters({ status_option_id: value })}
          />

          <CompactSelectField
            label="Khách hàng"
            value={filters.customer_id}
            options={customers.map((customer) => ({
              value: String(customer.id),
              label: customerLabel(customer),
            }))}
            onChange={(value) => updateFilters({ customer_id: value })}
          />

          <CompactSelectField
            label="Dịch vụ"
            value={filters.service_id}
            options={serviceOptions.map((service) => ({
              value: String(service.id),
              label: `${'— '.repeat(service.depth)}${service.code} - ${service.name}`,
            }))}
            onChange={(value) => updateFilters({ service_id: value })}
          />

          <CompactSelectField
            label="Người quản lý"
            value={filters.manager_user_id}
            options={users.map((user) => ({
              value: String(user.id),
              label: userLabel(user),
            }))}
            onChange={(value) => updateFilters({ manager_user_id: value })}
          />

          <CompactSelectField
            label="Sales"
            value={filters.sales_user_id}
            options={users.map((user) => ({
              value: String(user.id),
              label: userLabel(user),
            }))}
            onChange={(value) => updateFilters({ sales_user_id: value })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'project',
              label: 'Dự án',
              className: 'sticky left-0 z-20 w-[300px] bg-slate-100',
            },
            { key: 'customer', label: 'Khách hàng', className: 'w-[220px]' },
            { key: 'service', label: 'Dịch vụ', className: 'w-[220px]' },
            { key: 'revenueGroup', label: 'Nhóm doanh thu', className: 'w-[190px]' },
            { key: 'status', label: 'Trạng thái', className: 'w-40' },
            { key: 'manager', label: 'Người quản lý', className: 'w-[180px]' },
            { key: 'sales', label: 'Sales', className: 'w-[180px]' },
            { key: 'startDate', label: 'Bắt đầu', className: 'w-32' },
            { key: 'endDate', label: 'Kết thúc', className: 'w-32' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Không có dữ liệu dự án"
          minWidthClassName="min-w-[1780px]"
        >
          {pageItems.map((project) => {
            const revenueGroup = getRevenueGroup(project);
            const isManagementFee = revenueGroup.group === '2.1';

            return (
              <tr key={project.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block truncate font-bold text-primary transition-colors hover:text-primary/80"
                      title={project.projectCode || project.projectName}
                    >
                      {project.projectCode || '-'}
                    </Link>
                    <Link
                      href={`/projects/${project.id}`}
                      className="mt-1 block truncate text-xs text-slate-500 transition-colors hover:text-primary"
                      title={project.projectName}
                    >
                      {project.projectName}
                    </Link>
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
                  {project.customer ? (
                    <Link
                      href={`/customers/${project.customer.id}`}
                      className="block truncate font-semibold text-slate-800 transition-colors hover:text-primary"
                      title={project.customer.customerName || project.customer.companyName || ''}
                    >
                      {project.customer.customerName || project.customer.companyName || '-'}
                    </Link>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
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
                  <p className="truncate text-slate-700" title={project.managerUser?.name || ''}>
                    {project.managerUser?.name || '-'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <p className="truncate text-slate-700" title={project.salesUser?.name || ''}>
                    {project.salesUser?.name || '-'}
                  </p>
                </td>
                <td className="px-3 py-4 text-slate-600">{formatProjectDate(project.startDate)}</td>
                <td className="px-3 py-4 text-slate-600">{formatProjectDate(project.endDate)}</td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      component={Link}
                      href={`/projects/${project.id}`}
                      size="small"
                      title="Chỉnh sửa"
                      aria-label={`Chỉnh sửa dự án ${project.projectCode || project.projectName}`}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      aria-label={`Tác vụ dự án ${project.projectCode || project.projectName}`}
                      onClick={(event) => openActionMenu(event, project)}
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

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem
            component={Link}
            href={activeProject ? `/projects/${activeProject.id}` : '/projects'}
            onClick={closeActionMenu}
          >
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem onClick={deleteActiveProject} className="text-rose-600" disabled={isDeleting}>
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>
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
