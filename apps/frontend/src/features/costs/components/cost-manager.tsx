'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { getAdTopupCardLabel } from '@/lib/ad-topup-card-options';
import type {
  ProjectCost,
  ProjectCostAdjustmentType,
  ProjectCostBalanceStatus,
  ProjectCostEntryType,
  ProjectCostFilters,
  ProjectCostReconciliationInput,
  ProjectCostReconciliationResult,
  ProjectCostStatus,
} from '@/types/project-cost';

type CostManagerProps = {
  costs: ProjectCost[];
  filters: ProjectCostFilters;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  isFetching: boolean;
  isReconciling: boolean;
  onFiltersChange: (filters: ProjectCostFilters) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReconcile: (costId: number, payload: ProjectCostReconciliationInput) => Promise<ProjectCost>;
};

type CostGroup = {
  key: string;
  costs: ProjectCost[];
};

const ENTRY_TYPE_LABELS: Record<ProjectCostEntryType, string> = {
  ad_spend: 'Nạp quảng cáo',
  partner_cost: 'Chi phí đối tác',
};

const ACCEPTANCE_LABELS: Record<string, string> = {
  pending: 'Chờ nghiệm thu',
  accepted: 'Đã nghiệm thu',
  not_required: 'Không yêu cầu',
};

const INVOICE_LABELS: Record<string, string> = {
  pending: 'Chờ hóa đơn',
  received: 'Đã nhận hóa đơn',
  not_required: 'Không yêu cầu',
};

const RECONCILIATION_RESULT_OPTIONS: { value: ProjectCostReconciliationResult; label: string }[] =
  [
    { value: 'matched', label: 'Khớp chuẩn' },
    { value: 'matched_with_note', label: 'Khớp có lưu ý' },
    { value: 'difference', label: 'Có chênh lệch' },
    { value: 'pending_documents', label: 'Chờ chứng từ' },
    { value: 'cancelled', label: 'Hủy giao dịch' },
  ];

const INVOICE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chưa có hóa đơn' },
  { value: 'waiting', label: 'Đang chờ hóa đơn' },
  { value: 'received', label: 'Đã nhận hóa đơn' },
  { value: 'not_required', label: 'Không cần hóa đơn' },
];

const INVOICE_RECIPIENT_OPTIONS = [
  { value: 'customer', label: 'Theo khách hàng' },
  { value: 'company', label: 'Công ty X3Sales' },
  { value: 'other', label: 'Chủ thể khác' },
];

const BALANCE_STATUS_LABELS: Record<ProjectCostBalanceStatus, string> = {
  none: 'Không có số dư',
  pending: 'Chờ đối soát',
  resolved: 'Đã hoàn hạn mức',
};

