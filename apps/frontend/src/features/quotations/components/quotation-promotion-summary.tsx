import type { Quotation } from '@/types/quotation';
import { formatCurrency } from '@/lib/utils';

export function QuotationPromotionSummary({ quotation }: { quotation: Quotation }) {
  const promotion = Number(quotation.metadata?.promotionBudget) || 0;
  if (promotion <= 0) return null;
  const cashBudget = Number(quotation.metadata?.budget) || 0;
  return (
    <section className="mt-4 rounded-lg border border-sky-200 bg-sky-50/50 p-4 text-sm">
      <h3 className="font-semibold text-slate-900">Ngân sách quảng cáo dự kiến</h3>
      <div className="mt-2 space-y-1 text-slate-700">
        <p className="flex justify-between gap-4">
          <span>Ngân sách tiền (trước VAT)</span>
          <strong>{formatCurrency(cashBudget)}</strong>
        </p>
        <p className="flex justify-between gap-4">
          <span>MKM nền tảng tặng</span>
          <strong>{formatCurrency(promotion)}</strong>
        </p>
        <p className="flex justify-between gap-4 border-t border-sky-200 pt-2">
          <span>Tổng ngân sách dự kiến</span>
          <strong>{formatCurrency(cashBudget + promotion)}</strong>
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        MKM chỉ sử dụng khi được nền tảng cấp; không cộng vào tổng thanh toán.
      </p>
    </section>
  );
}
