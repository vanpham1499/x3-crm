'use client';

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
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
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import type {
  PaymentRefund,
  PaymentRefundFilters,
  PaymentRefundUpdateInput,
} from '@/types/payment';

type PaymentRefundPanelProps = {
  refunds: PaymentRefund[];
  filters: PaymentRefundFilters;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isFetching: boolean;
  isMutating: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFiltersChange: (filters: PaymentRefundFilters) => void;
  onUpdate: (refundId: number, values: PaymentRefundUpdateInput) => Promise<PaymentRefund>;
  onDelete: (refundId: number) => Promise<void>;
};

const TYPE_LABELS = {
  deposit: 'Hoàn cọc',
  payment: 'Hoàn thanh toán',
  overpayment: 'Hoàn tiền thừa',
  compensation: 'Bù thêm cho khách',
} as const;

const STATUS_LABELS = {
  pending: 'Chờ chuyển',
  completed: 'Đã chuyển',
  cancelled: 'Đã hủy',
} as const;

function formatCurrency(value?: string | number | null) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(parsed);
}

function todayString() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

function dateInputValue(value?: string | null) {
  if (!value) return todayString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat('en-CA').format(parsed);
}

function refundStatusLabel(refund: Pick<PaymentRefund, 'status' | 'refundType'>) {
  if (refund.status === 'cancelled') return 'Đã hủy';
  if (refund.refundType === 'compensation') {
    return refund.status === 'completed' ? 'Đã bù thêm' : 'Chờ bù thêm';
  }
  return refund.status === 'completed' ? 'Đã hoàn' : 'Chờ hoàn';
}

function statusClass(status: PaymentRefund['status'], refundType?: PaymentRefund['refundType']) {
  if (status === 'completed' && refundType === 'compensation') {
    return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200';
  }
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-500 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function CompleteRefundDialog({
  refund,
  submitting,
  onClose,
  onSubmit,
}: {
  refund: PaymentRefund | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentRefundUpdateInput) => Promise<void>;
}) {
  const [refundedAt, setRefundedAt] = useState(todayString());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  if (!refund) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      status: 'completed',
      refundedAt,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <AppFormDialog
      open
      title="Xác nhận đã chuyển tiền"
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
            {submitting ? 'Đang lưu...' : 'Xác nhận đã chuyển'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Số tiền trả khách
          </p>
          <p className="mt-1 text-lg font-black tabular-nums text-emerald-800">
            {formatCurrency(refund.amount)}
          </p>
        </div>
        <FormDatePicker label="Ngày chuyển" value={refundedAt} required onChange={setRefundedAt} />
        <FormInputField
          label="Mã giao dịch / tham chiếu"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <FormInputField
          className="sm:col-span-2"
          label="Ghi chú xác nhận"
          value={note}
          multiline
          minRows={2}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </AppFormDialog>
  );
}

