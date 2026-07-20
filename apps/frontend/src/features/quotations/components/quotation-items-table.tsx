import type { Key } from 'react';

export type QuotationTableLine = {
  id: Key;
  no?: number;
  name: string;
  unit?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  amount?: string | number | null;
  excludedFromTotal?: boolean;
  highlighted?: boolean;
};

type QuotationItemsTableProps = {
  lines: QuotationTableLine[];
  subtotal: string | number | null | undefined;
  vatRate: string | number | null | undefined;
  vatAmount: string | number | null | undefined;
  deposit: string | number | null | undefined;
  total: string | number | null | undefined;
  emptyText?: string;
};

function toNumber(value: string | number | null | undefined) {
  return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0;
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(toNumber(value)));
}

function formatCurrency(value: string | number | null | undefined) {
  return `${formatMoney(value)} đ`;
}

export function QuotationItemsTable({
  lines,
  subtotal,
  vatRate,
  vatAmount,
  deposit,
  total,
  emptyText = 'Chưa có hạng mục báo phí',
}: QuotationItemsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-y border-slate-200 bg-slate-100 text-[13px] font-bold text-slate-700">
          <tr>
            <th className="w-16 px-4 py-3">STT</th>
            <th className="px-4 py-3">Hạng mục</th>
            <th className="w-28 px-4 py-3">Đơn vị tính</th>
            <th className="w-24 px-4 py-3 text-right">Số lượng</th>
            <th className="w-40 px-4 py-3 text-right">Đơn giá</th>
            <th className="w-40 px-4 py-3 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => {
              const unitPrice = toNumber(line.unitPrice);
              const amount = toNumber(line.amount);

              return (
                <tr key={line.id} className={line.highlighted ? 'bg-emerald-50/30' : undefined}>
                  <td className="px-4 py-3 font-bold text-slate-950">{line.no ?? index + 1}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span>{line.name || '-'}</span>
                    {line.excludedFromTotal ? (
                      <span className="ml-2 whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-inset ring-sky-200">
                        Không tính vào tổng
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.unit || '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {formatMoney(line.quantity)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${unitPrice < 0 ? 'text-rose-600' : 'text-slate-700'}`}
                  >
                    {formatCurrency(unitPrice)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${amount < 0 ? 'text-rose-600' : 'text-slate-950'}`}
                  >
                    {formatCurrency(amount)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot className="bg-slate-50 text-sm">
          <tr>
            <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
              Tổng trước thuế
            </td>
            <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(subtotal)}
            </td>
          </tr>
          <tr>
            <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
              VAT {toNumber(vatRate)}%
            </td>
            <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(vatAmount)}
            </td>
          </tr>
          {toNumber(deposit) > 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
                Cọc <span className="font-medium text-slate-500">(không tính VAT)</span>
              </td>
              <td className="px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">
                {formatCurrency(deposit)}
              </td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={5} className="px-4 py-4 text-right font-extrabold text-slate-950">
              Tổng thanh toán
            </td>
            <td className="px-4 py-4 text-right text-lg font-extrabold tabular-nums text-emerald-700">
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
