import type { Quotation } from '@/types/quotation';

export type PaymentStatus =
  | 'unmatched'
  | 'unallocated'
  | 'matched_quotation'
  | 'matched_project'
  | 'matched_customer'
  | 'partially_allocated'
  | 'allocated'
  | 'partially_refunded'
  | 'allocated_and_refunded'
  | 'refunded'
  | 'non_customer'
  | 'applied'
  | 'partial'
  | 'paid'
  | 'paid_with_excess'
  | 'overpaid'
  | string;

export type PaymentCollectionStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid' | string;

export type PaymentReceiptType = 'customer' | 'internal' | 'other';

export type PaymentAllocation = {
  id: number;
  paymentId: number;
  quotationId: number;
  customerId?: number | null;
  projectId?: number | null;
  amount: string | number;
  allocatedAt?: string | null;
  note?: string | null;
  quotation?: {
    id: number;
    quotationCode?: string | null;
    totalAmount?: string | number | null;
    customer?: {
      id: number;
      customerCode?: string | null;
      customerName?: string | null;
    } | null;
    project?: {
      id: number;
      projectCode?: string | null;
      projectName?: string | null;
    } | null;
  } | null;
};

export type PaymentRefund = {
  id: number;
  paymentId: number;
  amount: string | number;
  refundedAt?: string | null;
  recipientName?: string | null;
  recipientAccount?: string | null;
  reference?: string | null;
  note?: string | null;
};

export type Payment = {
  id: number;
  quotationId?: number | null;
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  transactionDate?: string | null;
  transactionAt?: string | null;
  bankAccount?: string | null;
  bankGateway?: string | null;
  senderName?: string | null;
  transactionContent?: string | null;
  amount?: string | number | null;
  allocatedAmount?: string | number | null;
  refundedAmount?: string | number | null;
  availableAmount?: string | number | null;
  unallocatedAmount?: string | number | null;
  excessAmount?: string | number | null;
  cumulativeReceived?: string | number | null;
  outstandingAfter?: string | number | null;
  sequenceNumber?: number | null;
  allocationStatus?: PaymentStatus | null;
  allocationCount?: number | null;
  refundCount?: number | null;
  collectionTotalAmount?: string | number | null;
  collectionReceivedAmount?: string | number | null;
  collectionOutstandingAmount?: string | number | null;
  collectionExcessAmount?: string | number | null;
  collectionDifferenceAmount?: string | number | null;
  collectionStatus?: PaymentCollectionStatus | null;
  collectionTransactionCount?: number | null;
  customerCodeText?: string | null;
  isNotified?: boolean | null;
  reconciledStatus?: PaymentStatus | null;
  status?: PaymentStatus | null;
  receiptType?: PaymentReceiptType | null;
  matchedAt?: string | null;
  note?: string | null;
  reference?: string | null;
  quotation?: Pick<Quotation, 'id' | 'quotationCode' | 'totalAmount'> | null;
  allocations?: PaymentAllocation[];
  refunds?: PaymentRefund[];
  customer?: {
    id: number;
    customerCode?: string | null;
    customerName?: string | null;
  } | null;
  project?: {
    id: number;
    projectCode?: string | null;
    projectName?: string | null;
  } | null;
  contract?: {
    id: number;
    contractNo?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentAllocationInput = {
  quotationId: number;
  amount: number;
  note?: string;
};

export type PaymentRefundInput = {
  amount: number;
  refundedAt: string;
  recipientName?: string;
  recipientAccount?: string;
  reference?: string;
  note?: string;
};

export type PaymentLinkInput = {
  projectId?: number | null;
  customerId?: number | null;
  receiptType: PaymentReceiptType;
};

export type PaymentFilters = {
  keyword: string;
  status: string;
  reconciled_status: string;
  date_from: string;
  date_to: string;
};
