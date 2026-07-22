'use client';

import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CallMadeRoundedIcon from '@mui/icons-material/CallMadeRounded';
import CallReceivedRoundedIcon from '@mui/icons-material/CallReceivedRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { Button, IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { getPaymentDisplayStatus } from '@/lib/payment-display-status';
import { canManagePayments } from '@/lib/ownership';
import { PageHeader } from '@/components/shell/page-header';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import type {
  Payment,
  PaymentAllocation,
  PaymentAllocationInput,
  PaymentFilters,
  PaymentLinkInput,
  PaymentReceiptType,
  PaymentRefund,
  PaymentRefundFilters,
  PaymentRefundInput,
  PaymentRefundType,
  PaymentRefundUpdateInput,
} from '@/types/payment';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { User } from '@/types/user';
import { PaymentRefundPanel } from '@/features/payments/components/payment-refund-panel';

type PaymentManagerProps = {
  payments: Payment[];
  refunds: PaymentRefund[];
  activeTab: 'incoming' | 'refunds';
  filters: PaymentFilters;
  refundFilters: PaymentRefundFilters;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  refundPage: number;
  refundTotalPages: number;
  refundTotalItems: number;
  refundPageSize: number;
  isFetching: boolean;
  isRefundsFetching: boolean;
  isMutating: boolean;
  currentUser: User | null;
  onTabChange: (tab: 'incoming' | 'refunds') => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: PaymentFilters) => void;
  onRefundPageChange: (page: number) => void;
  onRefundPageSizeChange: (pageSize: number) => void;
  onRefundFiltersChange: (filters: PaymentRefundFilters) => void;
  onAllocate: (paymentId: number, allocations: PaymentAllocationInput[]) => Promise<Payment>;
  onRefund: (paymentId: number, values: PaymentRefundInput) => Promise<Payment>;
  onUpdateRefund: (refundId: number, values: PaymentRefundUpdateInput) => Promise<PaymentRefund>;
  onDeleteRefund: (refundId: number) => Promise<void>;
  onLink: (paymentId: number, values: PaymentLinkInput) => Promise<Payment>;
  onRemoveAllocation: (paymentId: number, allocationId: number) => Promise<Payment>;
};

const reconciledStatusLabels: Record<string, string> = {
  unmatched: 'Chưa đối soát',
  matched_customer: 'Đã gắn khách hàng',
  matched_quotation: 'Đã gắn báo phí',
  matched_project: 'Đã gắn dự án',
  allocated: 'Đã phân bổ',
  non_customer: 'Không phải khoản thu',
};

const refundTypeLabels: Record<string, string> = {
  deposit: 'Hoàn cọc',
  payment: 'Hoàn thanh toán',
  overpayment: 'Hoàn tiền thừa',
  compensation: 'Bù thêm cho khách',
};

