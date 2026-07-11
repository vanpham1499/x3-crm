'use client';

import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Button } from '@mui/material';
import { REVENUE_INVOICE_STATUS_LABELS, REVENUE_PAYMENT_STATUS_LABELS, formatRevenueMonth } from '@/lib/revenue-utils';
import { formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types/payment';
import type { Revenue } from '@/types/revenue';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unmatched: 'Chờ xử lý',
  matched_quotation: 'Đã khớp báo giá',
  matched_project: 'Đã khớp dự án',
  partial: 'Thanh toán thiếu',
  paid: 'Đã thanh toán',
  overpaid: 'Thanh toán thừa',
};

function paymentStatusClass(status?: string | null) {
  if (status === 'unmatched') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'matched_project' || status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'matched_quotation') return 'bg-sky-50 text-sky-700 ring-sky-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function revenuePaymentStatusClass(status?: string | null) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function ProjectFinancePanel({
  projectId,
  payments,
  revenues,
}: {
  projectId: number;
  payments: Payment[];
  revenues: Revenue[];
}) {
  const totalReceived = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const totalRevenue = revenues.reduce((sum, revenue) => sum + (Number(revenue.amountAfterVat) || 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Tài chính dự án</h2>
          <p className="mt-1 text-sm text-slate-500">Doanh thu đã ghi nhận và các khoản thanh toán liên quan.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-slate-400">Đã nhận (Payment)</p>
            <p className="text-base font-extrabold text-slate-950">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-slate-400">Doanh thu ghi nhận</p>
            <p className="text-base font-extrabold text-slate-950">{formatCurrency(totalRevenue)}</p>
          </div>
          <Button
            component={Link}
            href={`/revenues/new?projectId=${projectId}`}
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            Ghi nhận doanh thu
          </Button>
        </div>
      </div>

      <div className="grid gap-0 divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div>
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs font-bold uppercase text-slate-500">Doanh thu ({revenues.length})</p>
          </div>
          {revenues.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có doanh thu nào cho dự án này</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {revenues.map((revenue) => (
                <Link
                  key={revenue.id}
                  href={`/revenues/${revenue.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950">{revenue.revenueCode || '-'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatRevenueMonth(revenue.revenueMonth)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-bold text-slate-950">
                      {formatCurrency(Number(revenue.amountAfterVat) || 0)}
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${revenuePaymentStatusClass(revenue.paymentStatus)}`}
                    >
                      {REVENUE_PAYMENT_STATUS_LABELS[revenue.paymentStatus || ''] || revenue.paymentStatus}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <p className="text-xs font-bold uppercase text-slate-500">Thanh toán ({payments.length})</p>
          </div>
          {payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Chưa có giao dịch thanh toán nào</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <Link
                  key={payment.id}
                  href="/payments"
                  className="flex items-center justify-between px-5 py-3 text-sm transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950">{payment.transactionDate || '-'}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{payment.transactionContent || '-'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-bold text-slate-950">{formatCurrency(Number(payment.amount) || 0)}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${paymentStatusClass(payment.status)}`}>
                      {PAYMENT_STATUS_LABELS[payment.status || ''] || payment.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {revenues.length > 0 || payments.length > 0 ? (
        <div className="border-t border-slate-100 px-5 py-2 text-right text-xs text-slate-400">
          {revenues.some((r) => r.invoiceStatus) ? (
            <span>
              Hóa đơn:{' '}
              {revenues.filter((r) => r.invoiceStatus === 'issued').length}/{revenues.length}{' '}
              {REVENUE_INVOICE_STATUS_LABELS.issued.toLowerCase()}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
