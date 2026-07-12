import type { Quotation } from '@/types/quotation';

export const QUOTATION_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  partial: 'Chưa thu đủ',
  paid: 'Hoàn thành',
  overpaid: 'Thu thừa',
};

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
