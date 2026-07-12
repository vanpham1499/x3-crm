'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { formatQuotationPaymentContent } from '@/lib/quotation-utils';
import type { Payment, PaymentFilters } from '@/types/payment';

type PaymentManagerProps = {
  payments: Payment[];
  filters: PaymentFilters;
  isFetching: boolean;
  onFiltersChange: (filters: PaymentFilters) => void;
};

const statusLabels: Record<string, string> = {
  unmatched: 'Chờ đối soát',
  matched_quotation: 'Đã khớp báo phí',
  matched_project: 'Đã khớp dự án',
  partial: 'Chưa thu đủ',
  paid: 'Hoàn thành',
  overpaid: 'Thu thừa',
};

const reconciledStatusLabels: Record<string, string> = {
  unmatched: 'Chưa xác định báo phí',
  matched_quotation: 'Đã khớp báo phí',
  matched_project: 'Đã khớp dự án',
};

function formatCurrency(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function getTransferMoment(payment: Payment) {
  const value = payment.transactionAt || payment.transactionDate || '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (!match) {
    return { date: value || '-', time: 'Chưa có giờ', full: value || '-' };
  }

  const date = `${match[3]}/${match[2]}/${match[1]}`;
  const time = match[4]
    ? `${match[4]}:${match[5]}${match[6] ? `:${match[6]}` : ''}`
    : 'Chưa có giờ';

  return { date, time, full: match[4] ? `${date} · ${time}` : date };
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
    second: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
}

