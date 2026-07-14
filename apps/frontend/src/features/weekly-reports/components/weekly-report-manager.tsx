'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { getReportWeekdayLabel } from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';
import type { ProjectItem } from '@/types/project';
import type {
  ProjectWeeklySetting,
  WeeklyReport,
  WeeklyReportFilters,
} from '@/types/weekly-report';

type WeeklyReportManagerProps = {
  reports: WeeklyReport[];
  projects: ProjectItem[];
  overdueSettings: ProjectWeeklySetting[];
  filters: WeeklyReportFilters;
  isFetching: boolean;
  isDeleting: boolean;
  isSubmitting: boolean;
  isApproving: boolean;
  canApprove: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: WeeklyReportFilters) => void;
  onDelete: (report: WeeklyReport) => void;
  onSubmit: (report: WeeklyReport) => void;
  onApprove: (report: WeeklyReport) => void;
  onOpenSettings: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Đã gửi',
  approved: 'Đã duyệt',
};

function statusClass(status?: string | null) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'submitted') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function conditionClass(condition?: string | null) {
  if (condition === 'Tốt') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (condition === 'Rủi ro') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (condition === 'Cần theo dõi') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-500 ring-slate-200';
}

export function WeeklyReportManager({
  reports,
  projects,
  overdueSettings,
  filters,
  isFetching,
  isDeleting,
  isSubmitting,
  isApproving,
  canApprove,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onDelete,
  onSubmit,
  onApprove,
  onOpenSettings,
}: WeeklyReportManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeReport, setActiveReport] = useState<WeeklyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReport | null>(null);
  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, report: WeeklyReport) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveReport(report);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveReport(null);
  };

  const updateFilters = (nextFilters: Partial<WeeklyReportFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Báo cáo tuần"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryActionButton
              tone="secondary"
              startIcon={<SettingsOutlinedIcon />}
              disabled={!filters.projectId}
              title={
                filters.projectId
                  ? 'Cấu hình báo cáo tuần cho dự án đã chọn'
                  : 'Chọn một dự án để cấu hình'
              }
              onClick={onOpenSettings}
            >
              Cấu hình dự án
            </PrimaryActionButton>
            <PrimaryActionButton href="/weekly-reports/new" startIcon={<AddRoundedIcon />}>
              Thêm báo cáo
            </PrimaryActionButton>
          </div>
        }
      />

      {overdueSettings.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3 text-amber-800">
            <WarningAmberRoundedIcon className="!text-[20px]" />
            <h2 className="text-sm font-bold">
              {overdueSettings.length} dự án trễ hạn báo cáo tuần này
            </h2>
          </div>
          <div className="divide-y divide-amber-100 px-4">
            {overdueSettings.map((setting) => (
              <div
                key={setting.id}
                className="flex min-h-10 flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-semibold text-amber-900">
                  {setting.project?.projectCode || `Dự án #${setting.projectId}`}
                  <span className="ml-2 font-normal text-amber-700">
                    Hạn {getReportWeekdayLabel(setting.reportWeekday)}
                  </span>
                </span>
                <Link
                  href={`/weekly-reports/new?projectId=${setting.projectId}`}
                  className="shrink-0 font-bold text-amber-800 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Tạo báo cáo
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(280px,1fr)_190px]">
          <CompactAutocompleteField
            label="Dự án"
            value={filters.projectId}
            allLabel="Tất cả dự án"
            options={projects.map((project) => ({
              value: String(project.id),
              label: project.projectCode || project.projectName || `Dự án #${project.id}`,
            }))}
            onChange={(projectId) => updateFilters({ projectId })}
          />
          <CompactSelectField
            label="Trạng thái"
            value={filters.status}
            options={[
              { value: 'draft', label: 'Nháp' },
              { value: 'submitted', label: 'Đã gửi' },
              { value: 'approved', label: 'Đã duyệt' },
            ]}
            onChange={(status) => updateFilters({ status })}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'project', label: 'Dự án', className: 'w-[260px]' },
            { key: 'week', label: 'Tuần báo cáo', className: 'w-[220px]' },
            { key: 'reporter', label: 'Người báo cáo', className: 'w-[180px]' },
            { key: 'condition', label: 'Tình trạng tuần', className: 'w-[160px]' },
            { key: 'status', label: 'Trạng thái', className: 'w-[130px]' },
            { key: 'actions', className: 'w-[56px]' },
          ]}
          isLoading={isFetching}
          isEmpty={reports.length === 0}
          emptyText="Chưa có báo cáo tuần"
          minWidthClassName="min-w-[1010px]"
        >
          {reports.map((report) => (
            <tr key={report.id} className="hover:bg-slate-50/80">
              <td className="px-3 py-3.5">
                <EntityTableLink
                  href={`/weekly-reports/${report.id}`}
                  tone="blue"
                  title={report.project?.projectCode || undefined}
                >
                  {report.project?.projectCode || `Dự án #${report.projectId}`}
                </EntityTableLink>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-700">
                {formatDate(report.weekStartDate)} → {formatDate(report.weekEndDate)}
              </td>
              <td className="truncate px-3 py-3.5 font-medium text-slate-700">
                {report.reporter?.name || '-'}
              </td>
              <td className="px-3 py-3.5">
                <span
                  className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-1 text-xs font-bold ring-1 ${conditionClass(report.weeklyCondition)}`}
                >
                  {report.weeklyCondition || 'Chưa đánh giá'}
                </span>
              </td>
              <td className="px-3 py-3.5">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${statusClass(report.status)}`}
                >
                  {STATUS_LABELS[report.status] || report.status}
                </span>
              </td>
              <td className="px-3 py-3.5 text-right">
                <IconButton
                  size="small"
                  aria-label={`Tác vụ báo cáo ${report.project?.projectCode || report.id}`}
                  title="Tác vụ"
                  onClick={(event) => openActionMenu(event, report)}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </td>
            </tr>
          ))}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          component={Link}
          href={activeReport ? `/weekly-reports/${activeReport.id}` : '/weekly-reports'}
          onClick={closeActionMenu}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem / Chỉnh sửa
        </MenuItem>
        {activeReport?.status === 'draft' && (
          <MenuItem
            disabled={isSubmitting}
            onClick={() => {
              if (activeReport) onSubmit(activeReport);
              closeActionMenu();
            }}
          >
            <SendRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Gửi duyệt
          </MenuItem>
        )}
        {activeReport?.status === 'submitted' && canApprove && (
          <MenuItem
            disabled={isApproving}
            onClick={() => {
              if (activeReport) onApprove(activeReport);
              closeActionMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Duyệt báo cáo
          </MenuItem>
        )}
        {activeReport?.status !== 'approved' && (
          <MenuItem
            className="text-rose-600"
            disabled={isDeleting}
            onClick={() => {
              setDeleteTarget(activeReport);
              closeActionMenu();
            }}
          >
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa báo cáo tuần?"
        description="Báo cáo tuần này sẽ bị xóa vĩnh viễn."
        confirmText="Xóa báo cáo"
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
