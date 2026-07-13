'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { getReportWeekdayLabel } from '@/lib/weekly-report-schedule';
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
  onFiltersChange,
  onDelete,
  onSubmit,
  onApprove,
  onOpenSettings,
}: WeeklyReportManagerProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeReport, setActiveReport] = useState<WeeklyReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReport | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(reports, {
    resetKey: filters,
  });

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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Báo cáo tuần</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Báo cáo tuần</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip
            title={filters.projectId ? '' : 'Chọn một dự án ở bộ lọc bên dưới để cấu hình'}
          >
            <span>
              <Button
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
                onClick={onOpenSettings}
                disabled={!filters.projectId}
              >
                Cấu hình dự án
              </Button>
            </span>
          </Tooltip>
          <Button
            component={Link}
            href="/weekly-reports/new"
            variant="contained"
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Thêm báo cáo
          </Button>
        </div>
      </div>

      {overdueSettings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <WarningAmberRoundedIcon className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-bold text-amber-800">
                {overdueSettings.length} dự án trễ hạn báo cáo tuần này
              </p>
              <ul className="mt-2 space-y-1.5">
                {overdueSettings.map((setting) => (
                  <li
                    key={setting.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-semibold text-amber-900">
                      {setting.project?.projectCode || `Dự án #${setting.projectId}`}
                      <span className="ml-2 font-normal text-amber-700">
                        (hạn {getReportWeekdayLabel(setting.reportWeekday)} hàng tuần)
                      </span>
                    </span>
                    <Link
                      href={`/weekly-reports/new?projectId=${setting.projectId}`}
                      className="font-bold text-amber-800 underline hover:text-amber-900"
                    >
                      Tạo báo cáo ngay
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(280px,1fr)_180px]">
          <TextField
            select
            fullWidth
            label="Dự án"
            value={filters.projectId}
            onChange={(event) => updateFilters({ projectId: event.target.value })}
          >
            <MenuItem value="">Tất cả dự án</MenuItem>
            {projects.map((project) => (
              <MenuItem key={project.id} value={String(project.id)}>
                {project.projectCode} - {project.projectName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Trạng thái"
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value })}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="draft">Nháp</MenuItem>
            <MenuItem value="submitted">Đã gửi</MenuItem>
            <MenuItem value="approved">Đã duyệt</MenuItem>
          </TextField>
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[1180px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-[220px] px-5 py-4">Dự án</th>
                <th className="w-40 px-5 py-4">Tuần báo cáo</th>
                <th className="w-40 px-5 py-4">Người báo cáo</th>
                <th className="w-32 px-5 py-4">Tình trạng tuần</th>
                <th className="w-32 px-5 py-4">Trạng thái</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">
                    Chưa có báo cáo tuần
                  </td>
                </tr>
              ) : (
                pageItems.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <Link
                        href={`/weekly-reports/${report.id}`}
                        className="block truncate font-bold text-slate-950 hover:underline"
                      >
                        {report.project?.projectCode || `Dự án #${report.projectId}`}
                      </Link>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                        {report.project?.projectName || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {report.weekStartDate} → {report.weekEndDate}
                    </td>
                    <td className="px-5 py-4 text-slate-700">{report.reporter?.name || '-'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${conditionClass(report.weeklyCondition)}`}
                      >
                        {report.weeklyCondition || 'Chưa đánh giá'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(report.status)}`}
                      >
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton size="small" title="Tác vụ" onClick={(event) => openActionMenu(event, report)}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
