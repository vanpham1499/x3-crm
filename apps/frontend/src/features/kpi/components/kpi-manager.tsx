'use client';

import { type ReactElement, useState } from 'react';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RoomServiceRoundedIcon from '@mui/icons-material/RoomServiceRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { CircularProgress, IconButton, LinearProgress, MenuItem, Tooltip } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { SummaryMetricCard } from '@/components/data-display/summary-metric-card';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { CompactMonthPicker } from '@/components/form/compact-month-picker';
import { CompactYearPicker } from '@/components/form/compact-year-picker';
import { FormSelectField } from '@/components/form/form-select-field';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { MoneyInput } from '@/components/form/money-input';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { ServiceTableCell } from '@/components/table/service-table-cell';
import {
  KpiDetailDialog,
  type KpiDetailDialogState,
} from '@/features/kpi/components/kpi-detail-dialog';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { formatCurrency } from '@/lib/utils';
import type {
  DepartmentKpiRow,
  EmployeeKpiRow,
  KpiMonthlyReport,
  KpiPeriodFilters,
  KpiReport,
  KpiSummary,
  KpiTargetPayload,
  ServiceKpiRow,
} from '@/types/kpi';

type KpiRow = ServiceKpiRow | DepartmentKpiRow | EmployeeKpiRow;
type KpiTabScope = 'services' | 'departments' | 'employees';
type TargetDialogState = { row: KpiRow; period: string };

type KpiManagerProps = {
  report: KpiReport;
  filters: KpiPeriodFilters;
  canManage: boolean;
  isFetching: boolean;
  isSaving: boolean;
  onFiltersChange: (filters: KpiPeriodFilters) => void;
  onSaveTarget: (payload: KpiTargetPayload) => Promise<unknown>;
};

type TargetFormValues = {
  targetAmount: string;
};

function formatPercent(value: number | null) {
  if (value === null) return 'Chưa có kế hoạch';

  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatMonthLabel(period: string) {
  const [year, month] = period.split('-');

  return `Tháng ${month}/${year}`;
}

function amountTone(value: number) {
  return value < 0 ? 'text-rose-700' : 'text-emerald-700';
}

function aggregateSummary(periods: KpiMonthlyReport[], scope: KpiTabScope): KpiSummary {
  const targetAmount = periods.reduce((sum, period) => sum + period.summary[scope].targetAmount, 0);
  const actualAmount = periods.reduce((sum, period) => sum + period.summary[scope].actualAmount, 0);

  return {
    targetAmount,
    actualAmount,
    completionRate: targetAmount > 0 ? (actualAmount / targetAmount) * 100 : null,
  };
}

function CompletionCell({ value }: { value: number | null }) {
  const progress = value === null ? 0 : Math.min(100, Math.max(0, value));
  const colorClass =
    value === null
      ? 'text-slate-500'
      : value < 0
        ? 'text-rose-700'
        : value >= 100
          ? 'text-emerald-700'
          : 'text-blue-700';

  return (
    <div className="ml-auto w-32">
      <span className={`block text-right text-xs font-extrabold tabular-nums ${colorClass}`}>
        {formatPercent(value)}
      </span>
      <LinearProgress
        variant="determinate"
        value={progress}
        aria-label={value === null ? 'Chưa có kế hoạch KPI' : `Hoàn thành ${formatPercent(value)}`}
        className="mt-1.5 !h-1.5 !rounded-full !bg-slate-100"
        sx={{
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor:
              value !== null && value < 0
                ? '#be123c'
                : value !== null && value >= 100
                  ? '#047857'
                  : '#2563eb',
          },
        }}
      />
    </div>
  );
}

