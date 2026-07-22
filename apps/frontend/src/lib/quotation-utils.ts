import type { Quotation } from '@/types/quotation';

export const QUOTATION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  partial: 'Chưa thu đủ',
  paid: 'Hoàn thành',
  overpaid: 'Thu thừa',
  partially_refunded: 'Đã hoàn một phần',
  refunded: 'Đã hoàn toàn bộ',
};

export function getQuotationPaymentStatusLabel(
  quotation?: Pick<
    Quotation,
    'paymentStatus' | 'depositRefundedAmount' | 'compensationAmount' | 'isFullyRefunded'
  > | null,
) {
  const compensationAmount = Number(quotation?.compensationAmount) || 0;

  if (quotation?.isFullyRefunded && compensationAmount > 0) {
    return 'Đã hoàn + bù thêm';
  }

  if (quotation?.paymentStatus === 'paid' && Number(quotation.depositRefundedAmount) > 0) {
    return compensationAmount > 0 ? 'Đã thanh toán · Hoàn cọc · Có bù' : 'Đã thanh toán · Hoàn cọc';
  }

  const status = quotation?.paymentStatus || '';
  const baseLabel = QUOTATION_PAYMENT_STATUS_LABELS[status] || status || 'Chưa thanh toán';

  return compensationAmount > 0 ? `${baseLabel} · Có bù` : baseLabel;
}

export function formatQuotationPaymentContent(value?: string | null) {
  return (value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getQuotationPaymentContent(
  quotation?: Pick<Quotation, 'quotationCode' | 'paymentContent'> | null,
) {
  return (
    formatQuotationPaymentContent(quotation?.paymentContent) ||
    formatQuotationPaymentContent(quotation?.quotationCode)
  );
}
