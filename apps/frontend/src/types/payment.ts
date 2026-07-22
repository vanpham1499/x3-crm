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

export type PaymentCollectionStatus =
  'unpaid' | 'partial' | 'paid' | 'overpaid' | 'partially_refunded' | 'refunded' | string;

export type PaymentReceiptType = 'customer' | 'internal' | 'other';

export type PaymentRefundType = 'deposit' | 'payment' | 'overpayment' | 'compensation';

export type PaymentRefundStatus = 'pending' | 'completed' | 'cancelled';

export type PaymentAllocation = {
  id: number;
  paymentId: number;
  quotationId: number;
  customerId?: number | null;
  projectId?: number | null;
  amount: string | number;
  refundedAmount?: string | number | null;
  refundableAmount?: string | number | null;
  depositRefundableAmount?: string | number | null;
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
  paymentAllocationId?: number | null;
  quotationId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  refundType: PaymentRefundType;
  status: PaymentRefundStatus;
  amount: string | number;
  scheduledAt?: string | null;
  refundedAt?: string | null;
  completedAt?: string | null;
  recipientName?: string | null;
  recipientAccount?: string | null;
  recipientBank?: string | null;
  reason?: string | null;
  reference?: string | null;
  note?: string | null;
  payment?: {
    id: number;
    amount?: string | number | null;
    transactionAt?: string | null;
    transactionContent?: string | null;
    reference?: string | null;
  } | null;
  allocation?: { id: number; amount?: string | number | null } | null;
  quotation?: {
    id: number;
    quotationCode?: string | null;
    depositAmount?: string | number | null;
  } | null;
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
  createdBy?: { id: number; code?: string | null; name?: string | null } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  compensationAmount?: string | number | null;
  outboundAmount?: string | number | null;
  refundableAmount?: string | number | null;
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
  collectionCollectibleAmount?: string | number | null;
  collectionGrossReceivedAmount?: string | number | null;
  collectionReceivedAmount?: string | number | null;
  collectionRefundedAmount?: string | number | null;
  collectionDepositRefundedAmount?: string | number | null;
  collectionCompensationAmount?: string | number | null;
  collectionOutboundAmount?: string | number | null;
  collectionOverCompensationAmount?: string | number | null;
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
  paymentAllocationId?: number | null;
  refundType: PaymentRefundType;
  status: Exclude<PaymentRefundStatus, 'cancelled'>;
  amount: number;
  scheduledAt: string;
  refundedAt?: string;
  recipientName?: string;
  recipientAccount?: string;
  recipientBank?: string;
  reason: string;
  reference?: string;
  note?: string;
};

export type PaymentRefundUpdateInput = {
  paymentAllocationId?: number | null;
  refundType?: PaymentRefundType;
  status?: PaymentRefundStatus;
  amount?: number;
  scheduledAt?: string;
  refundedAt?: string;
  recipientName?: string;
  recipientAccount?: string;
  recipientBank?: string;
  reason?: string;
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

export type PaymentRefundFilters = {
  keyword: string;
  refund_type: string;
  status: string;
  date_from: string;
  date_to: string;
};