function EditRefundDialog({
  refund,
  submitting,
  onClose,
  onSubmit,
}: {
  refund: PaymentRefund | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentRefundUpdateInput) => Promise<void>;
}) {
  const [refundType, setRefundType] = useState<PaymentRefund['refundType']>('payment');
  const [status, setStatus] = useState<PaymentRefund['status']>('pending');
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
    if (!refund) return;
    setRefundType(refund.refundType);
    setStatus(refund.status);
    setAmount(String(Number(refund.amount) || ''));
    setScheduledAt(dateInputValue(refund.scheduledAt || refund.refundedAt));
    setRecipientName(refund.recipientName || '');
    setRecipientAccount(refund.recipientAccount || '');
    setRecipientBank(refund.recipientBank || '');
    setReason(refund.reason || '');
    setReference(refund.reference || '');
    setNote(refund.note || '');
    setError('');
  }, [refund]);

  if (!refund) return null;

  const hasAllocation = Boolean(refund.paymentAllocationId);
  const typeOptions = [
    ...(hasAllocation && Number(refund.quotation?.depositAmount) > 0
      ? [{ value: 'deposit', label: 'Hoàn tiền cọc' }]
      : []),
    ...(hasAllocation ? [{ value: 'payment', label: 'Hoàn khoản đã thanh toán' }] : []),
    ...(refund.refundType === 'overpayment'
      ? [{ value: 'overpayment', label: 'Hoàn tiền chuyển thừa' }]
      : []),
    { value: 'compensation', label: 'Bù thêm ngoài tiền khách đã nộp' },
  ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const refundAmount = Number(amount) || 0;

    if (refundAmount <= 0) {
      setError('Số tiền phải lớn hơn 0.');
      return;
    }
    if (!reason.trim()) {
      setError('Cần nhập lý do để đối soát về sau.');
      return;
    }
    if ((refundType === 'deposit' || refundType === 'payment') && !hasAllocation) {
      setError('Khoản hoàn này chưa có báo phí nguồn. Hãy xóa và tạo lại từ giao dịch tiền vào.');
      return;
    }

    await onSubmit({
      paymentAllocationId:
        refundType === 'deposit' || refundType === 'payment'
          ? refund.paymentAllocationId || null
          : null,
      refundType,
      status,
      amount: refundAmount,
      scheduledAt,
      refundedAt: status === 'completed' ? scheduledAt : undefined,
      recipientName: recipientName.trim(),
      recipientAccount: recipientAccount.trim(),
      recipientBank: recipientBank.trim(),
      reason: reason.trim(),
      reference: reference.trim(),
      note: note.trim(),
    });
  };

  return (
    <AppFormDialog
      open
      title="Chỉnh sửa khoản trả khách"
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
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 sm:col-span-2">
          <p className="text-sm font-semibold text-blue-800">
            Sau khi lưu, công nợ báo phí và trạng thái thanh toán sẽ được tính lại ngay.
          </p>
          {refundType === 'compensation' ? (
            <p className="mt-1 text-xs font-medium text-blue-700">
              Chỉ nhập phần bù thêm ngoài tiền khách đã chuyển; khoản này không làm giảm công nợ.
            </p>
          ) : null}
        </div>
        <FormSelectField
          label="Loại trả khách"
          value={refundType}
          required
          onChange={(event) => {
            setRefundType(event.target.value as PaymentRefund['refundType']);
            setError('');
          }}
        >
          {typeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </FormSelectField>
        <FormSelectField
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value as PaymentRefund['status'])}
        >
          <MenuItem value="pending">Chờ chuyển tiền</MenuItem>
          <MenuItem value="completed">Đã chuyển tiền</MenuItem>
          <MenuItem value="cancelled">Đã hủy</MenuItem>
        </FormSelectField>
        <MoneyInput
          label={refundType === 'compensation' ? 'Số tiền bù thêm' : 'Số tiền hoàn'}
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
          label={status === 'completed' ? 'Ngày chuyển' : 'Ngày dự kiến'}
          value={scheduledAt}
          required
          onChange={setScheduledAt}
        />
        <FormInputField
          className="sm:col-span-2"
          label="Lý do *"
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
        <FormInputField
          label="Mã giao dịch / tham chiếu"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <FormInputField
          className="sm:col-span-2"
          label="Ghi chú"
          value={note}
          multiline
          minRows={2}
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

