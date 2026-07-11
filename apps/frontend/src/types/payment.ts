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
  id: number;
  quotationId?: number | null;
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  revenueId?: number | null;
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
    id: number;
    projectCode?: string | null;
    projectName?: string | null;
  } | null;
  contract?: {
    id: number;
    contractNo?: string | null;
  } | null;
  revenue?: {
    id: number;
    revenueCode?: string | null;
    amountAfterVat?: string | number | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentFilters = {
  status: string;
};
