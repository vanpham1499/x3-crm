import type { AppOption } from '@/types/option';

export type ProjectCostEntryType = 'ad_spend' | 'partner_cost';
export type ProjectCostStatus = 'pending' | 'completed' | 'cancelled';
export type ProjectAcceptanceStatus = 'pending' | 'accepted' | 'not_required';
export type ProjectInputInvoiceStatus = 'pending' | 'received' | 'not_required';

export type ProjectCost = {
  id: number;
  projectId: number;
  quotationId?: number | null;
  entryType: ProjectCostEntryType;
  transactionDate?: string | null;
  status: ProjectCostStatus;
  cid?: string | null;
  adAccount?: string | null;
  bankAccountOptionId?: number | null;
  partnerOptionId?: number | null;
  amountBeforeVat?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  discountAmount?: string | number | null;
  totalAmount?: string | number | null;
  acceptanceStatus?: ProjectAcceptanceStatus | null;
  inputInvoiceStatus?: ProjectInputInvoiceStatus | null;
  note?: string | null;
  quotation?: {
    id: number;
    quotationCode?: string | null;
  } | null;
  bankAccountOption?: AppOption | null;
  partnerOption?: AppOption | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectCostFormValues = {
  quotationId: string;
  transactionDate: string;
  status: ProjectCostStatus;
  cid: string;
  adAccount: string;
  bankAccountOptionId: string;
  partnerOptionId: string;
  amountBeforeVat: string;
  vatRate: string;
  discountAmount: string;
  acceptanceStatus: ProjectAcceptanceStatus;
  inputInvoiceStatus: ProjectInputInvoiceStatus;
  note: string;
};