const refundStatusLabels: Record<string, string> = {
  pending: 'Chờ chuyển',
  completed: 'Đã chuyển',
  cancelled: 'Đã hủy',
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function todayString() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

function getTransferMoment(payment: Payment) {
  const value = payment.transactionAt || payment.transactionDate || '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (!match) return { full: value || '-' };

  const date = `${match[3]}/${match[2]}/${match[1]}`;
  const time = match[4] ? `${match[4]}:${match[5]}${match[6] ? `:${match[6]}` : ''}` : '';

  return { full: time ? `${date} · ${time}` : date };
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
}

function statusClass(status?: string | null) {
  if (status === 'collection_partial' || status === 'collection_unpaid') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (status === 'collection_paid') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (status === 'collection_overpaid') {
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }
  if (status === 'collection_partially_refunded' || status === 'collection_refunded') {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (status === 'collection_compensated' || status === 'collection_refunded_with_compensation') {
    return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200';
  }
  if (status === 'unmatched' || status === 'unallocated') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
  if (status === 'partially_allocated' || status === 'paid_with_excess' || status === 'overpaid') {
    return 'bg-violet-50 text-violet-700 ring-violet-200';
  }
  if (status === 'allocated' || status === 'paid') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (
    status === 'partially_refunded' ||
    status === 'allocated_and_refunded' ||
    status === 'refunded'
  ) {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (status === 'non_customer') return 'bg-slate-100 text-slate-600 ring-slate-200';
  if (status === 'matched_project') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'matched_quotation' || status === 'matched_customer') {
    return 'bg-blue-50 text-blue-700 ring-blue-200';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px,minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '-'}</dd>
    </div>
  );
}

function PaymentMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red' | 'violet';
}) {
  const toneClass = {
    default: 'text-slate-950',
    green: 'text-emerald-700',
    red: 'text-rose-700',
    violet: 'text-violet-700',
  }[tone];

  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-base font-extrabold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function paymentQuotations(payment: Payment) {
  const allocations = payment.allocations || [];
  const quotations = new Map<
    number,
    {
      quotationId: number;
      quotation: PaymentAllocation['quotation'] | Payment['quotation'];
    }
  >();

  allocations.forEach((allocation) => {
    if (!quotations.has(allocation.quotationId)) {
      quotations.set(allocation.quotationId, {
        quotationId: allocation.quotationId,
        quotation: allocation.quotation,
      });
    }
  });

  if (payment.quotation && !quotations.has(payment.quotation.id)) {
    quotations.set(payment.quotation.id, {
      quotationId: payment.quotation.id,
      quotation: payment.quotation,
    });
  }

  return [...quotations.values()];
}

function paymentProjects(payment: Payment) {
  const projects = (payment.allocations || [])
    .map((allocation) => allocation.quotation?.project)
    .filter((project): project is NonNullable<typeof project> => Boolean(project));

  if (payment.project) projects.unshift(payment.project);

  return [...new Map(projects.map((project) => [project.id, project])).values()];
}

function canCreateCustomerReturn(payment: Payment) {
  if (payment.receiptType === 'internal' || payment.receiptType === 'other') return false;

  return (
    Number(payment.availableAmount ?? payment.unallocatedAmount) > 0 ||
    (payment.allocations || []).some(
      (allocation) =>
        Number(allocation.refundableAmount) > 0 || Number(allocation.depositRefundableAmount) > 0,
    ) ||
    Boolean(payment.customerId || payment.projectId || payment.quotationId)
  );
}

type PaymentTableGroup = {
  key: string;
  payments: Payment[];
};

function paymentQuotationIds(payment: Payment) {
  return [
    ...new Set(
      [
        ...(payment.allocations || []).map((allocation) => allocation.quotationId),
        payment.quotationId,
        payment.quotation?.id,
      ].filter((id): id is number => Boolean(id)),
    ),
  ];
}

function groupPaymentsByQuotation(payments: Payment[]): PaymentTableGroup[] {
  const groups = new Map<string, PaymentTableGroup>();

  payments.forEach((payment) => {
    const quotationIds = paymentQuotationIds(payment);
    const key =
      quotationIds.length === 1 ? `quotation:${quotationIds[0]}` : `payment:${payment.id}`;
    const group = groups.get(key);

    if (group) {
      group.payments.push(payment);
    } else {
      groups.set(key, { key, payments: [payment] });
    }
  });

  return [...groups.values()];
}

function groupCollectionStatus(group: PaymentTableGroup, differenceAmount: number | null) {
  if (group.key.startsWith('quotation:') && differenceAmount !== null) {
    const collectionPayment = group.payments.find((payment) => payment.collectionStatus);
    const collectionStatus = collectionPayment?.collectionStatus;
    const compensationAmount = Number(collectionPayment?.collectionCompensationAmount) || 0;

    if (collectionStatus === 'refunded') {
      return compensationAmount > 0
        ? { key: 'collection_refunded_with_compensation', label: 'Đã hoàn + bù thêm' }
        : { key: 'collection_refunded', label: 'Đã hoàn toàn bộ' };
    }
    if (collectionStatus === 'partially_refunded') {
      return compensationAmount > 0
        ? { key: 'collection_compensated', label: 'Đã hoàn một phần · Có bù' }
        : { key: 'collection_partially_refunded', label: 'Đã hoàn một phần' };
    }
    if (
      collectionStatus === 'paid' &&
      Number(collectionPayment?.collectionDepositRefundedAmount) > 0
    ) {
      return compensationAmount > 0
        ? { key: 'collection_compensated', label: 'Hoàn cọc · Có bù' }
        : { key: 'collection_paid', label: 'Đã thu đủ · Hoàn cọc' };
    }
    if (differenceAmount > 0.01) {
      return compensationAmount > 0
        ? { key: 'collection_compensated', label: 'Chuyển thừa · Có bù' }
        : { key: 'collection_overpaid', label: 'Chuyển thừa' };
    }
    if (differenceAmount < -0.01) {
      return compensationAmount > 0
        ? { key: 'collection_compensated', label: 'Đang thiếu · Có bù' }
        : { key: 'collection_partial', label: 'Đang thiếu' };
    }

    return compensationAmount > 0
      ? { key: 'collection_compensated', label: 'Đã thu đủ · Có bù' }
      : { key: 'collection_paid', label: 'Đã thu đủ' };
  }

  return getPaymentDisplayStatus(group.payments[0]);
}

function formatDifference(value: number | null) {
  if (value === null) return '-';
  if (Math.abs(value) <= 0.01) return formatCurrency(0);

  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
}

function differenceClass(value: number | null) {
  if (value === null) return 'text-slate-400';
  if (value > 0.01) return 'text-violet-700';
  if (value < -0.01) return 'text-amber-700';
  return 'text-emerald-700';
}

function PaymentDetailDialog({
  payment,
  isMutating,
  currentUser,
  onClose,
  onAllocate,
  onRefund,
  onLink,
  onRemoveAllocation,
}: {
  payment: Payment | null;
  isMutating: boolean;
  currentUser: User | null;
  onClose: () => void;
  onAllocate: () => void;
  onRefund: () => void;
  onLink: () => void;
  onRemoveAllocation: (allocation: PaymentAllocation) => void;
}) {
  if (!payment) return null;

  const canManage = canManagePayments(currentUser);
  const transferMoment = getTransferMoment(payment);
  const allocations = payment.allocations || [];
  const refunds = payment.refunds || [];
  const availableAmount = Number(payment.availableAmount ?? payment.unallocatedAmount) || 0;
  const canHandleBalance = payment.receiptType !== 'internal' && payment.receiptType !== 'other';
  const displayStatus = getPaymentDisplayStatus(payment);

  return (
    <AppDetailDialog
      open
      maxWidth="lg"
      title={formatCurrency(payment.amount)}
      eyebrow={payment.reference || `Giao dịch #${payment.id}`}
      subtitle={transferMoment.full}
      onClose={onClose}
      actions={
        <>
          <DialogActionButton
            startIcon={<LinkRoundedIcon />}
            disabled={isMutating || !canManage}
            onClick={onLink}
          >
            Gắn dự án
          </DialogActionButton>
          {canCreateCustomerReturn(payment) ? (
            <DialogActionButton
              startIcon={<ReplyRoundedIcon />}
              disabled={isMutating || !canManage}
              onClick={onRefund}
            >
              Trả khách
            </DialogActionButton>
          ) : null}
          {canHandleBalance && availableAmount > 0 ? (
            <DialogActionButton
              tone="primary"
              startIcon={<CallSplitRoundedIcon />}
              disabled={isMutating || !canManage}
              onClick={onAllocate}
            >
              Phân bổ
            </DialogActionButton>
          ) : null}
        </>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-4">
        <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-slate-200">
          <PaymentMetric label="Tiền nhận" value={formatCurrency(payment.amount)} tone="green" />
          <PaymentMetric label="Đã phân bổ" value={formatCurrency(payment.allocatedAmount)} />
          <PaymentMetric
            label="Đã trả khách"
            value={formatCurrency(payment.refundedAmount)}
            tone="red"
          />
          <PaymentMetric
            label="Bù thêm"
            value={formatCurrency(payment.compensationAmount)}
            tone="violet"
          />
          <PaymentMetric label="Chưa xử lý" value={formatCurrency(availableAmount)} tone="violet" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-950">
              Phân bổ báo phí ({allocations.length})
            </h3>
          </div>
          {allocations.length === 0 ? (
            <p className="px-4 py-5 text-sm font-medium text-slate-500">
              Chưa phân bổ vào báo phí nào.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {allocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px_40px]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/quotations/${allocation.quotationId}`}
                      className="truncate text-sm font-extrabold text-primary hover:underline"
                    >
                      {allocation.quotation?.quotationCode || `Báo phí #${allocation.quotationId}`}
                    </Link>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">
                      {allocation.quotation?.project?.projectCode ||
                        allocation.quotation?.customer?.customerCode ||
                        'Chưa gắn dự án'}
                    </p>
                  </div>
                  <p className="text-left text-sm font-extrabold tabular-nums text-emerald-700 sm:text-right">
                    {formatCurrency(allocation.amount)}
                  </p>
                  <IconButton
                    size="small"
                    title="Hủy phân bổ"
                    aria-label={`Hủy phân bổ ${allocation.quotation?.quotationCode || allocation.id}`}
                    disabled={isMutating || !canManage}
                    onClick={() => onRemoveAllocation(allocation)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </section>

        {refunds.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-rose-200 bg-white">
            <div className="border-b border-rose-100 px-4 py-3">
              <h3 className="text-sm font-bold text-rose-800">
                Lịch sử trả khách ({refunds.length})
              </h3>
            </div>
            <div className="divide-y divide-rose-100">
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="grid items-center gap-2 px-4 py-3 text-sm sm:grid-cols-[150px_150px_110px_minmax(0,1fr)]"
                >
                  <span
                    className={`font-extrabold tabular-nums ${
                      refund.refundType === 'compensation' ? 'text-fuchsia-700' : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(refund.amount)}
                  </span>
                  <span className="font-medium text-slate-600">
                    {refundTypeLabels[refund.refundType] || refund.refundType}
                  </span>
                  <span
                    className={`inline-flex w-fit whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                      refund.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : refund.status === 'cancelled'
                          ? 'bg-slate-100 text-slate-500 ring-slate-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}
                  >
                    {refundStatusLabels[refund.status] || refund.status}
                  </span>
                  <span className="truncate font-medium text-slate-600" title={refund.reason || ''}>
                    {formatDateTime(refund.scheduledAt || refund.refundedAt)}
                    {' · '}
                    {refund.reason || refund.reference || refund.note || 'Không có ghi chú'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-5">
          <dl>
            <DetailRow label="Thời gian chuyển" value={transferMoment.full} />
            <DetailRow
              label="Tài khoản nhận"
              value={[payment.bankGateway, payment.bankAccount].filter(Boolean).join(' · ') || '-'}
            />
            <DetailRow
              label="Nội dung chuyển khoản"
              value={
                <span className="select-all font-mono text-[13px] text-slate-800">
                  {payment.transactionContent || '-'}
                </span>
              }
            />
            <DetailRow
              label={
                displayStatus.key.startsWith('collection_') ? 'Công nợ báo phí' : 'Trạng thái xử lý'
              }
              value={
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(displayStatus.key)}`}
                  >
                    {displayStatus.label}
                  </span>
                  {displayStatus.outstandingAmount ? (
                    <span className="whitespace-nowrap text-xs font-bold tabular-nums text-amber-700">
                      Còn {formatCurrency(displayStatus.outstandingAmount)}
                    </span>
                  ) : null}
                </div>
              }
            />
            <DetailRow label="Đối soát lúc" value={formatDateTime(payment.matchedAt)} />
          </dl>
        </section>
      </div>
    </AppDetailDialog>
  );
}

type AllocationDraft = {
  key: number;
  quotation: Quotation | null;
  amount: string;
  note: string;
};

function AllocationDialog({
  payment,
  submitting,
  onClose,
  onSubmit,
}: {
  payment: Payment | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentAllocationInput[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<AllocationDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const available = Number(payment?.availableAmount ?? payment?.unallocatedAmount) || 0;
    setRows(
      payment
        ? [{ key: Date.now(), quotation: null, amount: String(available || ''), note: '' }]
        : [],
    );
    setError('');
  }, [payment]);

  if (!payment) return null;

  const availableAmount = Number(payment.availableAmount ?? payment.unallocatedAmount) || 0;
  const totalDraft = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const updateRow = (key: number, values: Partial<AllocationDraft>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...values } : row)));
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedRows = rows.filter((row) => row.quotation && Number(row.amount) > 0);

    if (selectedRows.length !== rows.length || rows.length === 0) {
      setError('Cần chọn báo phí và nhập số tiền cho từng dòng.');
      return;
    }
    if (new Set(selectedRows.map((row) => row.quotation?.id)).size !== selectedRows.length) {
      setError('Một báo phí chỉ nên xuất hiện một lần trong giao dịch.');
      return;
    }
    if (totalDraft > availableAmount) {
      setError(`Tổng phân bổ không được vượt quá ${formatCurrency(availableAmount)}.`);
      return;
    }

    await onSubmit(
      selectedRows.map((row) => ({
        quotationId: row.quotation!.id,
        amount: Number(row.amount),
        note: row.note.trim() || undefined,
      })),
    );
  };

  return (
    <AppFormDialog
      open
      title="Phân bổ khoản thu"
      maxWidth="md"
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit}
      actions={
        <>
          <DialogActionButton disabled={submitting} onClick={onClose}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu phân bổ'}
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
          <PaymentMetric label="Tiền nhận" value={formatCurrency(payment.amount)} />
          <PaymentMetric
            label="Có thể phân bổ"
            value={formatCurrency(availableAmount)}
            tone="violet"
          />
          <PaymentMetric
            label="Đang nhập"
            value={formatCurrency(totalDraft)}
            tone={totalDraft > availableAmount ? 'red' : 'green'}
          />
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid items-start gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_180px_40px]"
            >
              <ServerPaginatedAutocomplete<Quotation>
                endpoint="/quotations"
                queryKey={['quotations', 'payment-allocation-options']}
                label={`Báo phí ${index + 1}`}
                value={row.quotation}
                required
                getOptionLabel={(quotation) =>
                  `${quotation.quotationCode || `#${quotation.id}`} · Còn ${formatCurrency(quotation.outstandingAmount)}`
                }
                onChange={(quotation) => updateRow(row.key, { quotation })}
              />
              <MoneyInput
                label="Số tiền phân bổ"
                value={row.amount}
                required
                size="small"
                className={compactFormFieldClassName}
                onValueChange={(amount) => updateRow(row.key, { amount })}
              />
              <IconButton
                title="Xóa dòng"
                aria-label={`Xóa dòng phân bổ ${index + 1}`}
                disabled={rows.length === 1 || submitting}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
              <FormInputField
                className="md:col-span-2"
                label="Ghi chú phân bổ"
                value={row.note}
                onChange={(event) => updateRow(row.key, { note: event.target.value })}
              />
            </div>
          ))}
        </div>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddRoundedIcon />}
          disabled={submitting}
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: Date.now(), quotation: null, amount: '', note: '' },
            ])
          }
        >
          Thêm báo phí
        </Button>
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            {error}
          </p>
        ) : null}
      </div>
    </AppFormDialog>
  );
}

function RefundDialog({
  payment,
  submitting,
  onClose,
  onSubmit,
}: {
  payment: Payment | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentRefundInput) => Promise<void>;
}) {
  const [refundType, setRefundType] = useState<PaymentRefundType>('overpayment');
  const [allocationId, setAllocationId] = useState<number | null>(null);
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [amount, setAmount] = useState('');
  const [scheduledAt, setScheduledAt] = useState(todayString());
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const allocations = payment?.allocations || [];
    const depositAllocation = allocations.find(
      (allocation) => Number(allocation.depositRefundableAmount) > 0,
    );
    const paymentAllocation = allocations.find(
      (allocation) => Number(allocation.refundableAmount) > 0,
    );
    const overpaymentAmount = Number(payment?.availableAmount ?? payment?.unallocatedAmount) || 0;
    const initialType: PaymentRefundType =
      overpaymentAmount > 0
        ? 'overpayment'
        : depositAllocation
          ? 'deposit'
          : paymentAllocation
            ? 'payment'
            : 'compensation';
    const initialAllocation = initialType === 'deposit' ? depositAllocation : paymentAllocation;
    const initialAmount =
      initialType === 'overpayment'
        ? overpaymentAmount
        : initialType === 'deposit'
          ? Number(initialAllocation?.depositRefundableAmount) || 0
          : initialType === 'payment'
            ? Number(initialAllocation?.refundableAmount) || 0
            : 0;

    setRefundType(initialType);
    setAllocationId(initialAllocation?.id || null);
    setStatus('pending');
    setAmount(String(initialAmount || ''));
    setScheduledAt(todayString());
    setRecipientName('');
    setRecipientAccount('');
    setRecipientBank('');
    setReason('');
    setReference('');
    setNote('');
    setError('');
  }, [payment]);

  if (!payment) return null;

  const allocations = payment.allocations || [];
  const selectedAllocation =
    allocations.find((allocation) => allocation.id === allocationId) || null;
  const overpaymentAmount = Number(payment.availableAmount ?? payment.unallocatedAmount) || 0;
  const availableAmount =
    refundType === 'overpayment'
      ? overpaymentAmount
      : refundType === 'deposit'
        ? Number(selectedAllocation?.depositRefundableAmount) || 0
        : refundType === 'payment'
          ? Number(selectedAllocation?.refundableAmount) || 0
          : null;
  const refundTypeOptions = [
    ...(overpaymentAmount > 0 ? [{ value: 'overpayment', label: 'Hoàn tiền chuyển thừa' }] : []),
    ...(allocations.some((allocation) => Number(allocation.depositRefundableAmount) > 0)
      ? [{ value: 'deposit', label: 'Hoàn tiền cọc' }]
      : []),
    ...(allocations.some((allocation) => Number(allocation.refundableAmount) > 0)
      ? [{ value: 'payment', label: 'Hoàn khoản đã thanh toán' }]
      : []),
    ...(payment.customerId || payment.projectId || payment.quotationId || allocations.length > 0
      ? [{ value: 'compensation', label: 'Bù thêm ngoài tiền khách đã nộp' }]
      : []),
  ];

  const changeRefundType = (nextType: PaymentRefundType) => {
    const nextAllocation =
      nextType === 'deposit'
        ? allocations.find((allocation) => Number(allocation.depositRefundableAmount) > 0)
        : nextType === 'payment'
          ? allocations.find((allocation) => Number(allocation.refundableAmount) > 0)
          : null;
    const nextAmount =
      nextType === 'overpayment'
        ? overpaymentAmount
        : nextType === 'deposit'
          ? Number(nextAllocation?.depositRefundableAmount) || 0
          : nextType === 'payment'
            ? Number(nextAllocation?.refundableAmount) || 0
            : 0;

    setRefundType(nextType);
    setAllocationId(nextAllocation?.id || null);
    setAmount(String(nextAmount || ''));
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const refundAmount = Number(amount) || 0;

    if ((refundType === 'deposit' || refundType === 'payment') && !selectedAllocation) {
      setError('Cần chọn báo phí đã nhận tiền.');
      return;
    }
    if (refundAmount <= 0 || (availableAmount !== null && refundAmount > availableAmount)) {
      setError(
        availableAmount === null
          ? 'Số tiền bù thêm phải lớn hơn 0.'
          : `Số tiền trả khách phải từ 1 đ đến ${formatCurrency(availableAmount)}.`,
      );
      return;
    }
    if (!reason.trim()) {
      setError('Cần nhập lý do trả khách để dễ đối soát về sau.');
      return;
    }

    await onSubmit({
      paymentAllocationId: selectedAllocation?.id || null,
      refundType,
      status,
      amount: refundAmount,
      scheduledAt,
      refundedAt: status === 'completed' ? scheduledAt : undefined,
      recipientName: recipientName.trim() || undefined,
      recipientAccount: recipientAccount.trim() || undefined,
      recipientBank: recipientBank.trim() || undefined,
      reason: reason.trim(),
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <AppFormDialog
      open
      title="Tạo khoản trả khách"
      maxWidth="md"
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit}
      actions={
        <>
          <DialogActionButton disabled={submitting} onClick={onClose}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={submitting}>
            {submitting
              ? 'Đang lưu...'
              : status === 'completed'
                ? 'Lưu đã chuyển'
                : 'Tạo khoản chờ trả'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:col-span-2 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
          <PaymentMetric label="Tiền vào gốc" value={formatCurrency(payment.amount)} />
          <PaymentMetric label="Đã phân bổ" value={formatCurrency(payment.allocatedAmount)} />
          <PaymentMetric
            label="Đã trả khách"
            value={formatCurrency(payment.refundedAmount)}
            tone="red"
          />
        </div>
        <FormSelectField
          label="Loại trả khách"
          value={refundType}
          required
          onChange={(event) => changeRefundType(event.target.value as PaymentRefundType)}
        >
          {refundTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </FormSelectField>
        <FormSelectField
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value as 'pending' | 'completed')}
        >
          <MenuItem value="pending">Chờ chuyển tiền</MenuItem>
          <MenuItem value="completed">Đã chuyển tiền</MenuItem>
        </FormSelectField>
        {refundType === 'deposit' || refundType === 'payment' ? (
          <FormSelectField
            className="sm:col-span-2"
            label="Báo phí nhận tiền"
            value={allocationId || ''}
            required
            onChange={(event) => {
              const nextId = Number(event.target.value) || null;
              const next = allocations.find((allocation) => allocation.id === nextId);
              setAllocationId(nextId);
              setAmount(
                String(
                  refundType === 'deposit'
                    ? Number(next?.depositRefundableAmount) || ''
                    : Number(next?.refundableAmount) || '',
                ),
              );
              setError('');
            }}
          >
            {allocations
              .filter(
                (allocation) =>
                  Number(
                    refundType === 'deposit'
                      ? allocation.depositRefundableAmount
                      : allocation.refundableAmount,
                  ) > 0,
              )
              .map((allocation) => (
                <MenuItem key={allocation.id} value={allocation.id}>
                  {allocation.quotation?.quotationCode || `Báo phí #${allocation.quotationId}`}
                  {' · Có thể hoàn '}
                  {formatCurrency(
                    refundType === 'deposit'
                      ? allocation.depositRefundableAmount
                      : allocation.refundableAmount,
                  )}
                </MenuItem>
              ))}
          </FormSelectField>
        ) : null}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 sm:col-span-2">
          <span className="text-sm font-semibold text-blue-700">
            {availableAmount === null
              ? 'Chỉ nhập phần bù thêm ngoài tiền khách đã chuyển. Khoản này không làm giảm công nợ báo phí.'
              : 'Có thể trả theo lựa chọn: '}
          </span>
          {availableAmount !== null ? (
            <span className="text-sm font-extrabold tabular-nums text-blue-800">
              {formatCurrency(availableAmount)}
            </span>
          ) : null}
        </div>
        <MoneyInput
          label={refundType === 'compensation' ? 'Số tiền bù thêm' : 'Số tiền trả khách'}
          value={amount}
          required
          size="small"
          className={compactFormFieldClassName}
          onValueChange={(value) => {
            setAmount(value);
            setError('');
          }}
        />
        <FormDatePicker
          label={status === 'completed' ? 'Ngày chuyển' : 'Ngày dự kiến trả'}
          value={scheduledAt}
          required
          onChange={setScheduledAt}
        />
        <FormInputField
          className="sm:col-span-2"
          label="Lý do trả khách *"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError('');
          }}
        />
        <FormInputField
          label="Người nhận"
          value={recipientName}
          onChange={(event) => setRecipientName(event.target.value)}
        />
        <FormInputField
          label="Ngân hàng nhận"
          value={recipientBank}
          onChange={(event) => setRecipientBank(event.target.value)}
        />
        <FormInputField
          label="Tài khoản nhận"
          value={recipientAccount}
          onChange={(event) => setRecipientAccount(event.target.value)}
        />
        {status === 'completed' ? (
          <FormInputField
            label="Mã giao dịch / tham chiếu"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        ) : null}
        <FormInputField
          className={status === 'completed' ? '' : 'sm:col-span-2'}
          label="Ghi chú"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 sm:col-span-2"
          >
            {error}
          </p>
        ) : null}
      </div>
    </AppFormDialog>
  );
}

