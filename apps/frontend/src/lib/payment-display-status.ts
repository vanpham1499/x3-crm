import type { Payment } from '@/types/payment';

const PROCESSING_STATUS_LABELS: Record<string, string> = {
  unmatched: 'Chờ đối soát',
  unallocated: 'Chưa phân bổ',
  matched_customer: 'Đã gắn khách hàng',
  matched_quotation: 'Đã gắn báo phí',
  matched_project: 'Đã gắn dự án',
  partially_allocated: 'Đã phân bổ + chuyển thừa',
  allocated: 'Đã phân bổ giao dịch',
  partially_refunded: 'Đã hoàn một phần',
  allocated_and_refunded: 'Đã phân bổ & hoàn dư',
  refunded: 'Đã hoàn toàn bộ',
  non_customer: 'Không phải khoản thu',
  applied: 'Đã phân bổ giao dịch',
  partial: 'Đã phân bổ giao dịch',
  paid: 'Đã phân bổ giao dịch',
  paid_with_excess: 'Đã phân bổ + chuyển thừa',
  overpaid: 'Chuyển thừa',
};

const COLLECTION_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Chưa thu',
  partial: 'Đang thiếu',
  paid: 'Đã thu đủ',
  overpaid: 'Chuyển thừa',
};

const PROCESSING_STATUS_HAS_PRIORITY = new Set([
  'unmatched',
  'unallocated',
  'matched_customer',
  'matched_project',
  'partially_allocated',
  'paid_with_excess',
  'overpaid',
  'partially_refunded',
  'allocated_and_refunded',
  'refunded',
  'non_customer',
]);

export type PaymentDisplayStatus = {
  key: string;
  label: string;
  outstandingAmount: number | null;
};

function quotationIds(payment: Payment) {
  const allocationIds = (payment.allocations || [])
    .map((allocation) => allocation.quotationId)
    .filter(Boolean);

  if (allocationIds.length > 0) return new Set(allocationIds);

  const directId = payment.quotationId || payment.quotation?.id;
  return new Set(directId ? [directId] : []);
}

export function getPaymentDisplayStatus(payment: Payment): PaymentDisplayStatus {
  const processingStatus = payment.allocationStatus || payment.status || '';
  const collectionStatus = payment.collectionStatus || '';
  const hasOneQuotation = quotationIds(payment).size === 1;
  const shouldShowCollection =
    hasOneQuotation &&
    Boolean(COLLECTION_STATUS_LABELS[collectionStatus]) &&
    !PROCESSING_STATUS_HAS_PRIORITY.has(processingStatus);

  if (shouldShowCollection) {
    const outstandingAmount = Number(payment.collectionOutstandingAmount) || 0;

    return {
      key: `collection_${collectionStatus}`,
      label: COLLECTION_STATUS_LABELS[collectionStatus],
      outstandingAmount:
        collectionStatus === 'partial' && outstandingAmount > 0 ? outstandingAmount : null,
    };
  }

  return {
    key: processingStatus,
    label: PROCESSING_STATUS_LABELS[processingStatus] || processingStatus || '-',
    outstandingAmount: null,
  };
}
