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
  cidIsDead?: boolean;
  cidSpentAmount?: string | number | null;
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
  reconciledAt?: string | null;
  reconciledBy?: {
    id: number;
    code?: string | null;
    name?: string | null;
  } | null;
  project?: {
    id: number;
    projectCode?: string | null;
    projectName?: string | null;
    projectType?: string | null;
    customer?: {
      id: number;
      customerCode?: string | null;
      customerName?: string | null;
    } | null;
  } | null;
  quotation?: {
    id: number;
    quotationCode?: string | null;
  } | null;
  bankAccountOption?: AppOption | null;
  partnerOption?: AppOption | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectCostFilters = {
  keyword: string;
  entry_type: '' | ProjectCostEntryType;
  status: '' | ProjectCostStatus;
  reconciled_status: '' | 'matched' | 'unmatched';
  date_from: string;
  date_to: string;
};

export type ProjectCostFormValues = {
  quotationId: string;
  transactionDate: string;
  status: ProjectCostStatus;
  cid: string;
  adAccount: string;
  cidIsDead: boolean;
  cidSpentAmount: string;
  bankAccountOptionId: string;
  partnerOptionId: string;
  amountBeforeVat: string;
  vatRate: string;
  discountAmount: string;
  acceptanceStatus: ProjectAcceptanceStatus;
  inputInvoiceStatus: ProjectInputInvoiceStatus;
  note: string;
};