function KpiRowActions({
  row,
  period,
  canManage,
  onDetail,
  onEdit,
}: {
  row: KpiRow;
  period: string;
  canManage: boolean;
  onDetail: (state: KpiDetailDialogState) => void;
  onEdit: (state: TargetDialogState) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip title="Xem dữ liệu đối soát">
        <IconButton
          size="small"
          aria-label={`Xem dữ liệu đối soát KPI cho ${row.name} ${formatMonthLabel(period)}`}
          onClick={() =>
            onDetail({
              scopeType: row.scopeType,
              scopeId: row.id,
              scopeName: row.name,
              period,
            })
          }
        >
          <VisibilityRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {canManage ? (
        <Tooltip title="Cập nhật kế hoạch">
          <IconButton
            size="small"
            aria-label={`Cập nhật kế hoạch KPI cho ${row.name} ${formatMonthLabel(period)}`}
            onClick={() => onEdit({ row, period })}
          >
            <EditRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  );
}

function TargetDialog({
  state,
  isSaving,
  onClose,
  onSave,
}: {
  state: TargetDialogState | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: KpiTargetPayload) => Promise<unknown>;
}) {
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TargetFormValues>({
    values: {
      targetAmount: state ? String(state.row.targetAmount) : '0',
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={`Cập nhật kế hoạch · ${state?.row.name || ''}`}
      maxWidth="xs"
      submitting={isSaving}
      onClose={close}
      onSubmit={handleSubmit(async (values) => {
        if (!state) return;

        try {
          await onSave({
            period: state.period,
            scopeType: state.row.scopeType,
            scopeId: state.row.id,
            targetAmount: Number(values.targetAmount) || 0,
          });
          close();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton onClick={close} disabled={isSaving}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : 'Lưu kế hoạch'}
          </DialogActionButton>
        </>
      }
    >
      <p className="mb-4 text-sm font-semibold text-slate-600">
        {state ? formatMonthLabel(state.period) : ''}
      </p>
      <Controller
        name="targetAmount"
        control={control}
        rules={{
          required: 'Vui lòng nhập kế hoạch',
          min: { value: 0, message: 'Kế hoạch không được âm' },
        }}
        render={({ field }) => (
          <MoneyInput
            fullWidth
            size="small"
            label="Kế hoạch lợi nhuận tháng (VND)"
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={Boolean(errors.targetAmount)}
            helperText={errors.targetAmount?.message}
          />
        )}
      />
    </AppFormDialog>
  );
}

function PeriodFilters({
  filters,
  onChange,
  actions,
}: {
  filters: KpiPeriodFilters;
  onChange: (filters: KpiPeriodFilters) => void;
  actions?: ReactElement;
}) {
  const update = (next: Partial<KpiPeriodFilters>) => onChange({ ...filters, ...next });

  return (
    <ListFilterBar className="items-start border-b border-slate-200 p-4">
      <div>
        <FormSelectField
          label="Kỳ báo cáo"
          value={filters.mode}
          onChange={(event) => update({ mode: event.target.value as KpiPeriodFilters['mode'] })}
        >
          <MenuItem value="month">Theo tháng</MenuItem>
          <MenuItem value="quarter">Theo quý</MenuItem>
          <MenuItem value="year">Theo năm</MenuItem>
          <MenuItem value="range">Khoảng tháng</MenuItem>
        </FormSelectField>
      </div>

      {filters.mode === 'month' && (
        <div>
          <CompactMonthPicker
            label="Tháng"
            value={filters.month}
            onChange={(month) => month && update({ month })}
          />
        </div>
      )}

      {filters.mode === 'quarter' && (
        <>
          <div>
            <FormSelectField
              label="Quý"
              value={filters.quarter}
              onChange={(event) => update({ quarter: event.target.value })}
            >
              <MenuItem value="1">Quý 1</MenuItem>
              <MenuItem value="2">Quý 2</MenuItem>
              <MenuItem value="3">Quý 3</MenuItem>
              <MenuItem value="4">Quý 4</MenuItem>
            </FormSelectField>
          </div>
          <div>
            <CompactYearPicker value={filters.year} onChange={(year) => year && update({ year })} />
          </div>
        </>
      )}

      {filters.mode === 'year' && (
        <div>
          <CompactYearPicker value={filters.year} onChange={(year) => year && update({ year })} />
        </div>
      )}

      {filters.mode === 'range' && (
        <>
          <div>
            <CompactMonthPicker
              label="Từ tháng"
              value={filters.periodFrom}
              onChange={(periodFrom) => {
                if (!periodFrom) return;
                update({
                  periodFrom,
                  periodTo: periodFrom > filters.periodTo ? periodFrom : filters.periodTo,
                });
              }}
            />
          </div>
          <div>
            <CompactMonthPicker
              label="Đến tháng"
              value={filters.periodTo}
              onChange={(periodTo) => {
                if (!periodTo) return;
                update({
                  periodFrom: periodTo < filters.periodFrom ? periodTo : filters.periodFrom,
                  periodTo,
                });
              }}
            />
          </div>
        </>
      )}

      {actions ? (
        <div data-list-filter-action className="flex min-h-14 items-end justify-end">
          {actions}
        </div>
      ) : null}
    </ListFilterBar>
  );
}

function ComparisonTable({
  periods,
  scope,
  isFetching,
}: {
  periods: KpiMonthlyReport[];
  scope: KpiTabScope;
  isFetching: boolean;
}) {
  if (periods.length < 2) return null;

  return (
    <div>
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-bold text-slate-950">So sánh giữa các tháng</h2>
      </header>
      <AppDataTable
        columns={[
          { key: 'month', label: 'Tháng', className: 'w-[160px]' },
          {
            key: 'target',
            label: 'Kế hoạch',
            className: 'w-[190px] text-right',
          },
          {
            key: 'actual',
            label: 'Lợi nhuận trước VAT',
            className: 'w-[190px] text-right',
          },
          { key: 'completion', label: 'Hoàn thành', className: 'w-[170px] text-right' },
          { key: 'change', label: 'So với tháng trước', className: 'w-[230px] text-right' },
        ]}
        isLoading={isFetching}
        isEmpty={false}
        minWidthClassName="min-w-[940px]"
      >
        {periods.map((period, index) => {
          const summary = period.summary[scope];
          const previous = index > 0 ? periods[index - 1].summary[scope] : null;
          const changeAmount = previous ? summary.actualAmount - previous.actualAmount : null;
          const changeRate =
            previous && previous.actualAmount !== 0
              ? ((summary.actualAmount - previous.actualAmount) / Math.abs(previous.actualAmount)) *
                100
              : null;

          return (
            <tr key={period.period} className="hover:bg-slate-50/80">
              <td className="px-3 py-3.5 font-bold text-slate-900">
                {formatMonthLabel(period.period)}
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold tabular-nums text-slate-800">
                {formatCurrency(summary.targetAmount)}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-3.5 text-right font-extrabold tabular-nums ${amountTone(summary.actualAmount)}`}
              >
                {formatCurrency(summary.actualAmount)}
              </td>
              <td className="px-3 py-3.5">
                <CompletionCell value={summary.completionRate} />
              </td>
              <td className="px-3 py-3.5 text-right">
                {changeAmount === null ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                    <RemoveRoundedIcon fontSize="small" />
                    Tháng đầu kỳ
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center justify-end gap-1 font-extrabold tabular-nums ${
                      changeAmount < 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {changeAmount < 0 ? (
                      <TrendingDownRoundedIcon fontSize="small" />
                    ) : (
                      <TrendingUpRoundedIcon fontSize="small" />
                    )}
                    {formatCurrency(changeAmount)}
                    {changeRate !== null && (
                      <span className="text-xs">({formatPercent(changeRate)})</span>
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </AppDataTable>
    </div>
  );
}

function ServiceMonthTable({
  report,
  canManage,
  isFetching,
  onDetail,
  onEdit,
}: {
  report: KpiMonthlyReport;
  canManage: boolean;
  isFetching: boolean;
  onDetail: (state: KpiDetailDialogState) => void;
  onEdit: (state: TargetDialogState) => void;
}) {
  return (
    <AppDataTable
      columns={[
        { key: 'service', label: 'Dịch vụ', className: 'w-[230px]' },
        {
          key: 'target',
          label: 'Kế hoạch',
          className: 'w-[165px] text-right',
        },
        {
          key: 'received',
          label: 'Đã thu',
          className: 'w-[190px] text-right',
        },
        {
          key: 'cost',
          label: 'Chi phí thực tế',
          className: 'w-[175px] text-right',
        },
        {
          key: 'refund',
          label: 'Hoàn tiền',
          className: 'w-[190px] text-right',
        },
        {
          key: 'actual',
          label: 'Lợi nhuận trước VAT',
          className: 'w-[165px] text-right',
        },
        { key: 'completion', label: 'Hoàn thành', className: 'w-[165px] text-right' },
        { key: 'actions', className: 'w-[96px]' },
      ]}
      isLoading={isFetching}
      isEmpty={report.services.length === 0}
      emptyText="Chưa có dịch vụ gốc để tính KPI"
      minWidthClassName="min-w-[1376px]"
    >
      {report.services.map((row) => (
        <tr key={`${row.scopeType}-${row.id}`} className="hover:bg-slate-50/80">
          <td className="px-3 py-4">
            <ServiceTableCell
              code={row.code}
              name={`${row.name}${
                row.isDeleted ? ' (Đã xóa)' : row.isActive ? '' : ' (Ngừng hoạt động)'
              }`}
            />
            {row.scopeType === 'service_group' ? (
              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                Gồm: {row.memberServices?.map((service) => service.code).join(', ') || '-'}
              </p>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(row.targetAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-emerald-700">
            {formatCurrency(row.receivedAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-rose-700">
            {formatCurrency(row.costAmount)}
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-rose-700">
            {formatCurrency(row.refundAmount)}
          </td>
          <td
            className={`whitespace-nowrap px-3 py-4 text-right font-extrabold tabular-nums ${amountTone(row.actualAmount)}`}
          >
            {formatCurrency(row.actualAmount)}
          </td>
          <td className="px-3 py-4">
            <CompletionCell value={row.completionRate} />
          </td>
          <td className="px-3 py-4 text-right">
            <KpiRowActions
              row={row}
              period={report.period}
              canManage={canManage}
              onDetail={onDetail}
              onEdit={onEdit}
            />
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

function DepartmentProfitBreakdown({
  profit,
  items,
}: {
  profit: number;
  items: Array<{ label: string; value: number }>;
}) {
  const visibleItems = items.filter((item) => Math.abs(item.value) >= 0.01);

  if (Math.abs(profit) < 0.01 && visibleItems.length === 0) {
    return (
      <span className="text-sm font-semibold text-slate-300" aria-label="Không phát sinh">
        —
      </span>
    );
  }

  return (
    <div className="ml-auto w-full max-w-[320px]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-bold text-slate-600">Lợi nhuận trước VAT</span>
        <strong
          className={`whitespace-nowrap text-sm font-extrabold tabular-nums ${amountTone(profit)}`}
        >
          {formatCurrency(profit)}
        </strong>
      </div>
      {visibleItems.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Số đối soát có VAT
          </p>
          <dl className="space-y-1">
            {visibleItems.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-4 text-xs">
                <dt className="font-medium text-slate-500">{item.label}</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-700">
                  {formatCurrency(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function DepartmentMonthTable({
  report,
  canManage,
  isFetching,
  onDetail,
  onEdit,
}: {
  report: KpiMonthlyReport;
  canManage: boolean;
  isFetching: boolean;
  onDetail: (state: KpiDetailDialogState) => void;
  onEdit: (state: TargetDialogState) => void;
}) {
  return (
    <AppDataTable
      columns={[
        { key: 'department', label: 'Phòng ban', className: 'w-[230px]' },
        {
          key: 'target',
          label: 'Kế hoạch',
          className: 'w-[165px] text-right',
        },
        {
          key: 'implementation',
          label: 'Nhánh triển khai',
          className: 'w-[330px] text-right',
        },
        {
          key: 'acquisition',
          label: 'Nhánh phụ trách khách hàng',
          className: 'w-[320px] text-right',
        },
        {
          key: 'actual',
          label: 'Tổng lợi nhuận trước VAT',
          className: 'w-[175px] text-right',
        },
        { key: 'completion', label: 'Hoàn thành', className: 'w-[165px] text-right' },
        { key: 'actions', className: 'w-[96px]' },
      ]}
      isLoading={isFetching}
      isEmpty={report.departments.length === 0}
      emptyText="Chưa có phòng ban để tính KPI"
      minWidthClassName="min-w-[1520px]"
    >
      {report.departments.map((row) => (
        <tr key={row.id} className="hover:bg-slate-50/80">
          <td className="px-3 py-4">
            <span className="flex min-w-0 items-center gap-2 font-bold text-slate-950">
              <CorporateFareRoundedIcon className="!text-[19px] text-primary" />
              <span className="truncate" title={row.name}>
                {row.name}
              </span>
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(row.targetAmount)}
          </td>
          <td className="px-3 py-4 text-right">
            <DepartmentProfitBreakdown
              profit={row.implementationAmount}
              items={[
                { label: 'Đã thu', value: row.implementationReceivedAmount },
                { label: 'Chi phí thực tế', value: row.implementationCostAmount },
                { label: 'Hoàn tiền', value: row.implementationRefundAmount },
              ]}
            />
          </td>
          <td className="px-3 py-4 text-right">
            <DepartmentProfitBreakdown
              profit={row.acquisitionAmount}
              items={[
                { label: 'Báo phí ghi nhận', value: row.acquisitionCreditAmount },
                { label: 'Hoàn tiền', value: row.acquisitionRefundAmount },
              ]}
            />
          </td>
          <td
            className={`whitespace-nowrap px-3 py-4 text-right font-extrabold tabular-nums ${amountTone(row.actualAmount)}`}
          >
            {formatCurrency(row.actualAmount)}
          </td>
          <td className="px-3 py-4">
            <CompletionCell value={row.completionRate} />
          </td>
          <td className="px-3 py-4 text-right">
            <KpiRowActions
              row={row}
              period={report.period}
              canManage={canManage}
              onDetail={onDetail}
              onEdit={onEdit}
            />
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

function EmployeeMonthTable({
  report,
  canManage,
  isFetching,
  onDetail,
  onEdit,
}: {
  report: KpiMonthlyReport;
  canManage: boolean;
  isFetching: boolean;
  onDetail: (state: KpiDetailDialogState) => void;
  onEdit: (state: TargetDialogState) => void;
}) {
  return (
    <AppDataTable
      columns={[
        { key: 'employee', label: 'Nhân sự', className: 'w-[240px]' },
        { key: 'target', label: 'Kế hoạch', className: 'w-[165px] text-right' },
        {
          key: 'implementation',
          label: 'Nhánh triển khai',
          className: 'w-[330px] text-right',
        },
        {
          key: 'acquisition',
          label: 'Nhánh phụ trách khách hàng',
          className: 'w-[320px] text-right',
        },
        {
          key: 'actual',
          label: 'Tổng lợi nhuận trước VAT',
          className: 'w-[175px] text-right',
        },
        { key: 'completion', label: 'Hoàn thành', className: 'w-[165px] text-right' },
        { key: 'actions', className: 'w-[96px]' },
      ]}
      isLoading={isFetching}
      isEmpty={report.employees.length === 0}
      emptyText="Chưa có nhân sự trong phạm vi được cấp quyền"
      minWidthClassName="min-w-[1530px]"
    >
      {report.employees.map((row) => (
        <tr key={row.id} className="hover:bg-slate-50/80">
          <td className="px-3 py-4">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <PersonRoundedIcon className="!text-[20px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold text-slate-950" title={row.name}>
                  {row.name}
                  {row.isActive ? '' : ' (Ngừng hoạt động)'}
                </span>
                <span className="block truncate text-xs font-semibold text-slate-500">
                  {[row.code, row.departmentName].filter(Boolean).join(' · ') ||
                    'Chưa có phòng ban'}
                </span>
              </span>
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(row.targetAmount)}
          </td>
          <td className="px-3 py-4 text-right">
            <DepartmentProfitBreakdown
              profit={row.implementationAmount}
              items={[
                { label: 'Đã thu', value: row.implementationReceivedAmount },
                { label: 'Chi phí thực tế', value: row.implementationCostAmount },
                { label: 'Hoàn tiền', value: row.implementationRefundAmount },
              ]}
            />
          </td>
          <td className="px-3 py-4 text-right">
            <DepartmentProfitBreakdown
              profit={row.acquisitionAmount}
              items={[
                { label: 'Báo phí ghi nhận', value: row.acquisitionCreditAmount },
                { label: 'Hoàn tiền', value: row.acquisitionRefundAmount },
              ]}
            />
          </td>
          <td
            className={`whitespace-nowrap px-3 py-4 text-right font-extrabold tabular-nums ${amountTone(row.actualAmount)}`}
          >
            {formatCurrency(row.actualAmount)}
          </td>
          <td className="px-3 py-4">
            <CompletionCell value={row.completionRate} />
          </td>
          <td className="px-3 py-4 text-right">
            <KpiRowActions
              row={row}
              period={report.period}
              canManage={canManage}
              onDetail={onDetail}
              onEdit={onEdit}
            />
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

export function KpiManager({
  report,
  filters,
  canManage,
  isFetching,
  isSaving,
  onFiltersChange,
  onSaveTarget,
}: KpiManagerProps) {
  const notify = useAppNotification();
  const [activeTab, setActiveTab] = useState(0);
  const [targetDialog, setTargetDialog] = useState<TargetDialogState | null>(null);
  const [detailDialog, setDetailDialog] = useState<KpiDetailDialogState | null>(null);
  const [exportProgress, setExportProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const tabs: Array<{ scope: KpiTabScope; label: string; icon: ReactElement }> =
    report.viewerScope.level === 'all'
      ? [
          {
            scope: 'services',
            label: 'Theo dịch vụ',
            icon: <RoomServiceRoundedIcon fontSize="small" />,
          },
          {
            scope: 'departments',
            label: 'Theo phòng ban',
            icon: <CorporateFareRoundedIcon fontSize="small" />,
          },
          {
            scope: 'employees',
            label: 'Theo nhân sự',
            icon: <PeopleAltRoundedIcon fontSize="small" />,
          },
        ]
      : report.viewerScope.level === 'department'
        ? [
            {
              scope: 'departments',
              label: 'Theo phòng ban',
              icon: <CorporateFareRoundedIcon fontSize="small" />,
            },
            {
              scope: 'employees',
              label: 'Theo nhân sự',
              icon: <PeopleAltRoundedIcon fontSize="small" />,
            },
          ]
        : [
            {
              scope: 'employees',
              label: 'KPI của tôi',
              icon: <PersonRoundedIcon fontSize="small" />,
            },
          ];
  const selectedTab = tabs[activeTab] ?? tabs[0];
  const scope = selectedTab.scope;
  const employeeExportCount = report.periods.reduce(
    (total, period) => total + period.employees.length,
    0,
  );
  const exportEmployees = async () => {
    setExportProgress({ completed: 0, total: employeeExportCount });

    try {
      const { exportEmployeeKpiWorkbook } = await import('@/features/kpi/lib/export-employee-kpi');
      await exportEmployeeKpiWorkbook(report, setExportProgress);
      notify.success('Đã xuất file Excel KPI nhân sự.');
    } catch (error) {
      notify.error(getApiErrorMessage(error, 'Không thể xuất file Excel KPI nhân sự.'));
    } finally {
      setExportProgress(null);
    }
  };
  const summary = aggregateSummary(report.periods, scope);
  const scopeLabel =
    scope === 'services' ? 'dịch vụ' : scope === 'departments' ? 'phòng ban' : 'nhân sự';
  const summaryItems = [
    {
      label: 'Kế hoạch',
      helper: `Tổng kế hoạch ${scopeLabel} trong kỳ`,
      value: formatCurrency(summary.targetAmount),
      valueClassName: 'text-slate-950',
      tone: 'blue' as const,
      icon: <FlagOutlinedIcon />,
    },
    {
      label: 'Lợi nhuận trước VAT',
      helper: 'Tổng lợi nhuận ghi nhận trong kỳ',
      value: formatCurrency(summary.actualAmount),
      valueClassName: amountTone(summary.actualAmount),
      tone: summary.actualAmount < 0 ? ('rose' as const) : ('emerald' as const),
      icon: <AccountBalanceWalletOutlinedIcon />,
    },
    {
      label: 'Hoàn thành',
      helper: 'Tỷ lệ lợi nhuận trên kế hoạch',
      value: formatPercent(summary.completionRate),
      valueClassName:
        summary.completionRate === null
          ? 'text-slate-500'
          : summary.completionRate < 0
            ? 'text-rose-700'
            : summary.completionRate >= 100
              ? 'text-emerald-700'
              : 'text-blue-700',
      tone:
        summary.completionRate === null
          ? ('slate' as const)
          : summary.completionRate < 0
            ? ('rose' as const)
            : summary.completionRate >= 100
              ? ('emerald' as const)
              : ('blue' as const),
      icon: <DonutLargeRoundedIcon />,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="KPI" />

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryItems.map((item) => (
          <SummaryMetricCard
            key={item.label}
            label={item.label}
            helper={item.helper}
            value={item.value}
            valueClassName={item.valueClassName}
            tone={item.tone}
            icon={item.icon}
          />
        ))}
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <IconTabs
          value={activeTab}
          ariaLabel="Phạm vi báo cáo KPI"
          onChange={setActiveTab}
          items={tabs.map(({ label, icon }) => ({ label, icon }))}
        />

        <PeriodFilters
          filters={filters}
          onChange={onFiltersChange}
          actions={
            scope === 'employees' ? (
              <PrimaryActionButton
                tone="secondary"
                startIcon={
                  exportProgress ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <DownloadRoundedIcon fontSize="small" />
                  )
                }
                disabled={isFetching || Boolean(exportProgress) || employeeExportCount === 0}
                title="Xuất toàn bộ KPI nhân sự và dữ liệu đối soát trong kỳ đang chọn"
                onClick={() => void exportEmployees()}
              >
                {exportProgress
                  ? `Đang xuất ${exportProgress.completed}/${exportProgress.total}`
                  : 'Xuất Excel'}
              </PrimaryActionButton>
            ) : undefined
          }
        />

        <ComparisonTable periods={report.periods} scope={scope} isFetching={isFetching} />

        {report.periods.map((monthlyReport) => (
          <div key={`${scope}-${monthlyReport.period}`} className="border-t border-slate-200">
            <header className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-950">{formatMonthLabel(monthlyReport.period)}</h2>
            </header>
            {scope === 'services' ? (
              <ServiceMonthTable
                report={monthlyReport}
                canManage={canManage}
                isFetching={isFetching}
                onDetail={setDetailDialog}
                onEdit={setTargetDialog}
              />
            ) : scope === 'departments' ? (
              <DepartmentMonthTable
                report={monthlyReport}
                canManage={canManage}
                isFetching={isFetching}
                onDetail={setDetailDialog}
                onEdit={setTargetDialog}
              />
            ) : (
              <EmployeeMonthTable
                report={monthlyReport}
                canManage={canManage}
                isFetching={isFetching}
                onDetail={setDetailDialog}
                onEdit={setTargetDialog}
              />
            )}
          </div>
        ))}
      </section>

      <TargetDialog
        state={targetDialog}
        isSaving={isSaving}
        onClose={() => setTargetDialog(null)}
        onSave={onSaveTarget}
      />
      <KpiDetailDialog state={detailDialog} onClose={() => setDetailDialog(null)} />
    </div>
  );
}