function statusClass(status?: string | null) {
  if (status === 'unmatched' || status === 'partial') {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'overpaid') return 'bg-violet-50 text-violet-700 ring-violet-100';
  if (status === 'matched_project') return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (status === 'matched_quotation') return 'bg-blue-50 text-blue-700 ring-blue-100';
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

function PaymentDetailDialog({
  payment,
  onClose,
}: {
  payment: Payment | null;
  onClose: () => void;
}) {
  if (!payment) return null;

  const transferMoment = getTransferMoment(payment);

  return (
    <AppDetailDialog
      open
      title={formatCurrency(payment.amount)}
      eyebrow={payment.reference || `Giao dịch #${payment.id}`}
      subtitle={transferMoment.full}
      onClose={onClose}
      actions={
        <>
          {payment.quotation ? (
            <DialogActionButton
              href={`/quotations/${payment.quotation.id}`}
              startIcon={<ReceiptLongRoundedIcon />}
            >
              Mở báo phí
            </DialogActionButton>
          ) : null}
          {payment.project ? (
            <DialogActionButton
              href={`/projects/${payment.project.id}`}
              tone="primary"
              startIcon={<WorkRoundedIcon />}
            >
              Mở dự án
            </DialogActionButton>
          ) : null}
        </>
      }
    >
      <div className="bg-slate-50/60 p-4">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white px-5">
          <dl>
            <DetailRow label="Thời gian chuyển khoản" value={transferMoment.full} />
            <DetailRow
              label="Tài khoản nhận tiền"
              value={
                <span className="tabular-nums">
                  {[payment.bankGateway, payment.bankAccount].filter(Boolean).join(' · ') || '-'}
                </span>
              }
            />
            <DetailRow
              label="Số tiền"
              value={
                <span className="text-base font-extrabold tabular-nums text-emerald-700">
                  {formatCurrency(payment.amount)}
                </span>
              }
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
              label="Trạng thái"
              value={
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(payment.status)}`}
                >
                  {statusLabels[payment.status || ''] || payment.status || '-'}
                </span>
              }
            />
            <DetailRow
              label="Báo phí"
              value={
                payment.quotation ? (
                  <Link
                    href={`/quotations/${payment.quotation.id}`}
                    className="text-primary hover:underline"
                  >
                    {payment.quotation.quotationCode || '-'}
                  </Link>
                ) : (
                  'Chưa xác định'
                )
              }
            />
            <DetailRow
              label="Dự án"
              value={
                payment.project ? (
                  <Link
                    href={`/projects/${payment.project.id}`}
                    className="text-sky-700 hover:underline"
                  >
                    {[payment.project.projectCode, payment.project.projectName]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </Link>
                ) : (
                  'Chưa gắn dự án'
                )
              }
            />
            <DetailRow label="Đối soát lúc" value={formatDateTime(payment.matchedAt)} />
          </dl>
        </section>
      </div>
    </AppDetailDialog>
  );
}

export function PaymentManager({
  payments,
  filters,
  isFetching,
  onFiltersChange,
}: PaymentManagerProps) {
  const [viewTarget, setViewTarget] = useState<Payment | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePayment, setActivePayment] = useState<Payment | null>(null);

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, payment: Payment) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePayment(payment);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePayment(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader title="Thanh toán" />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 lg:grid-cols-[176px_minmax(0,1fr)]">
          <CompactSelectField
            label="Trạng thái thu tiền"
            value={filters.status}
            options={[
              { value: 'unmatched', label: 'Chờ đối soát' },
              { value: 'matched_quotation', label: 'Đã khớp báo phí' },
              { value: 'matched_project', label: 'Đã khớp dự án' },
              { value: 'partial', label: 'Chưa thu đủ' },
              { value: 'paid', label: 'Hoàn thành' },
              { value: 'overpaid', label: 'Thu thừa' },
            ]}
            onChange={(status) => onFiltersChange({ ...filters, status })}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'time',
              label: 'Thời gian chuyển khoản',
              className: 'sticky left-0 z-20 w-44 bg-slate-100',
            },
            { key: 'recipient', label: 'Tài khoản nhận tiền', className: 'w-52' },
            { key: 'amount', label: 'Số tiền', className: 'w-40 text-right' },
            { key: 'quotation', label: 'Báo phí', className: 'w-52' },
            { key: 'project', label: 'Dự án', className: 'w-56' },
            { key: 'content', label: 'Nội dung chuyển khoản', className: 'w-72' },
            { key: 'status', label: 'Trạng thái', className: 'w-44' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={payments.length === 0}
          emptyText="Chưa có giao dịch thanh toán"
          minWidthClassName="min-w-[1500px]"
        >
          {payments.map((payment) => {
            const transferMoment = getTransferMoment(payment);
            const paymentContent = formatQuotationPaymentContent(payment.quotation?.quotationCode);

            return (
              <tr key={payment.id} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                  <p className="font-bold tabular-nums text-slate-900">{transferMoment.date}</p>
                  <p
                    className={`mt-1 text-xs font-semibold tabular-nums ${transferMoment.time === 'Chưa có giờ' ? 'text-amber-600' : 'text-slate-500'}`}
                  >
                    {transferMoment.time}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <p className="truncate font-semibold text-slate-900">
                    {payment.bankGateway || 'Chưa rõ ngân hàng'}
                  </p>
                  <p
                    className="mt-1 truncate font-mono text-xs font-semibold tabular-nums text-slate-500"
                    title={payment.bankAccount || ''}
                  >
                    {payment.bankAccount || 'Chưa có số tài khoản'}
                  </p>
                </td>
                <td className="px-3 py-4 text-right font-extrabold tabular-nums text-emerald-700">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-3 py-4">
                  {payment.quotation ? (
                    <>
                      <Link
                        href={`/quotations/${payment.quotation.id}`}
                        className="block truncate font-bold text-primary hover:underline"
                      >
                        {payment.quotation.quotationCode || '-'}
                      </Link>
                      <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-500">
                        CK: {paymentContent || '-'}
                      </p>
                    </>
                  ) : (
                    <span className="font-semibold text-amber-700">Chưa xác định</span>
                  )}
                </td>
                <td className="px-3 py-4">
                  {payment.project ? (
                    <>
                      <Link
                        href={`/projects/${payment.project.id}`}
                        className="block truncate font-bold text-sky-700 hover:underline"
                      >
                        {payment.project.projectCode || '-'}
                      </Link>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        {payment.project.projectName || '-'}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-400">Chưa gắn dự án</span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <p
                    className="truncate font-mono text-[13px] text-slate-700"
                    title={payment.transactionContent || ''}
                  >
                    {payment.transactionContent || '-'}
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500">
                    Tham chiếu: {payment.reference || '-'}
                  </p>
                </td>
                <td className="px-3 py-4">
                  <span
                    className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(payment.status)}`}
                  >
                    {statusLabels[payment.status || ''] || payment.status || '-'}
                  </span>
                  <p className="mt-1.5 text-xs font-medium text-slate-500">
                    {reconciledStatusLabels[payment.reconciledStatus || ''] ||
                      payment.reconciledStatus ||
                      '-'}
                  </p>
                </td>
                <td className="py-4">
                  <div className="flex items-center justify-end gap-1 pr-3">
                    <IconButton
                      size="small"
                      title="Xem chi tiết thanh toán"
                      onClick={() => setViewTarget(payment)}
                    >
                      <VisibilityRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Tác vụ"
                      onClick={(event) => openActionMenu(event, payment)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </AppDataTable>

        <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          Hiển thị <strong className="text-slate-950">{payments.length}</strong> giao dịch
        </div>
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
        {!activePayment?.quotation && !activePayment?.project ? (
          <MenuItem disabled>
            <AccountBalanceRoundedIcon fontSize="small" className="mr-2 text-slate-400" />
            Chưa có liên kết đối soát
          </MenuItem>
        ) : null}
      </Menu>

      <PaymentDetailDialog payment={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}
