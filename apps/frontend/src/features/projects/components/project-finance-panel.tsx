'use client';

import { useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { EntityTableButton } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { QuotationPreviewDialog } from '@/features/quotations/components/quotation-preview-dialog';
import { getPaymentDisplayStatus } from '@/lib/payment-display-status';
import { getQuotationPaymentContent, getQuotationPaymentStatusLabel } from '@/lib/quotation-utils';
import { formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/payment';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';

const FINANCE_TABLE_PAGE_SIZE = 3;

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function formatPaymentMoment(value?: string | null) {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (!match) return formatDate(value);

  const date = `${match[3]}/${match[2]}/${match[1]}`;
  const time = match[4] ? `${match[4]}:${match[5]}${match[6] ? `:${match[6]}` : ''}` : '';

  return time ? `${date} · ${time}` : date;
}

function paymentStatusClass(status?: string | null) {
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
  if (status === 'unmatched') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'applied' || status === 'partial') {
    return 'bg-sky-50 text-sky-700 ring-sky-200';
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
  if (status === 'matched_project') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'matched_quotation' || status === 'matched_customer') {
    return 'bg-blue-50 text-blue-700 ring-blue-200';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function paymentQuotations(payment: Payment, quotations: Quotation[]) {
  const quotationIds = [
    ...(payment.allocations || []).map((allocation) => allocation.quotationId),
    payment.quotationId,
  ].filter((id): id is number => Boolean(id));

  return [...new Set(quotationIds)]
    .map((id) => quotations.find((quotation) => quotation.id === id))
    .filter((quotation): quotation is Quotation => Boolean(quotation));
}

export function ProjectFinancePanel({
  project,
  quotations,
  payments,
  children,
}: {
  project: ProjectItem;
  revenueGroup: '2.1' | '2.2';
  quotations: Quotation[];
  payments: Payment[];
  children?: React.ReactNode;
}) {
  const unallocatedPayments = payments.filter(
    (payment) =>
      Number(payment.availableAmount ?? payment.unallocatedAmount) > 0 &&
      payment.projectId === project.id,
  );
  const unallocatedAmount = unallocatedPayments.reduce(
    (sum, payment) => sum + (Number(payment.availableAmount ?? payment.unallocatedAmount) || 0),
    0,
  );
  const sortedPayments = [...payments].sort((a, b) =>
    String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')),
  );
  const [previewTarget, setPreviewTarget] = useState<Quotation | null>(null);
  const [quotationPage, setQuotationPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const quotationTotalPages = Math.max(1, Math.ceil(quotations.length / FINANCE_TABLE_PAGE_SIZE));
  const paymentTotalPages = Math.max(1, Math.ceil(sortedPayments.length / FINANCE_TABLE_PAGE_SIZE));
  const currentQuotationPage = Math.min(quotationPage, quotationTotalPages);
  const currentPaymentPage = Math.min(paymentPage, paymentTotalPages);
  const visibleQuotations = quotations.slice(
    (currentQuotationPage - 1) * FINANCE_TABLE_PAGE_SIZE,
    currentQuotationPage * FINANCE_TABLE_PAGE_SIZE,
  );
  const visiblePayments = sortedPayments.slice(
    (currentPaymentPage - 1) * FINANCE_TABLE_PAGE_SIZE,
    currentPaymentPage * FINANCE_TABLE_PAGE_SIZE,
  );

  return (
    <div className="mb-6 grid items-start gap-4 xl:grid-cols-12">
      <section className="order-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-5 xl:col-start-1 xl:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-950">Báo phí</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {quotations.length}
            </span>
          </div>
          <TabActionButton
            href={`/quotations/new?projectId=${project.id}`}
            startIcon={<AddRoundedIcon />}
          >
            Tạo báo phí
          </TabActionButton>
        </div>

        {quotations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-500">Dự án chưa có báo phí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
                <tr>
                  <th className="w-[46%] px-4 py-3">Báo phí</th>
                  <th className="w-[20%] px-3 py-3 text-right">Tổng báo</th>
                  <th className="w-[20%] px-3 py-3 text-right">Đã thu / trả</th>
                  <th className="w-[14%] px-3 py-3 text-right">Còn thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleQuotations.map((quotation) => {
                  const total = Number(quotation.totalAmount) || 0;
                  const received =
                    Number(quotation.grossPaidAmount) ||
                    (Number(quotation.paidAmount) || 0) + (Number(quotation.refundedAmount) || 0);
                  const deposit = Number(quotation.depositAmount) || 0;
                  const depositRefunded = Number(quotation.depositRefundedAmount) || 0;
                  const refunded = Number(quotation.refundedAmount) || 0;
                  const compensation = Number(quotation.compensationAmount) || 0;
                  const outbound = Number(quotation.outboundAmount) || refunded + compensation;
                  const remaining = Number(quotation.outstandingAmount) || 0;
                  const paymentStatusLabel =
                    quotation.paymentStatus === 'unpaid'
                      ? 'Báo phí'
                      : getQuotationPaymentStatusLabel(quotation);

                  return (
                    <tr key={quotation.id} className="hover:bg-slate-50/70">
                      <td className="min-w-0 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <EntityTableButton
                            title={quotation.quotationCode || `#${quotation.id}`}
                            ariaLabel={`Xem chi tiết báo phí ${quotation.quotationCode || quotation.id}`}
                            onClick={() => setPreviewTarget(quotation)}
                          >
                            {quotation.quotationCode || `#${quotation.id}`}
                          </EntityTableButton>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">
                            {paymentStatusLabel}
                          </span>
                        </div>
                        <p
                          className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-500"
                          title={getQuotationPaymentContent(quotation) || ''}
                        >
                          {formatDate(quotation.createdAt)} · CK{' '}
                          {getQuotationPaymentContent(quotation) || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">
                        <span className="whitespace-nowrap">{formatCurrency(total)}</span>
                        {deposit > 0 ? (
                          <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold text-blue-700">
                            Cọc {formatCurrency(deposit)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">
                        <span className="whitespace-nowrap">{formatCurrency(received)}</span>
                        {outbound > 0 ? (
                          <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold text-rose-600">
                            Trả KH {formatCurrency(outbound)}
                          </span>
                        ) : depositRefunded > 0 ? (
                          <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold text-rose-600">
                            Hoàn cọc {formatCurrency(depositRefunded)}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-bold tabular-nums ${remaining > 0 ? 'text-rose-700' : 'text-slate-500'}`}
                      >
                        <span className="whitespace-nowrap">{formatCurrency(remaining)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePaginationBar
          page={currentQuotationPage}
          totalPages={quotationTotalPages}
          totalItems={quotations.length}
          pageSize={FINANCE_TABLE_PAGE_SIZE}
          rangeLabel="Báo phí"
          onPageChange={setQuotationPage}
        />

        {unallocatedAmount > 0 ? (
          <div className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
            {formatCurrency(unallocatedAmount)} chưa gắn với báo phí cụ thể.
          </div>
        ) : null}
      </section>

      <div className="order-3 min-w-0 xl:order-none xl:col-span-7 xl:col-start-6 xl:row-span-2 xl:row-start-1">
        {children}
      </div>

      <section className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:order-none xl:col-span-5 xl:col-start-1 xl:row-start-2">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-950">Giao dịch</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {sortedPayments.length}
            </span>
          </div>
          <TabActionButton href="/payments" tone="secondary">
            Mở thanh toán
          </TabActionButton>
        </div>

        {sortedPayments.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
            Chưa có giao dịch thanh toán
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] table-fixed text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
                <tr>
                  <th className="w-[42%] px-4 py-3">Giao dịch</th>
                  <th className="w-[24%] px-3 py-3 text-right">Dòng tiền</th>
                  <th className="w-[34%] px-4 py-3">Báo phí / đối soát</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePayments.map((payment) => {
                  const linkedQuotations = paymentQuotations(payment, quotations);
                  const primaryQuotation = linkedQuotations[0];
                  const displayStatus = getPaymentDisplayStatus(payment);
                  const outboundAmount = Number(payment.outboundAmount) || 0;
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/70">
                      <td className="min-w-0 px-4 py-3">
                        <p className="font-semibold tabular-nums text-slate-800">
                          {formatPaymentMoment(payment.transactionAt || payment.transactionDate)}
                        </p>
                        <p
                          className="mt-1 max-w-[260px] truncate font-mono text-[11px] font-semibold text-slate-500"
                          title={payment.transactionContent || ''}
                        >
                          {payment.transactionContent || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold tabular-nums text-emerald-700">
                        <span className="whitespace-nowrap">
                          + {formatCurrency(Number(payment.amount) || 0)}
                        </span>
                        {outboundAmount > 0 ? (
                          <span className="mt-1 block whitespace-nowrap text-[11px] text-rose-700">
                            − {formatCurrency(outboundAmount)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {primaryQuotation ? (
                            <Link
                              href={`/quotations/${primaryQuotation.id}`}
                              className="truncate text-xs font-bold text-emerald-700 hover:underline"
                            >
                              {primaryQuotation.quotationCode || `#${primaryQuotation.id}`}
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap text-xs font-semibold text-amber-700">
                              Chưa gắn báo phí
                            </span>
                          )}
                          {linkedQuotations.length > 1 ? (
                            <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              +{linkedQuotations.length - 1}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${paymentStatusClass(displayStatus.key)}`}
                          >
                            {displayStatus.label}
                          </span>
                          {displayStatus.outstandingAmount ? (
                            <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-amber-700">
                              Còn {formatCurrency(displayStatus.outstandingAmount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePaginationBar
          page={currentPaymentPage}
          totalPages={paymentTotalPages}
          totalItems={sortedPayments.length}
          pageSize={FINANCE_TABLE_PAGE_SIZE}
          rangeLabel="Giao dịch"
          onPageChange={setPaymentPage}
        />
      </section>

      <QuotationPreviewDialog quotation={previewTarget} onClose={() => setPreviewTarget(null)} />
    </div>
  );
}
