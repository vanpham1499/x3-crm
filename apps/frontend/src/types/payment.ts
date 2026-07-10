import type { Quotation } from '@/types/quotation';

export type PaymentStatus =
  | 'unmatched'
  | 'matched_quotation'
  | 'matched_project'
  | 'partial'
  | 'paid'
  | 'overpaid'
  | string;

export type Payment = {
  id: string;
  quotationId?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  contractId?: string | null;
  revenueId?: string | null;
  transactionDate?: string | null;
  bankAccount?: string | null;
  transactionContent?: string | null;
  amount?: string | number | null;
  customerCodeText?: string | null;
  isNotified?: boolean | null;
  reconciledStatus?: PaymentStatus | null;
  status?: PaymentStatus | null;
  matchedAt?: string | null;
  note?: string | null;
  quotation?: Pick<Quotation, 'id' | 'quotationCode'> | null;
  project?: {
    id: string;
    projectCode?: string | null;
    projectName?: string | null;
  } | null;
  contract?: {
    id: string;
    contractNo?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentFilters = {
  status: string;
};
