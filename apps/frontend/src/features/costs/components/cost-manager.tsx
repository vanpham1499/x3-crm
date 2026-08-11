'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MouseEvent } from 'react';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { CircularProgress, IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { InlineStatusSelect } from '@/components/form/inline-status-select';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableButton, EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { getAdTopupCardLabel } from '@/lib/ad-topup-card-options';
import type {
  ProjectCost,
  ProjectCostAdjustmentType,
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
  isExporting: boolean;
  isReconciling: boolean;
  isConfirmingCid: boolean;
  updatingStatusCostId: number | null;
  onFiltersChange: (filters: ProjectCostFilters) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onExport: () => void;
  onReconcile: (costId: number, payload: ProjectCostReconciliationInput) => Promise<ProjectCost>;
  onConfirmCid: (costId: number) => Promise<ProjectCost>;
  onStatusChange: (cost: ProjectCost, status: ProjectCostStatus) => void;
};

type CostGroup = {
  key: string;
  costs: ProjectCost[];
};

const ENTRY_TYPE_LABELS: Record<ProjectCostEntryType, string> = {
  ad_spend: 'Nạp quảng cáo',
  partner_cost: 'Chi phí đối tác',
};

const RECONCILIATION_RESULT_OPTIONS: { value: ProjectCostReconciliationResult; label: string }[] = [
  { value: 'matched', label: 'Khớp chuẩn' },
  { value: 'unmatched', label: 'Chưa khớp' },
];

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

function costStatusColor(status: ProjectCostStatus) {
  if (status === 'completed') return '#059669';
  if (status === 'cancelled') return '#e11d48';

  return '#d97706';
}

