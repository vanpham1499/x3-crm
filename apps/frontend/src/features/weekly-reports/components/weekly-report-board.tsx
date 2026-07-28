'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { SummaryMetricCard } from '@/components/data-display/summary-metric-card';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { canApproveWeeklyReport } from '@/lib/ownership';
import { getReportWeekdayLabel } from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';
import { WeeklyReportCustomerPreviewDialog } from './weekly-report-customer-preview-dialog';
import type { User } from '@/types/user';
import type { AppOption } from '@/types/option';
import type {
  WeeklyReport,
  WeeklyReportBoardFilters,
  WeeklyReportBoardRow,
  WeeklyReportBoardSummary,
} from '@/types/weekly-report';

type WeeklyReportBoardProps = {
  embedded?: boolean;
  rows: WeeklyReportBoardRow[];
  users: User[];
  weeklyConditionOptions: AppOption[];
  filters: WeeklyReportBoardFilters;
  weekStart: string;
  isFetching: boolean;
  isDeleting: boolean;
  isSubmitting: boolean;
  isApproving: boolean;
  isReturning: boolean;
  currentUser: User | null;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: WeeklyReportBoardFilters) => void;
  onDelete: (report: WeeklyReport) => void;
  onSubmit: (report: WeeklyReport) => void;
  onApprove: (report: WeeklyReport) => void;
  onReturnToDraft: (report: WeeklyReport) => void;
};

type WeeklyReportSummaryProps = {
  filters: WeeklyReportBoardFilters;
  summary: WeeklyReportBoardSummary;
  onFiltersChange: (filters: WeeklyReportBoardFilters) => void;
};

const DUE_STATUS_LABELS: Record<string, string> = {
  not_due: 'Chưa đến hạn',
  due_today: 'Đến hạn hôm nay',
  overdue: 'Quá hạn',
  on_time: 'Đúng hạn',
  late: 'Nộp muộn',
};

const PROGRESS_STATUS_LABELS: Record<string, string> = {
  not_created: 'Chưa tạo',
  draft: 'Nháp',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
};

function dueStatusClass(status: string) {
  if (status === 'overdue' || status === 'late') {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (status === 'due_today') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'on_time') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function progressStatusClass(status: string) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'submitted') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'draft') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function conditionClass(condition?: string | null) {
  if (condition === 'Tốt') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (condition === 'Rủi ro') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (condition === 'Cần theo dõi') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-500 ring-slate-200';
}

export function WeeklyReportSummary({
  filters,
  summary,
  onFiltersChange,
}: WeeklyReportSummaryProps) {
  const metricItems = [
    {
      label: 'Cần báo cáo',
      helper: 'Tất cả dự án trong kỳ',
      value: summary.total,
      dueStatus: '',
      progressStatus: '',
      tone: 'blue' as const,
      icon: <AssignmentOutlinedIcon />,
    },
    {
      label: 'Đến hạn hôm nay',
      helper: 'Cần gửi báo cáo trong hôm nay',
      value: summary.dueToday,
      dueStatus: 'due_today',
      progressStatus: '',
      tone: 'amber' as const,
      icon: <TodayOutlinedIcon />,
    },
    {
      label: 'Quá hạn',
      helper: 'Chưa có báo cáo sau hạn',
      value: summary.overdue,
      dueStatus: 'overdue',
      progressStatus: '',
      tone: 'rose' as const,
      icon: <WarningAmberRoundedIcon />,
    },
    {
      label: 'Chờ duyệt',
      helper: 'Đã gửi và đang chờ xử lý',
      value: summary.waitingApproval,
      dueStatus: '',
      progressStatus: 'submitted',
      tone: 'blue' as const,
      icon: <PendingActionsRoundedIcon />,
    },
    {
      label: 'Đã hoàn thành',
      helper: 'Báo cáo đã được duyệt',
      value: summary.completed,
      dueStatus: '',
      progressStatus: 'approved',
      tone: 'emerald' as const,
      icon: <TaskAltRoundedIcon />,
    },
  ];

  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metricItems.map((item) => {
        const active =
          filters.dueStatus === item.dueStatus && filters.progressStatus === item.progressStatus;

        return (
          <SummaryMetricCard
            key={item.label}
            label={item.label}
            helper={item.helper}
            value={item.value}
            icon={item.icon}
            tone={item.tone}
            active={active}
            onClick={() =>
              onFiltersChange({
                ...filters,
                dueStatus: item.dueStatus,
                progressStatus: item.progressStatus,
              })
            }
          />
        );
      })}
    </section>
  );
}

