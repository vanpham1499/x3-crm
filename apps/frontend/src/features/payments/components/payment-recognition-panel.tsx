'use client';

import Link from 'next/link';
import { Alert, Button, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api/client';
import type { Payment } from '@/types/payment';

type Person = { id: number; name: string; code: string } | null;
type Recognition = {
  rows: {
    allocationId: number;
    quotationId: number;
    quotationCode: string;
    projectCode: string;
    projectType: string | null;
    allocatedAmount: number;
    recognizedAt: string;
    period: string;
    status: string;
    feeAmount: number | null;
    feeBasis: number | null;
    implementation: Person;
    sales: Person;
    firstQuotation: boolean | null;
  }[];
  history: {
    reason: string;
    actor: string;
    createdAt: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
  }[];
};
const money = (value: number) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;
const reasons: Record<string, string> = {
  legacy: 'Kỳ trước tháng 10/2026 dùng công thức cũ. Xem chi tiết tại KPI của kỳ này.',
  missing_basis: 'Chưa có dữ liệu chốt phí KPI. Cần đối soát và khởi tạo dữ liệu.',
  no_fee: 'Báo phí chưa có dòng phí quản lý được ghi nhận vào KPI.',
  no_increment: 'Lần phân bổ này không tăng phí KPI (cọc, tiền dư hoặc phí đã ghi nhận đủ).',
  unavailable: 'Báo phí hoặc dự án không còn hiệu lực.',
};

export function PaymentRecognitionPanel({ payment }: { payment: Payment }) {
  const query = useQuery({
    queryKey: ['payments', 'recognition', payment.id, payment.updatedAt],
    queryFn: ({ signal }) =>
      api.get<Recognition>(`/payments/${payment.id}/recognition`, { signal }).then((r) => r.data),
  });
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-950">Đối soát KPI</h3>
      </div>
      {query.isPending ? (
        <div className="p-4">
          <CircularProgress size={20} />
        </div>
      ) : query.isError ? (
        <Alert
          severity="warning"
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        >
          Chưa tải được đối soát KPI.
        </Alert>
      ) : (
        <>
          {!query.data.rows.length && (
            <p className="p-4 text-sm text-slate-500">
              {payment.receiptType === 'internal'
                ? 'Chuyển nội bộ: không ghi nhận thêm doanh thu hoặc KPI.'
                : 'Chưa có phân bổ báo phí để ghi nhận KPI.'}
            </p>
          )}
          <div className="divide-y divide-slate-100">
            {query.data.rows.map((row) => (
              <div key={row.allocationId} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/quotations/${row.quotationId}`}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      {row.quotationCode || `Báo phí #${row.quotationId}`}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      Ngày thực nhận {row.recognizedAt.slice(0, 10).split('-').reverse().join('/')}{' '}
                      · Kỳ {row.period.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Phí quản lý trước VAT ghi nhận lần này</p>
                    <p className="mt-1 text-sm font-bold text-emerald-700">
                      {row.feeAmount === null ? 'Cần đối soát' : money(row.feeAmount)}
                    </p>
                  </div>
                </div>
                {reasons[row.status] && (
                  <Alert severity={row.status === 'legacy' ? 'info' : 'warning'}>
                    {reasons[row.status]}
                  </Alert>
                )}
                {row.firstQuotation !== null && row.feeAmount !== null && (
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs text-slate-500">Triển khai</span>
                      <p className="mt-1">
                        {row.implementation
                          ? `${row.implementation.code} · ${row.implementation.name}`
                          : 'Chưa có nhân sự trong dữ liệu chốt KPI'}
                      </p>
                      <p className="mt-1 font-semibold">
                        {money(row.implementation ? row.feeAmount : 0)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs text-slate-500">Sale</span>
                      <p className="mt-1">
                        {!row.firstQuotation
                          ? 'Báo phí tiếp theo — không phát sinh KPI Sale'
                          : row.sales
                            ? `${row.sales.code} · ${row.sales.name}`
                            : 'Chưa có Sale trong dữ liệu chốt KPI'}
                      </p>
                      <p className="mt-1 font-semibold">{money(row.sales ? row.feeAmount : 0)}</p>
                    </div>
                  </div>
                )}
                {row.projectType === 'K' && (
                  <p className="text-xs text-slate-500">
                    Báo phí K · Không tạo hạn mức nạp quảng cáo.
                  </p>
                )}
              </div>
            ))}
          </div>
          {!!query.data.history.length && (
            <details className="border-t border-slate-200 p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-600">
                Lịch sử đối soát
              </summary>
              <div className="mt-3 space-y-3">
                {query.data.history.map((entry, index) => (
                  <div key={index} className="text-xs text-slate-600">
                    <p>
                      {entry.createdAt} · {entry.actor || 'Hệ thống'}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{entry.reason}</p>
                    {entry.before?.transaction_at !== entry.after.transaction_at && (
                      <p>
                        Ngày ghi nhận: {String(entry.before?.transaction_at || '—')} →{' '}
                        {String(entry.after.transaction_at || '—')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
