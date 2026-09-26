'use client';

import Link from 'next/link';
import { Alert } from '@mui/material';
import type { Quotation } from '@/types/quotation';
import type { QuotationVoidEntry } from '@/types/quotation-void';
import { QuotationItemsTable } from './quotation-items-table';

export function formatVoidMoney(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value) || 0)} đ`;
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export function QuotationVoidEntries({ entries }: { entries: QuotationVoidEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-slate-100 text-xs font-bold text-slate-700">
          <tr>
            <th className="p-3">Giao dịch nguồn</th>
            <th className="p-3">Ngày nhận</th>
            <th className="p-3 text-right">Phân bổ bị gỡ</th>
            <th className="p-3 text-right">Chuyển báo phí</th>
            <th className="p-3 text-right">Về chưa phân bổ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.length ? (
            entries.map((entry) => (
              <tr key={entry.allocationId}>
                <td className="p-3">
                  <Link className="font-bold text-primary" href="/payments">
                    #{entry.paymentId}
                  </Link>
                  <p className="break-all text-xs text-slate-500">
                    {entry.reference || 'Không có mã tham chiếu'}
                  </p>
                </td>
                <td className="p-3 text-xs">{dateTime(entry.transactionAt)}</td>
                <td className="p-3 text-right tabular-nums">{formatVoidMoney(entry.amount)}</td>
                <td className="p-3 text-right tabular-nums">
                  {formatVoidMoney(entry.transferAmount)}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatVoidMoney(entry.releaseAmount)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="p-4 text-slate-500">
                Báo phí chưa có phân bổ.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function QuotationVoidHistory({ quotation }: { quotation: Quotation }) {
  const audit = quotation.voidDetails;
  return (
    <div className="space-y-4 p-5">
      <Alert severity="warning">
        Báo phí đã hủy, không còn hiệu lực thanh toán. Giao dịch ngân hàng được giữ nguyên; không
        phát hành lại QR, ảnh hoặc PDF từ báo phí này.
      </Alert>
      <p className="break-all text-base font-extrabold text-slate-950">{quotation.quotationCode}</p>
      <details className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Nội dung báo phí gốc — đã hủy
        </summary>
        <div className="mt-3">
          <QuotationItemsTable
            lines={(quotation.items || []).map((item, index) => ({
              id: item.id ?? index,
              name: item.itemName || '',
              unit: typeof item.metadata?.unit === 'string' ? item.metadata.unit : '',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amountBeforeVat,
            }))}
            subtotal={quotation.subtotalAmount}
            vatRate={quotation.vatRate}
            vatAmount={quotation.vatAmount}
            deposit={quotation.depositAmount}
            total={quotation.totalAmount}
            roundingAdjustment={Number(quotation.metadata?.roundingAdjustment) || 0}
          />
        </div>
        {quotation.note ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{quotation.note}</p>
        ) : null}
      </details>
      {audit ? (
        <>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Người hủy / Thời gian</p>
              <p className="mt-1 text-sm font-bold">
                {[audit.actor.code, audit.actor.name].filter(Boolean).join(' - ')}
              </p>
              <p className="text-sm">{dateTime(audit.voidedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Cách xử lý</p>
              <p className="mt-1 text-sm font-bold">
                {audit.mode === 'transfer' ? 'Chuyển sang báo phí đúng' : 'Chuyển về chưa phân bổ'}
              </p>
              {audit.targetId ? (
                <Link
                  className="break-all text-sm font-bold text-primary"
                  href={`/quotations/${audit.targetId}`}
                >
                  {audit.targetCode}
                </Link>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">Lý do</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{audit.reason}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Đã phân bổ trước hủy', audit.allocatedAmount],
              ['Chuyển sang báo phí đúng', audit.transferAmount],
              ['Về chưa phân bổ', audit.releaseAmount],
            ].map(([label, value]) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 font-extrabold tabular-nums">{formatVoidMoney(value)}</p>
              </div>
            ))}
          </div>
          <QuotationVoidEntries entries={audit.entries} />
          <p className="text-xs text-slate-500">
            Đây là kết quả tại thời điểm hủy. Số dư hiện tại của giao dịch có thể đã được phân bổ
            hoặc hoàn tiền tiếp sau đó.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          Liên hệ người có quyền hủy báo phí để xem chi tiết lịch sử xử lý tiền.
        </p>
      )}
    </div>
  );
}
