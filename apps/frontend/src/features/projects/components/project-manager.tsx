'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
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
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ProjectFilters, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type ProjectManagerProps = {
  projects: ProjectItem[];
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  quoteConfigs: AppOption[];
  filters: ProjectFilters;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isFetching: boolean;
  isDeleting: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: ProjectFilters) => void;
  onDelete: (project: ProjectItem) => void;
};

function userLabel(user?: User | null) {
  if (!user) return '-';
  return [user.code, user.name].filter(Boolean).join(' - ');
}

function projectStatusClass(project: ProjectItem) {
  return project.statusOption ? 'text-white' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

function getProjectRevenueGroup(
  project: ProjectItem,
  services: ServiceItem[],
  quoteConfigs: AppOption[],
) {
  const rootService = getRootServiceItem(services, String(project.serviceId));
  const configOption = getConfigForRoot(quoteConfigs, rootService);
  const config = configOption ? getServiceQuoteConfigMeta(configOption, rootService) : null;

  return getProjectRevenueGroupInfo(Boolean(config?.enabled));
}

function projectCustomerIdentity(project: ProjectItem) {
  const customer = project.customer;
  if (!customer) return '-';

  return [customer.customerCode, customer.customerName || customer.companyName]
    .filter(Boolean)
    .join(' - ');
}

function projectServiceIdentity(project: ProjectItem) {
  if (!project.service) return '-';

  return [project.service.code, project.service.name].filter(Boolean).join(' - ');
}

function ProjectDetailRow({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;

  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 text-sm">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-800">{displayValue}</dd>
    </div>
  );
}

function ProjectViewDialog({
  project,
  services,
  quoteConfigs,
  tab,
  isLoading,
  onTabChange,
  onClose,
}: {
  project: ProjectItem | null;
  services: ServiceItem[];
  quoteConfigs: AppOption[];
  tab: number;
  isLoading: boolean;
  onTabChange: (tab: number) => void;
  onClose: () => void;
}) {
  if (!project) return null;

  const revenueGroup = getProjectRevenueGroup(project, services, quoteConfigs);

  return (
    <AppDetailDialog
      open
      title={project.projectName || project.projectCode || 'Dự án'}
      eyebrow={project.projectCode || `Project #${project.id}`}
      loading={isLoading}
      onClose={onClose}
      actions={
        <>
          {project.customer?.id && (
            <DialogActionButton href={`/customers/${project.customer.id}`}>
              Mở khách hàng
            </DialogActionButton>
          )}
          <DialogActionButton
            href={`/projects/${project.id}`}
            tone="primary"
            startIcon={<EditRoundedIcon />}
          >
            Chỉnh sửa
          </DialogActionButton>
        </>
      }
    >
      <IconTabs
        value={tab}
        onChange={onTabChange}
        ariaLabel="Nội dung chi tiết dự án"
        items={[
          { label: 'Thông tin', icon: <InfoRoundedIcon className="!text-[18px]" /> },
          { label: 'Liên kết', icon: <LinkRoundedIcon className="!text-[18px]" /> },
        ]}
      />

      <div className="bg-slate-50/60">
        {tab === 0 && (
          <div role="tabpanel" aria-label="Thông tin dự án" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                <ProjectDetailRow label="Khách hàng" value={projectCustomerIdentity(project)} />
                <ProjectDetailRow label="Dịch vụ" value={projectServiceIdentity(project)} />
                <ProjectDetailRow label="Nhóm doanh thu" value={revenueGroup.title} />
                <ProjectDetailRow
                  label="Trạng thái"
                  value={project.statusOption?.label || 'Chưa chọn'}
                />
                <ProjectDetailRow
                  label="Người quản lý"
                  value={project.managerUser?.name || project.managerUser?.code}
                />
                <ProjectDetailRow
                  label="Sales"
                  value={project.salesUser?.name || project.salesUser?.code}
                />
                <ProjectDetailRow label="Bắt đầu" value={formatProjectDate(project.startDate)} />
                <ProjectDetailRow label="Kết thúc" value={formatProjectDate(project.endDate)} />
              </dl>
            </section>
          </div>
        )}

        {tab === 1 && (
          <div role="tabpanel" aria-label="Liên kết dự án" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                <ProjectDetailRow label="Báo phí" value={project.quotation?.quotationCode} />
                <ProjectDetailRow label="Nhóm Zalo" value={project.zaloGroup} />
              </dl>

              <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 text-sm">
                  <span className="font-semibold text-slate-500">Plan</span>
                  {project.planLink ? (
                    <a
                      href={getProjectExternalUrl(project.planLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <LinkRoundedIcon className="!text-[18px]" />
                      <span className="truncate">Mở plan dự án</span>
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-800">-</span>
                  )}
                </div>
                <ProjectDetailRow label="Ghi chú" value={project.note} />
              </div>

              {project.quotation?.id && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <DialogActionButton href={`/quotations/${project.quotation.id}`}>
                    Mở báo phí
                  </DialogActionButton>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppDetailDialog>
  );
}

export function ProjectManager({
  projects,
  services,
  users,
  statuses,
  quoteConfigs,
  filters,
  page,
  totalPages,
  totalItems,
  pageSize,
  isFetching,
  isDeleting,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onDelete,
}: ProjectManagerProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [viewTarget, setViewTarget] = useState<ProjectItem | null>(null);
  const [viewTab, setViewTab] = useState(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const viewProjectId = viewTarget?.id || '';
  const { data: viewProjectDetail, isFetching: isFetchingViewProject } = useQuery<ProjectItem>({
    queryKey: ['projects', viewProjectId, 'quick-view'],
    queryFn: ({ signal }) =>
      api.get(`/projects/${viewProjectId}`, { signal }).then((response) => response.data),
    enabled: Boolean(viewProjectId),
  });

  const updateFilters = (nextFilters: Partial<ProjectFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
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

  const viewProject = (project: ProjectItem) => {
    setViewTarget(project);
    setViewTab(0);
  };

  const viewActiveProject = () => {
    if (activeProject) viewProject(activeProject);
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
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(150px,1fr))]">
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

          <CompactAutocompleteField
            label="Dịch vụ"
            value={filters.service_id}
            options={serviceOptions.map((service) => ({
              value: String(service.id),
              label: `${'— '.repeat(service.depth)}${service.code} - ${service.name}`,
            }))}
            onChange={(value) => updateFilters({ service_id: value })}
            noOptionsText="Không tìm thấy dịch vụ phù hợp"
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
            { key: 'actions', className: 'w-28' },
          ]}
          isLoading={isFetching}
          isEmpty={projects.length === 0}
          emptyText="Không có dữ liệu dự án"
          minWidthClassName="min-w-[1780px]"
        >
          {projects.map((project) => {
            const revenueGroup = getProjectRevenueGroup(project, services, quoteConfigs);
            const isManagementFee = revenueGroup.group === '2.1';

            return (
              <tr key={project.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <div className="min-w-0">
                    <EntityTableLink
                      href={`/projects/${project.id}`}
                      title={project.projectCode || project.projectName}
                    >
                      {project.projectCode || '-'}
                    </EntityTableLink>
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
                      size="small"
                      title="Xem chi tiết dự án"
                      aria-label={`Xem chi tiết dự án ${project.projectCode || project.projectName}`}
                      onClick={() => viewProject(project)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
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
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={viewActiveProject}>
            <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Xem chi tiết
          </MenuItem>
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

      <ProjectViewDialog
        project={viewProjectDetail || viewTarget}
        services={services}
        quoteConfigs={quoteConfigs}
        tab={viewTab}
        isLoading={isFetchingViewProject}
        onTabChange={setViewTab}
        onClose={() => setViewTarget(null)}
      />

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
