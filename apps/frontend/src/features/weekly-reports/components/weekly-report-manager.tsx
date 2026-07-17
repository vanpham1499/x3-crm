'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { formatDate } from '@/lib/utils';
import type { ProjectItem } from '@/types/project';
import type { WeeklyReport, WeeklyReportFilters } from '@/types/weekly-report';

type WeeklyReportManagerProps = {
  reports: WeeklyReport[];
  projects: ProjectItem[];
  filters: WeeklyReportFilters;
  isFetching: boolean;
  isDeleting: boolean;
  isSubmitting: boolean;
  isApproving: boolean;
  isReturning: boolean;
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
  onReturnToDraft: (report: WeeklyReport) => void;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
};

function statusClass(status?: string | null) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'submitted') return 'bg-sky-50 text-sky-700 ring-sky-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
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
  filters,
  isFetching,
  isDeleting,
  isSubmitting,
  isApproving,
  isReturning,
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
  onReturnToDraft,
}: WeeklyReportManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeReport, setActiveReport] = useState<WeeklyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReport | null>(null);
  const [returnTarget, setReturnTarget] = useState<WeeklyReport | null>(null);

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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          label="Tiến độ"
          value={filters.status}
          options={[
            { value: 'draft', label: 'Nháp' },
            { value: 'submitted', label: 'Chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt' },
          ]}
          onChange={(status) => updateFilters({ status })}
        />
      </div>

      <AppDataTable
        columns={[
          { key: 'project', label: 'Dự án', className: 'w-[260px]' },
          { key: 'period', label: 'Kỳ dữ liệu', className: 'w-[220px]' },
          { key: 'due', label: 'Hạn báo cáo', className: 'w-[150px]' },
          { key: 'reporter', label: 'Người thực hiện', className: 'w-[180px]' },
          { key: 'condition', label: 'Tình trạng tuần', className: 'w-[160px]' },
          { key: 'status', label: 'Tiến độ', className: 'w-[130px]' },
          { key: 'actions', className: 'w-[56px]' },
        ]}
        isLoading={isFetching}
        isEmpty={reports.length === 0}
        emptyText="Chưa có báo cáo tuần"
        minWidthClassName="min-w-[1150px]"
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
              {formatDate(report.weekStartDate)} – {formatDate(report.weekEndDate)}
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-700">
              {report.dueDate ? formatDate(report.dueDate) : '-'}
            </td>
            <td className="truncate px-3 py-3.5 font-medium text-slate-700">
              {report.reporter?.name || '-'}
            </td>
            <td className="px-3 py-3.5">
              <span
                className={`inline-flex max-w-full truncate rounded-full px-2 py-1 text-xs font-bold ring-1 ${conditionClass(report.weeklyCondition)}`}
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

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          component={Link}
          href={activeReport ? `/weekly-reports/${activeReport.id}` : '/weekly-reports'}
          onClick={closeActionMenu}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem báo cáo
        </MenuItem>
        {activeReport?.status === 'draft' ? (
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
        ) : null}
        {activeReport?.status === 'submitted' && canApprove ? (
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
        ) : null}
        {activeReport?.status === 'submitted' && canApprove ? (
          <MenuItem
            disabled={isReturning}
            onClick={() => {
              setReturnTarget(activeReport);
              closeActionMenu();
            }}
          >
            <ReplayRoundedIcon fontSize="small" className="mr-2 text-amber-600" />
            Trả về nháp
          </MenuItem>
        ) : null}
        {activeReport?.status === 'draft' ? (
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
        ) : null}
      </Menu>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa báo cáo tuần?"
        description="Báo cáo nháp này sẽ bị xóa."
        confirmText="Xóa báo cáo"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Trả báo cáo về nháp?"
        description="Sales có thể tiếp tục chỉnh sửa và gửi lại báo cáo."
        confirmText="Trả về nháp"
        loading={isReturning}
        onClose={() => setReturnTarget(null)}
        onConfirm={() => {
          if (returnTarget) onReturnToDraft(returnTarget);
          setReturnTarget(null);
        }}
      />
    </section>
  );
}