function LinkPaymentDialog({
  payment,
  submitting,
  onClose,
  onSubmit,
}: {
  payment: Payment | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentLinkInput) => Promise<void>;
}) {
  const [receiptType, setReceiptType] = useState<PaymentReceiptType>('customer');
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setReceiptType(payment?.receiptType || 'customer');
    setProject(null);
    setError('');
  }, [payment]);

  if (!payment) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (receiptType === 'customer' && !project && !payment.projectId) {
      setError('Cần chọn dự án cho khoản thu chưa xác định.');
      return;
    }

    await onSubmit({
      receiptType,
      projectId: receiptType === 'customer' ? (project?.id ?? payment.projectId ?? null) : null,
      customerId:
        receiptType === 'customer' ? (project?.customerId ?? payment.customerId ?? null) : null,
    });
  };

  return (
    <AppFormDialog
      open
      title="Gắn dự án và phân loại"
      maxWidth="sm"
      submitting={submitting}
      onClose={onClose}
      onSubmit={handleSubmit}
      actions={
        <>
          <DialogActionButton disabled={submitting} onClick={onClose}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu phân loại'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4">
        <FormSelectField
          label="Loại giao dịch"
          value={receiptType}
          onChange={(event) => {
            setReceiptType(event.target.value as PaymentReceiptType);
            setError('');
          }}
        >
          <MenuItem value="customer">Khoản thu khách hàng</MenuItem>
          <MenuItem value="internal">Chuyển tiền nội bộ</MenuItem>
          <MenuItem value="other">Khoản tiền khác</MenuItem>
        </FormSelectField>

        {receiptType === 'customer' ? (
          <>
            <ServerPaginatedAutocomplete<ProjectItem>
              endpoint="/projects"
              queryKey={['projects', 'payment-link-options']}
              label="Dự án"
              value={project}
              required={!payment.projectId}
              getOptionLabel={(option) => option.projectCode || `Dự án #${option.id}`}
              onChange={(value) => {
                setProject(value);
                setError('');
              }}
            />
            {payment.project ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
                Đang gắn: <strong>{payment.project.projectCode}</strong>
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Giao dịch sẽ được loại khỏi khoản thu khách hàng và không thể phân bổ báo phí.
          </p>
        )}
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            {error}
          </p>
        ) : null}
      </div>
    </AppFormDialog>
  );
}

