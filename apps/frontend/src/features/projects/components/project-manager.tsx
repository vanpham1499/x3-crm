'use client';

import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
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
import { InlineStatusSelect } from '@/components/form/inline-status-select';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { ServiceTableCell } from '@/components/table/service-table-cell';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { UserDateTimeCell } from '@/components/table/user-date-time-cell';
import { EntityTimelineList } from '@/components/timeline/entity-timeline-list';
import { formatProjectDate, getProjectExternalUrl } from '@/lib/project-utils';
import { getOptionColor } from '@/lib/option-utils';
import { flattenServices } from '@/lib/service-utils';
import { canCreateProject, canDeleteProject, canEditProject } from '@/lib/ownership';
import { formatCurrency } from '@/lib/utils';
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
  filters: ProjectFilters;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isFetching: boolean;
  isDeleting: boolean;
  updatingStatusProjectId: number | null;
  currentUser: User | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: ProjectFilters) => void;
  onDelete: (project: ProjectItem) => void;
  onStatusChange: (project: ProjectItem, statusOptionId: number) => void;
};

function userLabel(user?: User | null) {
  if (!user) return '-';
  return [user.code, user.name].filter(Boolean).join(' - ');
}

function InlineProjectStatusSelect({
  project,
  statuses,
  disabled,
  onChange,
}: {
  project: ProjectItem;
  statuses: AppOption[];
  disabled: boolean;
  onChange: (statusOptionId: number) => void;
}) {
  const currentStatusId = String(project.statusOptionId || project.statusOption?.id || '');
  const selectedOption = statuses.find((status) => String(status.id) === currentStatusId);
  const displayOption = selectedOption || project.statusOption;

  return (
    <InlineStatusSelect
      value={currentStatusId}
      label={displayOption?.label || 'Chưa chọn'}
      color={displayOption ? getOptionColor(displayOption) : '#64748b'}
      options={statuses.map((status) => ({
        value: String(status.id),
        label: status.label,
        color: getOptionColor(status),
      }))}
      ariaLabel={`Cập nhật trạng thái dự án ${project.projectCode || project.projectName}`}
      disabled={disabled}
      onChange={(statusOptionId) => onChange(Number(statusOptionId))}
    />
  );
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

function getProjectTimelineEntries(project: ProjectItem) {
  if (project.timelines?.length) return project.timelines;

  const fallbackEntries: NonNullable<ProjectItem['timelines']> = [];

  if (project.updatedAt) {
    fallbackEntries.push({
      id: `${project.id}-updated`,
      title: 'Cập nhật dự án',
      description:
        project.note ||
        (project.statusOption?.label
          ? `Trạng thái hiện tại: ${project.statusOption.label}`
          : 'Thông tin dự án đã được cập nhật'),
      occurredAt: project.updatedAt,
      actor: project.createdBy,
      statusOption: project.statusOption,
    });
  }

  if (project.createdAt) {
    fallbackEntries.push({
      id: `${project.id}-created`,
      title: 'Tạo dự án',
      description: project.managerUser?.name
        ? `Nhân sự triển khai: ${project.managerUser.name}`
        : '',
      occurredAt: project.createdAt,
      actor: project.createdBy,
      statusOption: project.statusOption,
    });
  }

  return fallbackEntries;
}

function ProjectViewDialog({
  project,
  statuses,
  tab,
  isLoading,
  currentUser,
  onTabChange,
  onClose,
}: {
  project: ProjectItem | null;
  statuses: AppOption[];
  tab: number;
  isLoading: boolean;
  currentUser: User | null;
  onTabChange: (tab: number) => void;
  onClose: () => void;
}) {
  if (!project) return null;

  const timelineEntries = getProjectTimelineEntries(project);
  const linkedQuotations = Array.from(
    new Map(
      [...(project.quotations || []), ...(project.quotation ? [project.quotation] : [])].map(
        (quotation) => [quotation.id, quotation],
      ),
    ).values(),
  );

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
            disabled={!canEditProject(currentUser, project)}
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
          {
            label: 'Lịch sử chỉnh sửa',
            icon: <HistoryRoundedIcon className="!text-[18px]" />,
          },
        ]}
      />

      <div className="bg-slate-50/60">
        {tab === 0 && (
          <div role="tabpanel" aria-label="Thông tin dự án" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                <ProjectDetailRow label="Khách hàng" value={projectCustomerIdentity(project)} />
                <ProjectDetailRow label="Dịch vụ" value={projectServiceIdentity(project)} />
                <ProjectDetailRow
                  label="Trạng thái"
                  value={project.statusOption?.label || 'Chưa chọn'}
                />
                <ProjectDetailRow
                  label="Nhân sự triển khai"
                  value={project.managerUser?.name || project.managerUser?.code}
                />
                <ProjectDetailRow label="Bắt đầu" value={formatProjectDate(project.startDate)} />
                <ProjectDetailRow label="Kết thúc" value={formatProjectDate(project.endDate)} />
                <ProjectDetailRow
                  label="Tổng ngân sách"
                  value={formatCurrency(Number(project.weeklySetting?.monthlyBudget) || 0)}
                />
              </dl>
            </section>
          </div>
        )}

        {tab === 1 && (
          <div role="tabpanel" aria-label="Liên kết dự án" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
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
                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 text-sm">
                  <span className="font-semibold text-slate-500">Link BC tổng hợp</span>
                  {project.customerTrackingReportLink ? (
                    <a
                      href={getProjectExternalUrl(project.customerTrackingReportLink)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <LinkRoundedIcon className="!text-[18px]" />
                      <span className="truncate">Mở báo cáo tổng hợp</span>
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-800">-</span>
                  )}
                </div>
                <ProjectDetailRow label="Tài khoản Admin Web" value={project.adminWebAccount} />
                <ProjectDetailRow label="Ghi chú" value={project.note} />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 text-sm">
                  <span className="font-semibold text-slate-500">Danh sách báo phí</span>
                  {linkedQuotations.length > 0 ? (
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {linkedQuotations.map((quotation) => (
                        <Link
                          key={quotation.id}
                          href={`/quotations/${quotation.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100"
                        >
                          <LinkRoundedIcon className="!text-[16px]" />
                          {quotation.quotationCode || `Báo phí #${quotation.id}`}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-800">-</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 2 && (
          <div role="tabpanel" aria-label="Lịch sử chỉnh sửa dự án" className="p-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-950">
                <HistoryRoundedIcon className="!text-[18px] text-slate-500" />
                Lịch sử chỉnh sửa
              </h3>
              <EntityTimelineList
                entries={timelineEntries}
                statusOptions={statuses}
                fallbackStatusOption={project.statusOption}
                emptyText="Chưa có lịch sử chỉnh sửa."
              />
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
  filters,
  page,
  totalPages,
  totalItems,
  pageSize,
  isFetching,
  isDeleting,
  updatingStatusProjectId,
  currentUser,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onDelete,
  onStatusChange,
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
          disabled: !canCreateProject(currentUser),
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-slate-200 p-4">
          <ListFilterBar>
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
              label="Nhân sự triển khai"
              value={filters.manager_user_id}
              options={users.map((user) => ({
                value: String(user.id),
                label: userLabel(user),
              }))}
              onChange={(value) => updateFilters({ manager_user_id: value })}
            />
          </ListFilterBar>
        </div>

        <AppDataTable
          columns={[
            {
              key: 'project',
              label: 'Dự án',
              className: 'sticky left-0 z-20 w-[300px] bg-slate-100',
            },
            { key: 'customer', label: 'Khách hàng', className: 'w-[220px]' },
            { key: 'service', label: 'Dịch vụ', className: 'w-[230px]' },
            { key: 'status', label: 'Trạng thái', className: 'w-48 text-center' },
            { key: 'manager', label: 'Nhân sự triển khai', className: 'w-[180px]' },
            { key: 'startDate', label: 'Bắt đầu', className: 'w-32' },
            { key: 'endDate', label: 'Kết thúc', className: 'w-32' },
            { key: 'created', label: 'Người tạo', className: 'w-[150px]' },
            { key: 'actions', className: 'w-28' },
          ]}
          isLoading={isFetching}
          isEmpty={projects.length === 0}
          emptyText="Không có dữ liệu dự án"
          minWidthClassName="min-w-[1570px]"
        >
          {projects.map((project) => {
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
                  <ServiceTableCell code={project.service?.code} name={project.service?.name} />
                </td>
                <td className="px-3 py-4 text-center align-middle">
                  <InlineProjectStatusSelect
                    project={project}
                    statuses={statuses}
                    disabled={
                      updatingStatusProjectId === project.id ||
                      !canEditProject(currentUser, project)
                    }
                    onChange={(statusOptionId) => onStatusChange(project, statusOptionId)}
                  />
                </td>
                <td className="px-3 py-4">
                  <p className="truncate text-slate-700" title={project.managerUser?.name || ''}>
                    {project.managerUser?.name || '-'}
                  </p>
                </td>
                <td className="px-3 py-4 text-slate-600">{formatProjectDate(project.startDate)}</td>
                <td className="px-3 py-4 text-slate-600">{formatProjectDate(project.endDate)}</td>
                <td className="px-3 py-4 align-middle">
                  <UserDateTimeCell
                    userName={project.createdBy?.name}
                    dateTime={project.createdAt}
                  />
                </td>
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
                      disabled={!canEditProject(currentUser, project)}
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
            disabled={!activeProject || !canEditProject(currentUser, activeProject)}
          >
            <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Chỉnh sửa
          </MenuItem>
          <MenuItem
            onClick={deleteActiveProject}
            className="text-rose-600"
            disabled={isDeleting || !activeProject || !canDeleteProject(currentUser, activeProject)}
          >
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>
      </section>

      <ProjectViewDialog
        project={viewProjectDetail || viewTarget}
        statuses={statuses}
        tab={viewTab}
        isLoading={isFetchingViewProject}
        currentUser={currentUser}
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
