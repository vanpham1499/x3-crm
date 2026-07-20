'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { canApproveWeeklyReport } from '@/lib/ownership';
import { getReportWeekdayLabel } from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';
import type { User } from '@/types/user';
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
  if (status === 'overdue') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status === 'due_today' || status === 'late') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
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
    { label: 'Cần báo cáo', value: summary.total, dueStatus: '', progressStatus: '' },
    {
      label: 'Đến hạn hôm nay',
      value: summary.dueToday,
      dueStatus: 'due_today',
      progressStatus: '',
    },
    { label: 'Quá hạn', value: summary.overdue, dueStatus: 'overdue', progressStatus: '' },
    {
      label: 'Chờ duyệt',
      value: summary.waitingApproval,
      dueStatus: '',
      progressStatus: 'submitted',
    },
    {
      label: 'Đã hoàn thành',
      value: summary.completed,
      dueStatus: '',
      progressStatus: 'approved',
    },
  ];

  return (
    <section className="mb-4 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      {metricItems.map((item) => {
        const active =
          filters.dueStatus === item.dueStatus && filters.progressStatus === item.progressStatus;

        return (
          <button
            key={item.label}
            type="button"
            aria-pressed={active}
            className={`min-h-[76px] cursor-pointer border-b border-slate-200 px-4 py-3 text-left transition-colors last:border-b-0 sm:border-r xl:border-b-0 ${
              active ? 'bg-emerald-50 ring-1 ring-inset ring-primary/30' : 'hover:bg-slate-50'
            }`}
            onClick={() =>
              onFiltersChange({
                ...filters,
                dueStatus: item.dueStatus,
                progressStatus: item.progressStatus,
              })
            }
          >
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {item.label}
            </span>
            <strong className="mt-1 block text-xl font-black tabular-nums text-slate-900">
              {item.value}
            </strong>
          </button>
        );
      })}
    </section>
  );
}

export function WeeklyReportBoard({
  embedded = false,
  rows,
  users,
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
            options={[
              { value: 'Tốt', label: 'Tốt' },
              { value: 'Cần theo dõi', label: 'Cần theo dõi' },
              { value: 'Rủi ro', label: 'Rủi ro' },
            ]}
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
            { key: 'actions', className: 'w-[170px]' },
          ]}
          isLoading={isFetching}
          isEmpty={rows.length === 0}
          emptyText="Không có dự án phù hợp trong kỳ này"
          minWidthClassName="min-w-[1310px]"
        >
          {rows.map((row) => {
            const report = row.report;
            const editHref = report ? `/weekly-reports/${report.id}` : '';
            const createHref = `/weekly-reports/new?projectId=${row.projectId}&weekStart=${weekStart}`;

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
                      <TabActionButton href={createHref} startIcon={<AddRoundedIcon />}>
                        {row.dueStatus === 'overdue' ? 'Tạo báo cáo bù' : 'Tạo báo cáo'}
                      </TabActionButton>
                    ) : (
                      <TabActionButton
                        href={editHref}
                        tone={report.status === 'draft' ? 'primary' : 'secondary'}
                        startIcon={
                          report.status === 'draft' ? (
                            <EditRoundedIcon />
                          ) : (
                            <VisibilityOutlinedIcon />
                          )
                        }
                      >
                        {report.status === 'draft' ? 'Tiếp tục' : 'Xem'}
                      </TabActionButton>
                    )}
                    {report ? (
                      <IconButton
                        size="small"
                        aria-label={`Tác vụ báo cáo ${row.project.projectCode || row.projectId}`}
                        title="Tác vụ"
                        onClick={(event) => openActionMenu(event, row)}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
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