export function PaymentRefundPanel({
  refunds,
  filters,
  page,
  totalPages,
  totalItems,
  pageSize,
  isFetching,
  isMutating,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onUpdate,
  onDelete,
}: PaymentRefundPanelProps) {
  const [viewTarget, setViewTarget] = useState<PaymentRefund | null>(null);
  const [editTarget, setEditTarget] = useState<PaymentRefund | null>(null);
  const [completeTarget, setCompleteTarget] = useState<PaymentRefund | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentRefund | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRefund | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<PaymentRefund | null>(null);

  const updateFilters = (next: Partial<PaymentRefundFilters>) =>
    onFiltersChange({ ...filters, ...next });
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };
  const openMenu = (event: MouseEvent<HTMLButtonElement>, refund: PaymentRefund) => {
    setMenuAnchor(event.currentTarget);
    setMenuTarget(refund);
  };

  return (
    <>
      <div className="border-slate-200 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_176px_176px]">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Khách hàng, báo phí, dự án, tài khoản nhận..."
            value={filters.keyword}
            onChange={(keyword) => updateFilters({ keyword })}
          />
          <CompactSelectField
            label="Loại trả khách"
            value={filters.refund_type}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(refund_type) => updateFilters({ refund_type })}
          />
          <CompactSelectField
            label="Trạng thái"
            value={filters.status}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(status) => updateFilters({ status })}
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
          { key: 'date', label: 'Ngày trả', className: 'w-32' },
          { key: 'type', label: 'Loại', className: 'w-40' },
          { key: 'customer', label: 'Khách hàng', className: 'w-56' },
          { key: 'quotation', label: 'Báo phí', className: 'w-56' },
          { key: 'project', label: 'Dự án', className: 'w-56' },
          { key: 'amount', label: 'Số tiền', className: 'w-44 text-right' },
          { key: 'recipient', label: 'Người nhận', className: 'w-60' },
          { key: 'status', label: 'Trạng thái', className: 'w-36' },
          { key: 'actions', className: 'w-20' },
        ]}
        isLoading={isFetching}
        isEmpty={refunds.length === 0}
        emptyText="Chưa có khoản trả khách. Hãy tạo từ một giao dịch trong tab Tiền nhận vào."
        minWidthClassName="min-w-[1420px]"
      >
        {refunds.map((refund) => (
          <tr key={refund.id} className="hover:bg-slate-50/80">
            <td className="whitespace-nowrap px-3 py-3.5 font-semibold tabular-nums text-slate-700">
              {formatDate(
                refund.status === 'completed'
                  ? refund.completedAt || refund.refundedAt
                  : refund.scheduledAt,
              )}
            </td>
            <td className="px-3 py-3.5">
              <span className="whitespace-nowrap font-bold text-slate-800">
                {TYPE_LABELS[refund.refundType] || refund.refundType}
              </span>
            </td>
            <td className="px-3 py-3.5">
              {refund.customer ? (
                <span
                  className="block truncate font-bold text-slate-900"
                  title={refund.customer.customerName || ''}
                >
                  {[refund.customer.customerCode, refund.customer.customerName]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : (
                <span className="text-slate-400">Chưa xác định</span>
              )}
            </td>
            <td className="px-3 py-3.5">
              {refund.quotation ? (
                <EntityTableLink href={`/quotations/${refund.quotation.id}`} tone="primary">
                  {refund.quotation.quotationCode || `#${refund.quotation.id}`}
                </EntityTableLink>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td className="px-3 py-3.5">
              {refund.project ? (
                <EntityTableLink href={`/projects/${refund.project.id}`} tone="blue">
                  {refund.project.projectCode || `#${refund.project.id}`}
                </EntityTableLink>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td
              className={`whitespace-nowrap px-3 py-3.5 text-right font-black tabular-nums ${
                refund.refundType === 'compensation' ? 'text-fuchsia-700' : 'text-rose-700'
              }`}
            >
              {formatCurrency(refund.amount)}
            </td>
            <td className="px-3 py-3.5">
              <p
                className="truncate font-semibold text-slate-800"
                title={refund.recipientName || ''}
              >
                {refund.recipientName || '-'}
              </p>
              {refund.recipientAccount ? (
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {[refund.recipientBank, refund.recipientAccount].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </td>
            <td className="px-3 py-3.5">
              <span
                className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(refund.status, refund.refundType)}`}
              >
                {refundStatusLabel(refund)}
              </span>
            </td>
            <td className="px-3 py-3.5 text-right">
              <div className="flex justify-end gap-1">
                <IconButton size="small" title="Xem chi tiết" onClick={() => setViewTarget(refund)}>
                  <VisibilityRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title="Tác vụ"
                  onClick={(event) => openMenu(event, refund)}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </div>
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

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setViewTarget(menuTarget);
            closeMenu();
          }}
        >
          <VisibilityRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Xem chi tiết
        </MenuItem>
        {menuTarget?.status === 'pending' ? (
          <MenuItem
            disabled={isMutating}
            onClick={() => {
              setCompleteTarget(menuTarget);
              closeMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Xác nhận đã chuyển
          </MenuItem>
        ) : null}
        <MenuItem
          disabled={isMutating}
          onClick={() => {
            setEditTarget(menuTarget);
            closeMenu();
          }}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-sky-600" />
          Chỉnh sửa
        </MenuItem>
        {menuTarget?.status === 'pending' ? (
          <MenuItem
            disabled={isMutating}
            onClick={() => {
              setCancelTarget(menuTarget);
              closeMenu();
            }}
          >
            <CancelOutlinedIcon fontSize="small" className="mr-2 text-rose-600" />
            Hủy khoản trả
          </MenuItem>
        ) : null}
        <MenuItem
          className="text-rose-600"
          disabled={isMutating}
          onClick={() => {
            setDeleteTarget(menuTarget);
            closeMenu();
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" className="mr-2" />
          Xóa khoản trả
        </MenuItem>
      </Menu>

      <AppDetailDialog
        open={Boolean(viewTarget)}
        title={viewTarget ? formatCurrency(viewTarget.amount) : ''}
        eyebrow={viewTarget ? TYPE_LABELS[viewTarget.refundType] : ''}
        subtitle={viewTarget ? refundStatusLabel(viewTarget) : ''}
        maxWidth="md"
        onClose={() => setViewTarget(null)}
      >
        {viewTarget ? (
          <div className="space-y-4 bg-slate-50/60 p-4">
            <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  {viewTarget.status === 'completed' ? 'Ngày đã chuyển' : 'Ngày dự kiến'}
                </p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatDate(
                    viewTarget.status === 'completed'
                      ? viewTarget.completedAt || viewTarget.refundedAt
                      : viewTarget.scheduledAt,
                  )}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Giao dịch nguồn</p>
                <p className="mt-1 truncate font-bold text-slate-900">
                  {viewTarget.payment?.reference || `#${viewTarget.paymentId}`}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase text-slate-400">Trạng thái</p>
                <span
                  className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(viewTarget.status, viewTarget.refundType)}`}
                >
                  {refundStatusLabel(viewTarget)}
                </span>
              </div>
            </section>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-4">
              {[
                ['Lý do', viewTarget.reason],
                [
                  'Ảnh hưởng công nợ',
                  viewTarget.refundType === 'compensation'
                    ? 'Khoản bù thêm, không làm giảm công nợ báo phí'
                    : 'Khoản hoàn, được tính lại vào vòng đời thanh toán',
                ],
                ['Người nhận', viewTarget.recipientName],
                [
                  'Tài khoản nhận',
                  [viewTarget.recipientBank, viewTarget.recipientAccount]
                    .filter(Boolean)
                    .join(' · '),
                ],
                ['Mã tham chiếu', viewTarget.reference],
                ['Ghi chú', viewTarget.note],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-500">{label}</span>
                  <span className="break-words text-sm font-semibold text-slate-900">
                    {value || '-'}
                  </span>
                </div>
              ))}
              {viewTarget.quotation ? (
                <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-slate-100 py-3 last:border-0">
                  <span className="text-sm font-medium text-slate-500">Báo phí</span>
                  <Link
                    className="truncate text-sm font-bold text-primary hover:underline"
                    href={`/quotations/${viewTarget.quotation.id}`}
                  >
                    {viewTarget.quotation.quotationCode}
                  </Link>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </AppDetailDialog>

      <CompleteRefundDialog
        key={completeTarget?.id || 'complete-refund'}
        refund={completeTarget}
        submitting={isMutating}
        onClose={() => setCompleteTarget(null)}
        onSubmit={async (values) => {
          if (!completeTarget) return;
          await onUpdate(completeTarget.id, values);
          setCompleteTarget(null);
        }}
      />
      <EditRefundDialog
        key={editTarget?.id || 'edit-refund'}
        refund={editTarget}
        submitting={isMutating}
        onClose={() => setEditTarget(null)}
        onSubmit={async (values) => {
          if (!editTarget) return;
          await onUpdate(editTarget.id, values);
          setEditTarget(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Hủy khoản trả khách?"
        description="Khoản đang chờ sẽ bị hủy và số tiền có thể hoàn từ giao dịch gốc sẽ được khôi phục."
        confirmText="Hủy khoản trả"
        loading={isMutating}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          void onUpdate(cancelTarget.id, { status: 'cancelled' }).then(() => setCancelTarget(null));
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa khoản trả khách?"
        description={`Khoản ${formatCurrency(deleteTarget?.amount)} sẽ được xóa khỏi sổ hiện tại. Công nợ báo phí và trạng thái thanh toán sẽ được tính lại; lịch sử xóa vẫn được lưu để truy vết.`}
        confirmText="Xóa khoản trả"
        loading={isMutating}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void onDelete(deleteTarget.id).then(() => setDeleteTarget(null));
        }}
      />
    </>
  );
}
