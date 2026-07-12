'use client';

import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Button } from '@mui/material';
import { getQuotationPaymentContent } from '@/lib/quotation-utils';
import { formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/payment';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unmatched: 'Chờ xử lý',
  matched_quotation: 'Đã khớp báo phí',
  matched_project: 'Đã khớp dự án',
  partial: 'Chưa thu đủ',
  paid: 'Hoàn thành',
  overpaid: 'Thu thừa',
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  sent: 'Đã báo khách',
  won: 'Đã chốt',
  lost: 'Đã hủy',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function metadataText(quotation: Quotation, key: string) {
  const value = quotation.metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function quotationRevenueGroup(quotation: Quotation, fallback: '2.1' | '2.2') {
  const snapshot = metadataText(quotation, 'revenueGroup');
  return snapshot === '2.1' || snapshot === '2.2' ? snapshot : fallback;
}

function groupBadgeClass(group: '2.1' | '2.2') {
  return group === '2.1'
    ? 'bg-sky-50 text-sky-700 ring-sky-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';
}

function collectionStatus(total: number, received: number) {
  if (received <= 0) {
    return { label: 'Chưa thu', className: 'bg-slate-100 text-slate-600 ring-slate-200' };
  }
  if (received < total) {
    return { label: 'Thu một phần', className: 'bg-amber-50 text-amber-700 ring-amber-200' };
  }
  if (received > total) {
    return { label: 'Thu thừa', className: 'bg-violet-50 text-violet-700 ring-violet-200' };
  }
  return { label: 'Hoàn thành', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
}

function paymentStatusClass(status?: string | null) {
  if (status === 'unmatched') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'overpaid') return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (status === 'matched_project' || status === 'matched_quotation' || status === 'paid') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function ProjectFinancePanel({
  project,
  revenueGroup,
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
  const quotationIds = new Set(quotations.map((quotation) => quotation.id));
  const unallocatedPayments = payments.filter(
    (payment) => !payment.quotationId || !quotationIds.has(payment.quotationId),
  );
  const unallocatedAmount = unallocatedPayments.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  );
  const sortedPayments = [...payments].sort((a, b) =>
    String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')),
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-950">Báo phí & tiền thu</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {quotations.length}
            </span>
          </div>
          <Button
            component={Link}
            href={`/quotations/new?projectId=${project.id}`}
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Tạo báo phí
          </Button>
        </div>

        {quotations.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-500">Dự án chưa có báo phí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ngày báo</th>
                  <th className="px-3 py-3">Báo phí / Nội dung CK</th>
                  <th className="px-3 py-3">Nhóm</th>
                  <th className="px-3 py-3 text-right">Tổng báo</th>
                  <th className="px-3 py-3 text-right">Đã thu</th>
                  <th className="px-3 py-3 text-right">Còn lại</th>
                  <th className="px-3 py-3">Thu tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((quotation) => {
                  const quotationPayments = payments.filter(
                    (payment) => payment.quotationId === quotation.id,
                  );
                  const total = Number(quotation.totalAmount) || 0;
                  const received = quotationPayments.reduce(
                    (sum, payment) => sum + (Number(payment.amount) || 0),
                    0,
                  );
                  const remaining = Math.max(0, total - received);
                  const progress = collectionStatus(total, received);
                  const group = quotationRevenueGroup(quotation, revenueGroup);

                  return (
                    <tr key={quotation.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatDate(quotation.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/quotations/${quotation.id}`}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {quotation.quotationCode || `#${quotation.id}`}
                          </Link>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">
                            {QUOTATION_STATUS_LABELS[quotation.status || ''] || quotation.status}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs font-bold text-slate-600">
                          {getQuotationPaymentContent(quotation) || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${groupBadgeClass(group)}`}
                        >
                          {group === '2.1' ? '2.1 DT DV1,DV2' : '2.2 DT DV3,DV4'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">
                        {formatCurrency(total)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">
                        {formatCurrency(received)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-bold tabular-nums ${remaining > 0 ? 'text-amber-700' : 'text-slate-700'}`}
                      >
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${progress.className}`}
                        >
                          {progress.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {unallocatedAmount > 0 ? (
          <div className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
            {formatCurrency(unallocatedAmount)} chưa gắn với báo phí cụ thể.
          </div>
        ) : null}
      </section>

      {children}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-950">Tiền vào</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
              {sortedPayments.length}
            </span>
          </div>
          <Link href="/payments" className="text-xs font-bold text-blue-700 hover:underline">
            Mở thanh toán
          </Link>
        </div>

        {sortedPayments.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
            Chưa có giao dịch thanh toán
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ngày thanh toán</th>
                  <th className="px-3 py-3">Báo phí</th>
                  <th className="px-3 py-3">Nội dung giao dịch</th>
                  <th className="px-3 py-3">Tình trạng</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPayments.map((payment) => {
                  const quotation = quotations.find((item) => item.id === payment.quotationId);
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {formatDate(payment.transactionDate)}
                      </td>
                      <td className="px-3 py-3">
                        {quotation ? (
                          <Link
                            href={`/quotations/${quotation.id}`}
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {quotation.quotationCode || `#${quotation.id}`}
                          </Link>
                        ) : (
                          <span className="font-semibold text-amber-700">Chưa gắn báo phí</span>
                        )}
                      </td>
                      <td className="max-w-[360px] truncate px-3 py-3 text-slate-600">
                        {payment.transactionContent || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(payment.status)}`}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status || ''] || payment.status || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
                        {formatCurrency(Number(payment.amount) || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