const ADJUSTMENT_TYPE_OPTIONS: { value: ProjectCostAdjustmentType; label: string }[] = [
  { value: 'transfer_to_cid', label: 'Chuyển sang CID khác' },
  { value: 'carry_forward', label: 'Giữ sang kỳ sau' },
  { value: 'offset_next_topup', label: 'Cấn trừ lần nạp sau' },
  { value: 'refund_company', label: 'Hoàn về công ty' },
  { value: 'refund_customer', label: 'Hoàn cho khách' },
  { value: 'previous_period_balance', label: 'Dư ngân sách kỳ trước' },
  { value: 'additional_topup', label: 'Nạp thêm' },
  { value: 'customer_bonus', label: 'Nạp dư cho khách' },
  { value: 'company_compensation', label: 'Công ty bù thêm' },
  { value: 'bank_fee', label: 'Phí ngân hàng' },
  { value: 'rounding', label: 'Làm tròn' },
  { value: 'other', label: 'Khác' },
];

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} ₫`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function optionLabel(option?: ProjectCost['partnerOption'] | null) {
  return option?.label || option?.value || '-';
}

function groupCostsByProject(costs: ProjectCost[]): CostGroup[] {
  const groups = new Map<string, CostGroup>();

  costs.forEach((cost) => {
    const key = cost.projectId ? `project:${cost.projectId}` : `cost:${cost.id}`;
    const group = groups.get(key);

    if (group) {
      group.costs.push(cost);
    } else {
      groups.set(key, { key, costs: [cost] });
    }
  });

  return [...groups.values()];
}

function statusClass(status: ProjectCostStatus) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function costStatusLabel(cost: ProjectCost) {
  if (cost.status === 'completed') {
    return cost.entryType === 'ad_spend' ? 'Đã nạp' : 'Đã chi';
  }

  if (cost.status === 'cancelled') return 'Đã hủy';
  return cost.entryType === 'ad_spend' ? 'Chờ nạp' : 'Chờ chi';
}

function entryTypeClass(entryType: ProjectCostEntryType) {
  return entryType === 'ad_spend'
    ? 'bg-sky-50 text-sky-700 ring-sky-200'
    : 'bg-violet-50 text-violet-700 ring-violet-200';
}

function costSummary(cost: ProjectCost) {
  if (cost.entryType === 'ad_spend') {
    return [
      cost.cid ? `CID ${cost.cid}` : 'Chưa có CID',
      getAdTopupCardLabel(cost.bankAccountOption),
    ]
      .filter((value) => value && value !== '-')
      .join(' · ');
  }

  return [optionLabel(cost.partnerOption), ACCEPTANCE_LABELS[cost.acceptanceStatus || '']]
    .filter((value) => value && value !== '-')
    .join(' · ');
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[140px,minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-bold text-slate-900">
        {value || '-'}
      </dd>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('vi-VN');
}

function moneyValue(value: string | number | null | undefined) {
  return Number(value) || 0;
}

function reconciliationResultLabel(value?: string | null) {
  return RECONCILIATION_RESULT_OPTIONS.find((option) => option.value === value)?.label || '-';
}

function invoiceStatusLabel(value?: string | null) {
  return INVOICE_STATUS_OPTIONS.find((option) => option.value === value)?.label || '-';
}

function balanceStatusClass(status?: ProjectCostBalanceStatus | null) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-500 ring-slate-200';
}

function releasedBalanceAmount(cost: ProjectCost) {
  return moneyValue(
    cost.releasedBalanceAmount ?? cost.handledBalanceAmount ?? cost.originalBalanceAmount,
  );
}

function displayedBalanceAmount(cost: ProjectCost) {
  return cost.balanceStatus === 'resolved'
    ? releasedBalanceAmount(cost)
    : moneyValue(cost.remainingBalanceAmount ?? cost.originalBalanceAmount);
}

function CostDetailDialog({ cost, onClose }: { cost: ProjectCost | null; onClose: () => void }) {
  if (!cost) return null;

  const isAdSpend = cost.entryType === 'ad_spend';
  const projectCode = cost.project?.projectCode || `Dự án #${cost.projectId}`;
  const balanceAmount = displayedBalanceAmount(cost);

  return (
    <AppDetailDialog
      open
      maxWidth="md"
      title={ENTRY_TYPE_LABELS[cost.entryType]}
      eyebrow={projectCode}
      subtitle={formatDate(cost.transactionDate)}
      onClose={onClose}
      actions={
        <DialogActionButton
          tone="primary"
          href={`/projects/${cost.projectId}`}
          startIcon={<WorkRoundedIcon />}
        >
          Mở dự án
        </DialogActionButton>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-4">
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tiền công ty chi</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-rose-700">
              {formatCurrency(cost.cashOutAmount ?? cost.totalAmount)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {isAdSpend ? 'Chi phí thực chạy' : 'Chi phí ghi nhận'}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">
              {formatCurrency(
                isAdSpend && cost.cidIsDead
                  ? cost.cidSpentAmount
                  : cost.realizedCostAmount ?? cost.actualCostAmount ?? cost.totalAmount,
              )}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {cost.balanceStatus === 'resolved' ? 'Hạn mức đã hoàn' : 'Chờ hoàn hạn mức'}
            </p>
            <p
              className={`mt-1 text-lg font-extrabold tabular-nums ${
                cost.balanceStatus === 'resolved' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {formatCurrency(balanceAmount)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái</p>
            <span
              className={`mt-1.5 inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
            >
              {costStatusLabel(cost)}
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4">
          <dl>
            <DetailRow label="Dự án" value={projectCode} />
            <DetailRow
              label="Đối soát"
              value={
                cost.reconciledAt
                  ? `Đã khớp · ${formatDateTime(cost.reconciledAt)}${cost.reconciledBy?.name ? ` · ${cost.reconciledBy.name}` : ''}`
                  : 'Chưa khớp'
              }
            />
            <DetailRow label="Số hóa đơn" value={cost.invoiceNumber} />
            <DetailRow label="Kết quả đối soát" value={reconciliationResultLabel(cost.reconciliationResult)} />
            <DetailRow label="Hóa đơn" value={invoiceStatusLabel(cost.invoiceStatus)} />
            {isAdSpend ? (
              <>
                <DetailRow label="Mã CID" value={cost.cid} />
                <DetailRow label="Thẻ nạp QC" value={getAdTopupCardLabel(cost.bankAccountOption)} />
                {cost.cidIsDead ? (
                  <DetailRow
                    label="CID ngừng hoạt động"
                    value={`Đã chạy ${formatCurrency(cost.cidSpentAmount)} · Dư gốc ${formatCurrency(cost.originalBalanceAmount)}`}
                  />
                ) : null}
              </>
            ) : (
              <>
                <DetailRow label="Đối tác" value={optionLabel(cost.partnerOption)} />
                <DetailRow
                  label="Nghiệm thu"
                  value={ACCEPTANCE_LABELS[cost.acceptanceStatus || ''] || '-'}
                />
                <DetailRow
                  label="Hóa đơn đầu vào"
                  value={INVOICE_LABELS[cost.inputInvoiceStatus || ''] || '-'}
                />
                <DetailRow label="VAT" value={`${Number(cost.vatRate) || 0}%`} />
                <DetailRow label="Tiền VAT" value={formatCurrency(cost.vatAmount)} />
                <DetailRow label="Giảm trừ" value={formatCurrency(cost.discountAmount)} />
              </>
            )}
            {cost.adjustments?.length ? (
              <DetailRow
                label="Phát sinh đối soát"
                value={cost.adjustments
                  .map((adjustment) => {
                    const label =
                      ADJUSTMENT_TYPE_OPTIONS.find(
                        (option) => option.value === adjustment.adjustmentType,
                      )?.label || adjustment.adjustmentType;
                    return `${label}: ${formatCurrency(adjustment.amount)}`;
                  })
                  .join(' · ')}
              />
            ) : null}
            <DetailRow label="Ghi chú" value={cost.note} />
            <DetailRow label="Ghi chú đối soát" value={cost.reconciliationNote} />
          </dl>
        </section>
      </div>
    </AppDetailDialog>
  );
}

function CostReconciliationDialog({
  cost,
  loading,
  onClose,
  onSubmit,
}: {
  cost: ProjectCost | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: ProjectCostReconciliationInput) => Promise<ProjectCost>;
}) {
  const [result, setResult] = useState<ProjectCostReconciliationResult>(
    cost?.reconciliationResult || 'matched',
  );
  const [invoiceStatus, setInvoiceStatus] = useState(cost?.invoiceStatus || 'pending');
  const [invoiceNumber, setInvoiceNumber] = useState(cost?.invoiceNumber || '');
  const [invoiceRecipientType, setInvoiceRecipientType] = useState(
    cost?.invoiceRecipientType || 'customer',
  );
  const [invoiceRecipientName, setInvoiceRecipientName] = useState(
    cost?.invoiceRecipientName || '',
  );
  const [note, setNote] = useState(cost?.reconciliationNote || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!cost) return null;

  const cashOutAmount = moneyValue(cost.cashOutAmount ?? cost.totalAmount);
  const actualCostAmount = cost.cidIsDead
    ? moneyValue(cost.cidSpentAmount)
    : moneyValue(cost.actualCostAmount ?? cost.totalAmount);
  const originalBalanceAmount = moneyValue(cost.originalBalanceAmount);
  const isFinalResult = ['matched', 'matched_with_note', 'difference'].includes(result);
  const autoReleasedAmount = isFinalResult ? originalBalanceAmount : 0;

  const submit = () => {
    const nextErrors: Record<string, string> = {};

    if (invoiceStatus === 'received' && !invoiceNumber.trim()) {
      nextErrors.invoiceNumber = 'Vui lòng nhập số hóa đơn';
    }

    if (invoiceRecipientType === 'other' && !invoiceRecipientName.trim()) {
      nextErrors.invoiceRecipientName = 'Vui lòng nhập chủ thể nhận hóa đơn';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void onSubmit({
      reconciliationResult: result,
      invoiceStatus: invoiceStatus as ProjectCostReconciliationInput['invoiceStatus'],
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceRecipientType:
        invoiceRecipientType as ProjectCostReconciliationInput['invoiceRecipientType'],
      invoiceRecipientName: invoiceRecipientName.trim() || null,
      reconciliationNote: note.trim() || null,
      adjustments: cost.adjustments || [],
    })
      .then(() => onClose())
      .catch(() => undefined);
  };

  return (
    <AppFormDialog
      open
      title="Đối soát khoản chi"
      maxWidth="md"
      submitting={loading}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      actions={
        <>
          <DialogActionButton onClick={onClose} disabled={loading}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu đối soát'}
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase text-slate-400">Tiền đã nạp / chi</p>
            <p className="mt-1 text-base font-extrabold tabular-nums text-rose-700">
              {formatCurrency(cashOutAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase text-slate-400">Chi phí xác nhận</p>
            <p className="mt-1 text-base font-extrabold tabular-nums text-slate-950">
              {formatCurrency(actualCostAmount)}
            </p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2.5 ${
              autoReleasedAmount > 0
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className="text-[11px] font-bold uppercase text-slate-500">Tự hoàn hạn mức</p>
            <p
              className={`mt-1 text-base font-extrabold tabular-nums ${
                autoReleasedAmount > 0 ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {formatCurrency(autoReleasedAmount)}
            </p>
          </div>
        </div>

        {cost.cidIsDead ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <WarningAmberRoundedIcon className="!text-[18px]" />
              CID ngừng hoạt động · Đã chạy {formatCurrency(cost.cidSpentAmount)}
            </div>
            <p className="mt-1 pl-[26px] text-xs font-semibold leading-5 text-slate-600">
              {isFinalResult
                ? `${formatCurrency(originalBalanceAmount)} còn dư sẽ tự cộng lại vào Số tiền có thể nạp của dự án ngay khi lưu đối soát.`
                : 'Hạn mức còn dư chỉ được hoàn lại sau khi chọn một kết quả đối soát hoàn tất.'}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <FormSelectField
            label="Kết quả đối soát"
            value={result}
            onChange={(event) => setResult(event.target.value as ProjectCostReconciliationResult)}
          >
            {RECONCILIATION_RESULT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </FormSelectField>
          <FormSelectField
            label="Trạng thái hóa đơn"
            value={invoiceStatus}
            onChange={(event) =>
              setInvoiceStatus(event.target.value as ProjectCostReconciliationInput['invoiceStatus'])
            }
          >
            {INVOICE_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </FormSelectField>
          <FormInputField
            label="Số hóa đơn"
            value={invoiceNumber}
            error={Boolean(errors.invoiceNumber)}
            helperText={errors.invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
          <FormSelectField
            label="Chủ thể nhận hóa đơn"
            value={invoiceRecipientType}
            onChange={(event) =>
              setInvoiceRecipientType(
                event.target.value as ProjectCostReconciliationInput['invoiceRecipientType'],
              )
            }
          >
            {INVOICE_RECIPIENT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </FormSelectField>
          {invoiceRecipientType === 'other' ? (
            <FormInputField
              label="Tên chủ thể"
              value={invoiceRecipientName}
              error={Boolean(errors.invoiceRecipientName)}
              helperText={errors.invoiceRecipientName}
              onChange={(event) => setInvoiceRecipientName(event.target.value)}
            />
          ) : null}
          <FormInputField
            label="Ghi chú đối soát"
            className={invoiceRecipientType === 'other' ? '' : 'md:col-span-2'}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
    </AppFormDialog>
  );
}

export function CostManager({
  costs,
  filters,
  page,
  pageSize,
  totalPages,
  totalItems,
  isFetching,
  isReconciling,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onReconcile,
}: CostManagerProps) {
  const [viewTarget, setViewTarget] = useState<ProjectCost | null>(null);
  const [activeCost, setActiveCost] = useState<ProjectCost | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<ProjectCost | null>(null);
  const costGroups = groupCostsByProject(costs);

  const updateFilters = (nextFilters: Partial<ProjectCostFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, cost: ProjectCost) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveCost(cost);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveCost(null);
  };

  const openReconcileDialog = (cost: ProjectCost) => {
    setReconcileTarget(cost);
  };

  const closeReconcileDialog = () => {
    if (isReconciling) return;
    setReconcileTarget(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="Chi phí" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(6,160px)]">
            <CompactSearchField
              label="Từ khóa"
              placeholder="Dự án, CID, đối tác, số hóa đơn, ghi chú..."
              value={filters.keyword}
              onChange={(keyword) => updateFilters({ keyword })}
            />
            <CompactSelectField
              label="Loại chi phí"
              value={filters.entry_type}
              options={[
                { value: 'ad_spend', label: 'Nạp quảng cáo' },
                { value: 'partner_cost', label: 'Chi phí đối tác' },
              ]}
              onChange={(entry_type) =>
                updateFilters({ entry_type: entry_type as ProjectCostFilters['entry_type'] })
              }
            />
            <CompactSelectField
              label="Trạng thái"
              value={filters.status}
              options={[
                { value: 'pending', label: 'Chờ xử lý' },
                { value: 'completed', label: 'Hoàn thành' },
                { value: 'cancelled', label: 'Đã hủy' },
              ]}
              onChange={(status) =>
                updateFilters({ status: status as ProjectCostFilters['status'] })
              }
            />
            <CompactSelectField
              label="Đối soát"
              value={filters.reconciled_status}
              options={[
                { value: 'unmatched', label: 'Chưa khớp' },
                { value: 'matched', label: 'Đã khớp' },
              ]}
              onChange={(reconciled_status) =>
                updateFilters({
                  reconciled_status: reconciled_status as ProjectCostFilters['reconciled_status'],
                })
              }
            />
            <CompactSelectField
              label="Số dư"
              value={filters.balance_status}
              options={[
                { value: 'pending', label: 'Chờ đối soát' },
                { value: 'resolved', label: 'Đã hoàn hạn mức' },
                { value: 'none', label: 'Không có' },
              ]}
              onChange={(balance_status) =>
                updateFilters({
                  balance_status: balance_status as ProjectCostFilters['balance_status'],
                })
              }
            />
            <FormDatePicker
              label="Từ ngày"
              value={filters.date_from}
              max={filters.date_to || undefined}
              onChange={(date_from) => updateFilters({ date_from })}
            />
            <FormDatePicker
              label="Đến ngày"
              value={filters.date_to}
              min={filters.date_from || undefined}
              onChange={(date_to) => updateFilters({ date_to })}
            />
          </div>
        </div>

        <AppDataTable
          columns={[
            {
              key: 'date',
              label: 'Ngày nạp / chi',
              className: 'sticky left-0 z-20 w-36 bg-slate-100',
            },
            { key: 'type', label: 'Loại chi phí', className: 'w-44' },
            { key: 'amount', label: 'Số tiền', className: 'w-44 text-right' },
            { key: 'balance', label: 'Số dư', className: 'w-40 text-right' },
            { key: 'detail', label: 'Chi tiết', className: 'w-80' },
            { key: 'project', label: 'Dự án', className: 'w-64' },
            { key: 'status', label: 'Trạng thái', className: 'w-36' },
            { key: 'reconcile', label: 'Đối soát', className: 'w-28 text-center' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={costs.length === 0}
          emptyText="Chưa có chi phí dự án"
          minWidthClassName="min-w-[1380px]"
        >
          {costGroups.flatMap((group) => {
            const firstCost = group.costs[0];
            const project = firstCost?.project;
            const rowSpan = group.costs.length;

            return group.costs.map((cost, rowIndex) => {
              const isFirstRow = rowIndex === 0;

              return (
                <tr
                  key={cost.id}
                  className={
                    isFirstRow
                      ? 'group border-t-2 border-slate-200 first:border-t-0 hover:bg-slate-50/80'
                      : 'group hover:bg-slate-50/80'
                  }
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-3.5 font-semibold tabular-nums text-slate-800 group-hover:bg-slate-50">
                    <span className="whitespace-nowrap">{formatDate(cost.transactionDate)}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${entryTypeClass(cost.entryType)}`}
                    >
                      {cost.entryType === 'ad_spend' ? (
                        <CampaignRoundedIcon className="!text-[16px]" />
                      ) : (
                        <HandshakeRoundedIcon className="!text-[16px]" />
                      )}
                      {ENTRY_TYPE_LABELS[cost.entryType]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right font-extrabold tabular-nums text-rose-700">
                    <span className="whitespace-nowrap">
                      {formatCurrency(cost.cashOutAmount ?? cost.totalAmount)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    {cost.balanceStatus && cost.balanceStatus !== 'none' ? (
                      <div className="inline-flex flex-col items-end gap-1">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${balanceStatusClass(cost.balanceStatus)}`}
                        >
                          {BALANCE_STATUS_LABELS[cost.balanceStatus]}
                        </span>
                        <span
                          className={`whitespace-nowrap text-xs font-extrabold tabular-nums ${
                            cost.balanceStatus === 'resolved'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {formatCurrency(displayedBalanceAmount(cost))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <p
                      className="truncate whitespace-nowrap text-sm font-semibold text-slate-700"
                      title={costSummary(cost)}
                    >
                      {costSummary(cost) || '-'}
                    </p>
                  </td>
                  {isFirstRow ? (
                    <td
                      rowSpan={rowSpan}
                      className="border-l border-slate-100 bg-slate-50/50 px-3 py-3.5 align-middle"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {project ? (
                          <EntityTableLink href={`/projects/${project.id}`} tone="blue">
                            {project.projectCode || `Dự án #${cost.projectId}`}
                          </EntityTableLink>
                        ) : (
                          <span className="font-semibold text-slate-500">
                            Dự án #{cost.projectId}
                          </span>
                        )}
                        {rowSpan > 1 ? (
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                            {rowSpan} khoản
                          </span>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-3 py-3.5">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
                    >
                      {costStatusLabel(cost)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {cost.reconciledAt ? (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                        title={`Đã khớp lúc ${formatDateTime(cost.reconciledAt)}${cost.invoiceNumber ? ` · Hóa đơn ${cost.invoiceNumber}` : ''}`}
                      >
                        <CheckCircleRoundedIcon className="!text-[16px]" />
                        Đã khớp
                      </span>
                    ) : (
                      <IconButton
                        size="small"
                        disabled={isReconciling}
                        title="Xác nhận đã khớp"
                        aria-label={`Xác nhận khớp khoản chi ${cost.id}`}
                        className="!text-slate-400 transition-colors hover:!bg-slate-100 hover:!text-slate-700"
                        onClick={() => openReconcileDialog(cost)}
                      >
                        <CheckCircleOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center justify-end gap-1 pr-3">
                      <IconButton
                        size="small"
                        title="Xem chi tiết"
                        aria-label={`Xem chi tiết chi phí ${cost.id}`}
                        onClick={() => setViewTarget(cost)}
                      >
                        <VisibilityRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Tác vụ"
                        aria-label={`Tác vụ chi phí ${cost.id}`}
                        onClick={(event) => openActionMenu(event, cost)}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            });
          })}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          rangeLabel="Hiển thị dự án"
          pageSizeLabel="Số dự án"
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setViewTarget(activeCost);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        {activeCost ? (
          <MenuItem
            component={Link}
            href={`/projects/${activeCost.projectId}`}
            onClick={closeActionMenu}
          >
            <OpenInNewRoundedIcon fontSize="small" className="mr-2 text-blue-600" />
            Mở dự án
          </MenuItem>
        ) : null}
      </Menu>

      <CostDetailDialog cost={viewTarget} onClose={() => setViewTarget(null)} />

      <CostReconciliationDialog
        key={reconcileTarget?.id || 'empty'}
        cost={reconcileTarget}
        loading={isReconciling}
        onClose={closeReconcileDialog}
        onSubmit={(payload) => onReconcile(reconcileTarget!.id, payload)}
      />
    </div>
  );
}