function costStatusOptions(cost: ProjectCost) {
  const isAdSpend = cost.entryType === 'ad_spend';

  return [
    {
      value: 'pending',
      label: isAdSpend ? 'Chờ nạp' : 'Chờ chi',
      color: costStatusColor('pending'),
    },
    {
      value: 'completed',
      label: isAdSpend ? 'Đã nạp' : 'Đã chi',
      color: costStatusColor('completed'),
    },
    {
      value: 'cancelled',
      label: 'Đã hủy',
      color: costStatusColor('cancelled'),
    },
  ];
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

  return optionLabel(cost.partnerOption);
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

function reconciliationResultLabel(cost: ProjectCost) {
  return cost.reconciledAt ? 'Khớp chuẩn' : 'Chưa khớp';
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

function CostDetailDialog({
  cost,
  confirmingCid,
  onClose,
  onConfirmCid,
}: {
  cost: ProjectCost | null;
  confirmingCid: boolean;
  onClose: () => void;
  onConfirmCid: (cost: ProjectCost) => void;
}) {
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
        <>
          {cost.cidIncident?.status === 'pending' && cost.canApprove ? (
            <DialogActionButton
              tone="primary"
              startIcon={<CheckCircleRoundedIcon />}
              disabled={confirmingCid}
              onClick={() => onConfirmCid(cost)}
            >
              Xác nhận CID ngừng
            </DialogActionButton>
          ) : null}
          <DialogActionButton
            tone={cost.cidIncident?.status === 'pending' ? 'secondary' : 'primary'}
            href={`/projects/${cost.projectId}`}
            startIcon={<WorkRoundedIcon />}
          >
            Mở dự án
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-4">
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Tiền công ty chi
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-rose-700">
              {formatCurrency(cost.cashOutAmount ?? cost.totalAmount)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Chi phí ghi nhận
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">
              {formatCurrency(cost.realizedCostAmount ?? cost.actualCostAmount ?? cost.totalAmount)}
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
            <DetailRow label="Kết quả đối soát" value={reconciliationResultLabel(cost)} />
            {isAdSpend ? (
              <>
                <DetailRow label="Mã CID" value={cost.cid} />
                <DetailRow label="Thẻ nạp QC" value={getAdTopupCardLabel(cost.bankAccountOption)} />
                {cost.cidIsDead ? (
                  <>
                    <DetailRow
                      label="CID ngừng hoạt động"
                      value={
                        cost.cidIncident
                          ? `${cost.cidIncident.status === 'pending' ? 'Chờ kế toán xác nhận' : 'Đã xác nhận'} · Ngừng ngày ${formatDate(cost.cidIncident.stoppedAt)}`
                          : `Đã chạy ${formatCurrency(cost.cidSpentAmount)} · Dư gốc ${formatCurrency(cost.originalBalanceAmount)}`
                      }
                    />
                    {cost.cidIncident ? (
                      <>
                        <DetailRow
                          label="Tiền CID đã chạy"
                          value={formatCurrency(cost.cidIncident.spentAmount)}
                        />
                        <DetailRow
                          label="Không thu hồi được"
                          value={formatCurrency(cost.cidIncident.unrecoverableAmount)}
                        />
                        <DetailRow
                          label={
                            cost.cidIncident.status === 'confirmed'
                              ? 'Hạn mức đã hoàn'
                              : 'Dự kiến hoàn hạn mức'
                          }
                          value={formatCurrency(cost.cidIncident.releasedAmount)}
                        />
                        <DetailRow
                          label="Người báo"
                          value={[
                            cost.cidIncident.reportedBy?.name,
                            formatDateTime(cost.cidIncident.reportedAt),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        />
                        {cost.cidIncident.status === 'confirmed' ? (
                          <DetailRow
                            label="Người xác nhận"
                            value={[
                              cost.cidIncident.confirmedBy?.name,
                              formatDateTime(cost.cidIncident.confirmedAt),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          />
                        ) : null}
                        <DetailRow label="Ghi chú CID" value={cost.cidIncident.note} />
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <DetailRow label="Đối tác" value={optionLabel(cost.partnerOption)} />
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

function CidIncidentConfirmDialog({
  cost,
  loading,
  onClose,
  onSubmit,
}: {
  cost: ProjectCost | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (costId: number) => Promise<ProjectCost>;
}) {
  const incident = cost?.cidIncident;

  if (!cost || !incident || incident.status !== 'pending') return null;

  return (
    <AppFormDialog
      open
      title="Xác nhận CID ngừng hoạt động"
      maxWidth="sm"
      submitting={loading}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(cost.id)
          .then(onClose)
          .catch(() => undefined);
      }}
      actions={
        <>
          <DialogActionButton onClick={onClose} disabled={loading}>
            Kiểm tra lại
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={loading}>
            {loading ? 'Đang xác nhận...' : 'Xác nhận và hoàn hạn mức'}
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <WarningAmberRoundedIcon className="!text-[18px]" />
            CID {cost.cid || '-'} ngừng ngày {formatDate(incident.stoppedAt)}
          </div>
          <p className="mt-1 pl-[26px] text-xs font-medium leading-5 text-slate-600">
            Sau khi xác nhận, khoản chi gốc vẫn được khóa và phần hạn mức còn lại sẽ tự động cộng về
            “Số tiền có thể nạp” của dự án.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-2">
          {[
            { label: 'Tiền đã nạp', value: cost.totalAmount, tone: 'text-slate-950' },
            { label: 'CID đã chạy', value: incident.spentAmount, tone: 'text-slate-950' },
            {
              label: 'Không thu hồi được',
              value: incident.unrecoverableAmount,
              tone: 'text-rose-700',
            },
            {
              label: 'Tự hoàn hạn mức',
              value: incident.releasedAmount,
              tone: 'text-emerald-700',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border-b border-slate-200 px-3 py-2.5 odd:border-r last:border-b-0"
            >
              <p className="text-[11px] font-bold uppercase text-slate-400">{item.label}</p>
              <p
                className={`mt-1 whitespace-nowrap text-base font-extrabold tabular-nums ${item.tone}`}
              >
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>

        <dl className="rounded-lg border border-slate-200 bg-slate-50 px-3">
          <DetailRow
            label="Người báo"
            value={[incident.reportedBy?.name, formatDateTime(incident.reportedAt)]
              .filter(Boolean)
              .join(' · ')}
          />
          <DetailRow label="Ghi chú" value={incident.note} />
        </dl>
      </div>
    </AppFormDialog>
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
    cost?.reconciledAt ? 'matched' : 'unmatched',
  );
  const [invoiceNumber, setInvoiceNumber] = useState(cost?.invoiceNumber || '');
  const [note, setNote] = useState(cost?.reconciliationNote || '');

  if (!cost) return null;

  const cashOutAmount = moneyValue(cost.cashOutAmount ?? cost.totalAmount);
  const actualCostAmount = cost.cidIsDead
    ? moneyValue(cost.cidSpentAmount)
    : moneyValue(cost.actualCostAmount ?? cost.totalAmount);
  const originalBalanceAmount = moneyValue(cost.originalBalanceAmount);
  const isMatched = result === 'matched';
  const autoReleasedAmount = isMatched ? originalBalanceAmount : 0;

  const submit = () => {
    void onSubmit({
      reconciliationResult: result,
      invoiceNumber: invoiceNumber.trim() || null,
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
              {isMatched
                ? `${formatCurrency(originalBalanceAmount)} còn dư sẽ tự cộng lại vào Số tiền có thể nạp của dự án ngay khi lưu đối soát.`
                : 'Hạn mức còn dư chỉ được hoàn lại sau khi khoản chi được xác nhận Khớp chuẩn.'}
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
          <FormInputField
            label="Số hóa đơn"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
          <FormInputField
            label="Ghi chú đối soát"
            className="md:col-span-2"
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
  isExporting,
  isReconciling,
  isConfirmingCid,
  updatingStatusCostId,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onExport,
  onReconcile,
  onConfirmCid,
  onStatusChange,
}: CostManagerProps) {
  const [viewTarget, setViewTarget] = useState<ProjectCost | null>(null);
  const [activeCost, setActiveCost] = useState<ProjectCost | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<ProjectCost | null>(null);
  const [confirmCidTarget, setConfirmCidTarget] = useState<ProjectCost | null>(null);
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
      <PageHeader
        title="Chi phí"
        actions={
          <PrimaryActionButton
            tone="secondary"
            startIcon={
              isExporting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DownloadRoundedIcon fontSize="small" />
              )
            }
            disabled={isExporting || totalItems === 0}
            title="Xuất toàn bộ chi phí và dữ liệu đối soát theo bộ lọc hiện tại"
            onClick={onExport}
          >
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </PrimaryActionButton>
        }
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-slate-200 p-4">
          <ListFilterBar>
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
                { value: 'pending', label: 'Chờ nạp / chờ chi' },
                { value: 'completed', label: 'Đã nạp / đã chi' },
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
            {/* <CompactSelectField
              label="Trạng thái"
              value={filters.balance_status}
              options={[
                { value: 'pending', label: 'Chờ xác nhận' },
                { value: 'resolved', label: 'Đã hoàn hạn mức' },
                { value: 'none', label: 'Không có' },
              ]}
              onChange={(balance_status) =>
                updateFilters({
                  balance_status: balance_status as ProjectCostFilters['balance_status'],
                })
              }
            /> */}
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
          </ListFilterBar>
        </div>

        <AppDataTable
          columns={[
            { key: 'date', label: 'Ngày chi', className: 'w-32' },
            { key: 'type', label: 'Loại chi phí', className: 'w-40' },
            { key: 'amount', label: 'Chi phí', className: 'w-52 text-right' },
            { key: 'detail', label: 'Chi tiết', className: 'w-80' },
            { key: 'project', label: 'Dự án', className: 'w-56' },
            { key: 'status', label: 'Trạng thái chi', className: 'w-36 text-center' },
            { key: 'processing', label: 'Đối soát', className: 'w-40 text-center' },
            { key: 'actions', className: 'w-14' },
          ]}
          isLoading={isFetching}
          isEmpty={costs.length === 0}
          emptyText="Chưa có chi phí dự án"
          minWidthClassName="min-w-[1220px]"
        >
          {costGroups.flatMap((group) => {
            const firstCost = group.costs[0];
            const project = firstCost?.project;
            const rowSpan = group.costs.length;
            const availableTopupBudget = Number(project?.availableTopupBudget) || 0;
            const hasTopupBudget =
              project?.availableTopupBudget !== null && project?.availableTopupBudget !== undefined;

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
                  <td className="px-3 py-3.5 font-semibold tabular-nums text-slate-800">
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
                  <td className="px-3 py-3.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="whitespace-nowrap font-extrabold tabular-nums text-rose-700">
                        {formatCurrency(cost.cashOutAmount ?? cost.totalAmount)}
                      </span>
                      {cost.balanceStatus && cost.balanceStatus !== 'none' ? (
                        <span
                          className={`whitespace-nowrap text-xs font-bold tabular-nums ${
                            cost.balanceStatus === 'resolved'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {cost.balanceStatus === 'resolved' ? 'Đã hoàn ' : 'Chờ xác nhận '}
                          {formatCurrency(displayedBalanceAmount(cost))}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="min-w-0">
                      <EntityTableButton
                        tone="neutral"
                        className="w-full whitespace-nowrap text-sm text-slate-700"
                        title={costSummary(cost)}
                        ariaLabel={`Xem chi tiết chi phí ${costSummary(cost) || cost.id}`}
                        onClick={() => setViewTarget(cost)}
                      >
                        {costSummary(cost) || '-'}
                      </EntityTableButton>
                      {cost.invoiceNumber ? (
                        <p
                          className="mt-1 truncate text-xs font-semibold text-blue-700"
                          title={`Số hóa đơn: ${cost.invoiceNumber}`}
                        >
                          Hóa đơn: {cost.invoiceNumber}
                        </p>
                      ) : null}
                      {cost.reconciliationNote ? (
                        <p
                          className="mt-0.5 truncate text-xs font-medium text-slate-500"
                          title={cost.reconciliationNote}
                        >
                          Ghi chú đối soát: {cost.reconciliationNote}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  {isFirstRow ? (
                    <td
                      rowSpan={rowSpan}
                      className="border-l border-slate-100 bg-slate-50/50 px-3 py-3.5 align-middle"
                    >
                      <div className="flex min-w-0 flex-col gap-1.5">
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
                        {hasTopupBudget ? (
                          <p
                            className={`whitespace-nowrap text-xs font-bold tabular-nums ${
                              availableTopupBudget < 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {availableTopupBudget < 0 ? 'Đang âm: ' : 'Có thể nạp: '}
                            {formatCurrency(Math.abs(availableTopupBudget))}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-3 py-3.5 text-center">
                    {cost.canFund && !cost.reconciledAt ? (
                      <InlineStatusSelect
                        value={cost.status}
                        label={costStatusLabel(cost)}
                        color={costStatusColor(cost.status)}
                        options={costStatusOptions(cost)}
                        ariaLabel={`Đổi trạng thái chi phí ${costSummary(cost) || cost.id}`}
                        disabled={updatingStatusCostId === cost.id}
                        onChange={(status) => onStatusChange(cost, status as ProjectCostStatus)}
                      />
                    ) : (
                      <span
                        className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
                        title={
                          cost.reconciledAt
                            ? 'Khoản chi đã đối soát nên trạng thái được khóa'
                            : undefined
                        }
                      >
                        {costStatusLabel(cost)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {cost.status !== 'completed' ? (
                      <span className="text-xs font-semibold text-slate-400">
                        {cost.status === 'cancelled' ? 'Không đối soát' : 'Chờ Lead xác nhận'}
                      </span>
                    ) : cost.cidIncident?.status === 'pending' && cost.canApprove ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100"
                        title="Chi phí đã đối soát, CID đang chờ xác nhận số tiền đã chạy"
                        onClick={() => setConfirmCidTarget(cost)}
                      >
                        <WarningAmberRoundedIcon className="!text-[15px]" />
                        CID chờ xác nhận
                      </button>
                    ) : cost.cidIncident?.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                        <WarningAmberRoundedIcon className="!text-[15px]" />
                        CID chờ xác nhận
                      </span>
                    ) : cost.reconciledAt && cost.canApprove ? (
                      <button
                        type="button"
                        disabled={isReconciling}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Mở lại để chỉnh sửa kết quả đối soát"
                        onClick={() => openReconcileDialog(cost)}
                      >
                        <CheckCircleRoundedIcon className="!text-[16px]" />
                        Đã khớp
                      </button>
                    ) : cost.reconciledAt ? (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                        title={`Đã khớp lúc ${formatDateTime(cost.reconciledAt)}${cost.invoiceNumber ? ` · Hóa đơn ${cost.invoiceNumber}` : ''}`}
                      >
                        <CheckCircleRoundedIcon className="!text-[16px]" />
                        Đã khớp
                      </span>
                    ) : cost.canApprove ? (
                      <button
                        type="button"
                        disabled={isReconciling}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-amber-50 hover:text-amber-700 hover:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => openReconcileDialog(cost)}
                      >
                        <CheckCircleOutlineRoundedIcon className="!text-[16px]" />
                        Chưa khớp
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        <CheckCircleOutlineRoundedIcon className="!text-[16px]" />
                        Chưa khớp
                      </span>
                    )}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center justify-end gap-1 pr-3">
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
        {activeCost ? (
          <>
            {activeCost.cidIncident?.status === 'pending' && activeCost.canApprove ? (
              <MenuItem
                className="!text-amber-700"
                onClick={() => {
                  setConfirmCidTarget(activeCost);
                  closeActionMenu();
                }}
              >
                <CheckCircleRoundedIcon fontSize="small" className="mr-2" />
                Xác nhận CID ngừng
              </MenuItem>
            ) : null}
            {activeCost.canApprove && activeCost.status === 'completed' ? (
              <MenuItem
                onClick={() => {
                  openReconcileDialog(activeCost);
                  closeActionMenu();
                }}
              >
                <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
                {activeCost.reconciledAt ? 'Chỉnh sửa đối soát' : 'Đối soát khoản chi'}
              </MenuItem>
            ) : null}
            <MenuItem
              component={Link}
              href={`/projects/${activeCost.projectId}`}
              onClick={closeActionMenu}
            >
              <OpenInNewRoundedIcon fontSize="small" className="mr-2 text-blue-600" />
              Mở dự án
            </MenuItem>
          </>
        ) : null}
      </Menu>

      <CostDetailDialog
        cost={viewTarget}
        confirmingCid={isConfirmingCid}
        onClose={() => setViewTarget(null)}
        onConfirmCid={(cost) => setConfirmCidTarget(cost)}
      />

      <CostReconciliationDialog
        key={reconcileTarget?.id || 'empty'}
        cost={reconcileTarget}
        loading={isReconciling}
        onClose={closeReconcileDialog}
        onSubmit={(payload) => onReconcile(reconcileTarget!.id, payload)}
      />

      <CidIncidentConfirmDialog
        key={confirmCidTarget?.id || 'empty'}
        cost={confirmCidTarget}
        loading={isConfirmingCid}
        onClose={() => {
          if (!isConfirmingCid) setConfirmCidTarget(null);
        }}
        onSubmit={async (costId) => {
          const updatedCost = await onConfirmCid(costId);
          if (viewTarget?.id === updatedCost.id) setViewTarget(updatedCost);
          return updatedCost;
        }}
      />
    </div>
  );
}