export function PaymentManager({
  payments,
  refunds,
  activeTab,
  filters,
  refundFilters,
  page,
  totalPages,
  totalItems,
  pageSize,
  refundPage,
  refundTotalPages,
  refundTotalItems,
  refundPageSize,
  isFetching,
  isRefundsFetching,
  isMutating,
  currentUser,
  onTabChange,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onRefundPageChange,
  onRefundPageSizeChange,
  onRefundFiltersChange,
  onAllocate,
  onRefund,
  onUpdateRefund,
  onDeleteRefund,
  onLink,
  onRemoveAllocation,
}: PaymentManagerProps) {
  const [viewTarget, setViewTarget] = useState<Payment | null>(null);
  const [allocationTarget, setAllocationTarget] = useState<Payment | null>(null);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [linkTarget, setLinkTarget] = useState<Payment | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    payment: Payment;
    allocation: PaymentAllocation;
  } | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const paymentGroups = groupPaymentsByQuotation(payments);

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, payment: Payment) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePayment(payment);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePayment(null);
  };

  const updateFilters = (nextFilters: Partial<PaymentFilters>) => {
    onFiltersChange({ ...filters, ...nextFilters });
  };

  const applyUpdatedPayment = (updated: Payment) => {
    setViewTarget((current) => (current?.id === updated.id ? updated : current));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="Thanh toán" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <IconTabs
          value={activeTab === 'incoming' ? 0 : 1}
          ariaLabel="Luồng tiền thanh toán"
          items={[
            { label: 'Tiền nhận vào', icon: <CallReceivedRoundedIcon fontSize="small" /> },
            { label: 'Tiền hoàn ra', icon: <CallMadeRoundedIcon fontSize="small" /> },
          ]}
          onChange={(value) => onTabChange(value === 0 ? 'incoming' : 'refunds')}
        />
        {activeTab === 'incoming' ? (
          <>
            <div className="border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(4,176px)]">
                <CompactSearchField
                  label="Từ khóa"
                  placeholder="Nội dung, mã báo phí, dự án, tham chiếu..."
                  value={filters.keyword}
                  onChange={(keyword) => updateFilters({ keyword })}
                />
                <CompactSelectField
                  label="Trạng thái xử lý"
                  value={filters.status}
                  options={[
                    { value: 'unmatched', label: 'Chờ đối soát' },
                    { value: 'matched_project', label: 'Đã gắn dự án' },
                    { value: 'paid_with_excess', label: 'Đã phân bổ + chuyển thừa' },
                    { value: 'overpaid', label: 'Chuyển thừa' },
                    { value: 'allocated', label: 'Đã phân bổ giao dịch' },
                    { value: 'partially_refunded', label: 'Đã trả khách một phần' },
                    { value: 'allocated_and_refunded', label: 'Đã phân bổ & trả khách' },
                    { value: 'refunded', label: 'Đã trả lại toàn bộ' },
                    { value: 'non_customer', label: 'Không phải khoản thu' },
                  ]}
                  onChange={(status) => updateFilters({ status })}
                />
                <CompactSelectField
                  label="Đối soát"
                  value={filters.reconciled_status}
                  options={Object.entries(reconciledStatusLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={(reconciled_status) => updateFilters({ reconciled_status })}
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
                  key: 'time',
                  label: 'Thời gian',
                  className: 'sticky left-0 z-20 w-52 bg-slate-100',
                },
                { key: 'amount', label: 'Số tiền', className: 'w-44 text-right' },
                { key: 'content', label: 'Nội dung chuyển khoản', className: 'w-72' },
                { key: 'quotation', label: 'Báo phí', className: 'w-60' },
                { key: 'project', label: 'Dự án', className: 'w-56' },
                { key: 'difference', label: 'Chênh lệch', className: 'w-40 text-right' },
                { key: 'status', label: 'Công nợ / xử lý', className: 'w-40' },
                { key: 'actions', className: 'w-24' },
              ]}
              isLoading={isFetching}
              isEmpty={payments.length === 0}
              emptyText="Chưa có giao dịch thanh toán"
              minWidthClassName="min-w-[1440px]"
            >
              {paymentGroups.map((group) => {
                const quotations = [
                  ...new Map(
                    group.payments
                      .flatMap((payment) => paymentQuotations(payment))
                      .map((quotation) => [quotation.quotationId, quotation]),
                  ).values(),
                ];
                const projects = [
                  ...new Map(
                    group.payments
                      .flatMap((payment) => paymentProjects(payment))
                      .map((project) => [project.id, project]),
                  ).values(),
                ];
                const primaryQuotation = quotations[0]?.quotation;
                const primaryProject = projects[0];
                const differenceSource = group.key.startsWith('quotation:')
                  ? group.payments.find(
                      (payment) =>
                        payment.collectionDifferenceAmount !== null &&
                        payment.collectionDifferenceAmount !== undefined,
                    )
                  : undefined;
                const differenceAmount = differenceSource
                  ? Number(differenceSource.collectionDifferenceAmount) || 0
                  : null;
                const compensationAmount = differenceSource
                  ? Number(differenceSource.collectionCompensationAmount) || 0
                  : 0;
                const displayStatus = groupCollectionStatus(group, differenceAmount);
                const rowSpan = group.payments.length;

                return group.payments.map((payment, rowIndex) => {
                  const transferMoment = getTransferMoment(payment);
                  const isFirstRow = rowIndex === 0;

                  return (
                    <tr
                      key={payment.id}
                      className={
                        isFirstRow
                          ? 'group border-t-2 border-slate-200 first:border-t-0 hover:bg-slate-50/80'
                          : 'group hover:bg-slate-50/80'
                      }
                    >
                      <td className="sticky left-0 z-10 bg-white px-3 py-3.5 font-semibold tabular-nums text-slate-800 group-hover:bg-slate-50">
                        <span className="whitespace-nowrap">{transferMoment.full}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-extrabold tabular-nums text-emerald-700">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <p
                          className="truncate font-mono text-[13px] font-semibold text-slate-700"
                          title={payment.transactionContent || ''}
                        >
                          {payment.transactionContent || '-'}
                        </p>
                      </td>
                      {isFirstRow ? (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border-l border-slate-100 bg-slate-50/50 px-3 py-3.5 align-middle"
                          >
                            {primaryQuotation ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <EntityTableLink
                                  href={`/quotations/${primaryQuotation.id}`}
                                  tone="primary"
                                >
                                  {primaryQuotation.quotationCode || '-'}
                                </EntityTableLink>
                                {quotations.length > 1 ? (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                    +{quotations.length - 1}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="whitespace-nowrap font-semibold text-amber-700">
                                Chưa xác định
                              </span>
                            )}
                            {rowSpan > 1 ? (
                              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                {rowSpan} giao dịch
                              </p>
                            ) : null}
                          </td>
                          <td rowSpan={rowSpan} className="bg-slate-50/50 px-3 py-3.5 align-middle">
                            {primaryProject ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <EntityTableLink
                                  href={`/projects/${primaryProject.id}`}
                                  tone="blue"
                                >
                                  {primaryProject.projectCode || '-'}
                                </EntityTableLink>
                                {projects.length > 1 ? (
                                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                                    +{projects.length - 1}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="whitespace-nowrap text-slate-400">
                                Chưa gắn dự án
                              </span>
                            )}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className={`bg-slate-50/50 px-3 py-3.5 text-right align-middle font-extrabold tabular-nums ${differenceClass(differenceAmount)}`}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span className="whitespace-nowrap">
                                {formatDifference(differenceAmount)}
                              </span>
                              {compensationAmount > 0 ? (
                                <span className="whitespace-nowrap rounded bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-700 ring-1 ring-fuchsia-100">
                                  Bù thêm {formatCurrency(compensationAmount)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td rowSpan={rowSpan} className="bg-slate-50/50 px-3 py-3.5 align-middle">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(displayStatus.key)}`}
                            >
                              {displayStatus.label}
                            </span>
                          </td>
                        </>
                      ) : null}
                      <td className="py-3.5">
                        <div className="flex items-center justify-end gap-1 pr-3">
                          <IconButton
                            size="small"
                            title="Xem chi tiết"
                            aria-label={`Xem chi tiết giao dịch ${payment.reference || payment.id}`}
                            onClick={() => setViewTarget(payment)}
                          >
                            <VisibilityRoundedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Tác vụ"
                            aria-label={`Tác vụ giao dịch ${payment.reference || payment.id}`}
                            onClick={(event) => openActionMenu(event, payment)}
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
              rangeLabel="Hiển thị nhóm"
              pageSizeLabel="Số nhóm"
            />
          </>
        ) : (
          <PaymentRefundPanel
            refunds={refunds}
            filters={refundFilters}
            page={refundPage}
            totalPages={refundTotalPages}
            totalItems={refundTotalItems}
            pageSize={refundPageSize}
            isFetching={isRefundsFetching}
            isMutating={isMutating}
            onPageChange={onRefundPageChange}
            onPageSizeChange={onRefundPageSizeChange}
            onFiltersChange={onRefundFiltersChange}
            onUpdate={onUpdateRefund}
            onDelete={onDeleteRefund}
          />
        )}
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            setViewTarget(activePayment);
            closeActionMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        {activePayment?.receiptType !== 'internal' &&
        activePayment?.receiptType !== 'other' &&
        Number(activePayment?.availableAmount ?? activePayment?.unallocatedAmount) > 0 ? (
          <MenuItem
            disabled={!canManagePayments(currentUser)}
            onClick={() => {
              setAllocationTarget(activePayment);
              closeActionMenu();
            }}
          >
            <CallSplitRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Phân bổ báo phí
          </MenuItem>
        ) : null}
        <MenuItem
          disabled={!canManagePayments(currentUser)}
          onClick={() => {
            setLinkTarget(activePayment);
            closeActionMenu();
          }}
        >
          <LinkRoundedIcon fontSize="small" className="mr-2 text-sky-600" />
          Gắn dự án / Phân loại
        </MenuItem>
        {activePayment && canCreateCustomerReturn(activePayment) ? (
          <MenuItem
            disabled={!canManagePayments(currentUser)}
            onClick={() => {
              setRefundTarget(activePayment);
              closeActionMenu();
            }}
          >
            <ReplyRoundedIcon fontSize="small" className="mr-2 text-rose-600" />
            Tạo khoản trả khách
          </MenuItem>
        ) : null}
        {activePayment?.quotation ? (
          <MenuItem
            component={Link}
            href={`/quotations/${activePayment.quotation.id}`}
            onClick={closeActionMenu}
          >
            <ReceiptLongRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Mở báo phí
          </MenuItem>
        ) : null}
        {activePayment?.project ? (
          <MenuItem
            component={Link}
            href={`/projects/${activePayment.project.id}`}
            onClick={closeActionMenu}
          >
            <WorkRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
            Mở dự án
          </MenuItem>
        ) : null}
        {!activePayment?.quotation &&
        !activePayment?.project &&
        (activePayment?.allocations?.length || 0) === 0 ? (
          <MenuItem disabled>
            <AccountBalanceRoundedIcon fontSize="small" className="mr-2 text-slate-400" />
            Chưa có liên kết đối soát
          </MenuItem>
        ) : null}
      </Menu>

      <PaymentDetailDialog
        payment={viewTarget}
        isMutating={isMutating}
        currentUser={currentUser}
        onClose={() => setViewTarget(null)}
        onAllocate={() => setAllocationTarget(viewTarget)}
        onRefund={() => setRefundTarget(viewTarget)}
        onLink={() => setLinkTarget(viewTarget)}
        onRemoveAllocation={(allocation) =>
          viewTarget && setRemoveTarget({ payment: viewTarget, allocation })
        }
      />
      <AllocationDialog
        payment={allocationTarget}
        submitting={isMutating}
        onClose={() => setAllocationTarget(null)}
        onSubmit={async (values) => {
          if (!allocationTarget) return;
          const updated = await onAllocate(allocationTarget.id, values);
          applyUpdatedPayment(updated);
          setAllocationTarget(null);
        }}
      />
      <RefundDialog
        payment={refundTarget}
        submitting={isMutating}
        onClose={() => setRefundTarget(null)}
        onSubmit={async (values) => {
          if (!refundTarget) return;
          const updated = await onRefund(refundTarget.id, values);
          applyUpdatedPayment(updated);
          setRefundTarget(null);
        }}
      />
      <LinkPaymentDialog
        payment={linkTarget}
        submitting={isMutating}
        onClose={() => setLinkTarget(null)}
        onSubmit={async (values) => {
          if (!linkTarget) return;
          const updated = await onLink(linkTarget.id, values);
          applyUpdatedPayment(updated);
          setLinkTarget(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Hủy phân bổ?"
        description={`Khoản ${formatCurrency(removeTarget?.allocation.amount)} sẽ trở lại số dư chưa xử lý. Lịch sử phân bổ vẫn được lưu trong hệ thống.`}
        confirmText="Hủy phân bổ"
        loading={isMutating}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          void onRemoveAllocation(removeTarget.payment.id, removeTarget.allocation.id).then(
            (updated) => {
              applyUpdatedPayment(updated);
              setRemoveTarget(null);
            },
          );
        }}
      />
    </div>
  );
}