export function WeeklyReportBoard({
  embedded = false,
  rows,
  users,
  weeklyConditionOptions,
  filters,
  weekStart,
  isFetching,
  isDeleting,
  isSubmitting,
  isApproving,
  isReturning,
  currentUser,
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
}: WeeklyReportBoardProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeRow, setActiveRow] = useState<WeeklyReportBoardRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReport | null>(null);
  const [returnTarget, setReturnTarget] = useState<WeeklyReport | null>(null);
  const [customerPreviewTarget, setCustomerPreviewTarget] = useState<WeeklyReport | null>(null);

  const updateFilters = (values: Partial<WeeklyReportBoardFilters>) => {
    onFiltersChange({ ...filters, ...values });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, row: WeeklyReportBoardRow) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveRow(row);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveRow(null);
  };

  return (
    <div>
      <section
        className={`overflow-hidden bg-white ${
          embedded ? '' : 'rounded-2xl border border-slate-200 shadow-sm'
        }`}
      >
        <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(5,176px)]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Mã dự án, tên dự án, khách hàng..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
          <CompactSelectField
            label="Nhân sự"
            value={filters.reportOwnerUserId}
            options={users.map((user) => ({ value: String(user.id), label: user.name }))}
            onChange={(reportOwnerUserId) => updateFilters({ reportOwnerUserId })}
          />
          <CompactSelectField
            label="Thứ báo cáo"
            value={filters.reportWeekday}
            options={[1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
              value: String(weekday),
              label: getReportWeekdayLabel(weekday),
            }))}
            onChange={(reportWeekday) => updateFilters({ reportWeekday })}
          />
          <CompactSelectField
            label="Hạn báo cáo"
            value={filters.dueStatus}
            options={Object.entries(DUE_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(dueStatus) => updateFilters({ dueStatus })}
          />
          <CompactSelectField
            label="Tiến độ"
            value={filters.progressStatus}
            options={Object.entries(PROGRESS_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(progressStatus) => updateFilters({ progressStatus })}
          />
          <CompactSelectField
            label="Tình trạng tuần"
            value={filters.weeklyCondition}
            options={weeklyConditionOptions
              .filter((option) => option.isActive)
              .map((option) => ({ value: option.label, label: option.label }))}
            onChange={(weeklyCondition) => updateFilters({ weeklyCondition })}
          />
        </div>

        <AppDataTable
          columns={[
            { key: 'project', label: 'Dự án', className: 'w-[250px]' },
            { key: 'sales', label: 'Nhân sự', className: 'w-[180px]' },
            { key: 'due', label: 'Hạn báo cáo', className: 'w-[240px]' },
            { key: 'period', label: 'Kỳ dữ liệu', className: 'w-[190px]' },
            { key: 'progress', label: 'Tiến độ', className: 'w-[130px]' },
            { key: 'condition', label: 'Tình trạng tuần', className: 'w-[150px]' },
            { key: 'actions', className: 'w-[132px]' },
          ]}
          isLoading={isFetching}
          isEmpty={rows.length === 0}
          emptyText="Không có dự án phù hợp trong kỳ này"
          minWidthClassName="min-w-[1272px]"
        >
          {rows.map((row) => {
            const report = row.report;
            const editHref = report ? `/weekly-reports/${report.id}` : '';
            const createHref = `/weekly-reports/new?projectId=${row.projectId}&weekStart=${weekStart}`;
            const projectLabel = row.project.projectCode || `Dự án #${row.projectId}`;
            return (
              <tr key={row.settingId} className="hover:bg-slate-50/80">
                <td className="px-3 py-3.5">
                  <EntityTableLink
                    href={`/projects/${row.projectId}`}
                    tone="blue"
                    title={row.project.projectCode || undefined}
                  >
                    {row.project.projectCode || `Dự án #${row.projectId}`}
                  </EntityTableLink>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-slate-700">
                  {[row.reportOwner?.code, row.reportOwner?.name].filter(Boolean).join(' - ') ||
                    '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${dueStatusClass(row.dueStatus)}`}
                    >
                      {DUE_STATUS_LABELS[row.dueStatus]}
                    </span>
                    <span className="font-semibold text-slate-700">
                      {getReportWeekdayLabel(row.reportWeekday)} · {formatDate(row.dueDate)}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3.5 font-medium text-slate-700">
                  {formatDate(row.periodStartDate)} – {formatDate(row.periodEndDate)}
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${progressStatusClass(row.progressStatus)}`}
                  >
                    {PROGRESS_STATUS_LABELS[row.progressStatus]}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ring-1 ${conditionClass(row.weeklyCondition)}`}
                  >
                    {row.weeklyCondition || 'Chưa đánh giá'}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    {!report ? (
                      <Tooltip
                        title={row.dueStatus === 'overdue' ? 'Tạo báo cáo bù' : 'Tạo báo cáo'}
                      >
                        <IconButton
                          component={Link}
                          href={createHref}
                          size="small"
                          color="primary"
                          aria-label={`${
                            row.dueStatus === 'overdue' ? 'Tạo báo cáo bù' : 'Tạo báo cáo'
                          } cho ${projectLabel}`}
                        >
                          <AddRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Bản gửi khách">
                          <IconButton
                            size="small"
                            aria-label={`Mở bản gửi khách ${projectLabel}`}
                            onClick={() => setCustomerPreviewTarget(report)}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Chỉnh sửa báo cáo">
                          <IconButton
                            component={Link}
                            href={editHref}
                            size="small"
                            color={report.status === 'draft' ? 'primary' : 'default'}
                            aria-label={`Chỉnh sửa báo cáo ${projectLabel}`}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {report ? (
                      <Tooltip title="Tác vụ">
                        <IconButton
                          size="small"
                          aria-label={`Tác vụ báo cáo ${projectLabel}`}
                          onClick={(event) => openActionMenu(event, row)}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
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
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          component={Link}
          href={activeRow?.report ? `/weekly-reports/${activeRow.report.id}` : '/weekly-reports'}
          onClick={closeActionMenu}
        >
          <VisibilityOutlinedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem báo cáo
        </MenuItem>
        {activeRow?.report?.status === 'draft' ? (
          <MenuItem
            disabled={isSubmitting}
            onClick={() => {
              if (activeRow.report) onSubmit(activeRow.report);
              closeActionMenu();
            }}
          >
            <SendRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Gửi duyệt
          </MenuItem>
        ) : null}
        {activeRow?.report?.status === 'submitted' &&
        activeRow.report &&
        canApproveWeeklyReport(currentUser, activeRow.report) ? (
          <MenuItem
            disabled={isApproving}
            onClick={() => {
              if (activeRow.report) onApprove(activeRow.report);
              closeActionMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Duyệt báo cáo
          </MenuItem>
        ) : null}
        {activeRow?.report?.status === 'submitted' &&
        activeRow.report &&
        canApproveWeeklyReport(currentUser, activeRow.report) ? (
          <MenuItem
            disabled={isReturning}
            onClick={() => {
              setReturnTarget(activeRow.report || null);
              closeActionMenu();
            }}
          >
            <ReplayRoundedIcon fontSize="small" className="mr-2 text-amber-600" />
            Trả về nháp
          </MenuItem>
        ) : null}
        {activeRow?.report?.status === 'draft' ? (
          <MenuItem
            className="text-rose-600"
            disabled={isDeleting}
            onClick={() => {
              setDeleteTarget(activeRow.report || null);
              closeActionMenu();
            }}
          >
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        ) : null}
      </Menu>

      <WeeklyReportCustomerPreviewDialog
        report={customerPreviewTarget}
        onClose={() => setCustomerPreviewTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa báo cáo tuần?"
        description="Báo cáo nháp này sẽ bị xóa. Dự án sẽ quay lại trạng thái chưa tạo báo cáo trong kỳ."
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
        description="Sales có thể tiếp tục chỉnh sửa và gửi lại báo cáo sau khi được trả về nháp."
        confirmText="Trả về nháp"
        loading={isReturning}
        onClose={() => setReturnTarget(null)}
        onConfirm={() => {
          if (returnTarget) onReturnToDraft(returnTarget);
          setReturnTarget(null);
        }}
      />
    </div>
  );
}
