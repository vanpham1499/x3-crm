import type { AppOption } from '@/types/option';

export type ProjectCostEntryType = 'ad_spend' | 'partner_cost';
export type ProjectCostStatus = 'pending' | 'completed' | 'cancelled';
export type ProjectAcceptanceStatus = 'pending' | 'accepted' | 'not_required';
export type ProjectInputInvoiceStatus = 'pending' | 'received' | 'not_required';
export type ProjectCostReconciliationResult =
  | 'matched'
  | 'matched_with_note'
  | 'difference'
  | 'pending_documents'
  | 'cancelled';
export type ProjectCostInvoiceStatus = 'pending' | 'waiting' | 'received' | 'not_required';
export type ProjectCostInvoiceRecipientType = 'customer' | 'company' | 'other';
export type ProjectCostBalanceStatus = 'none' | 'pending' | 'resolved';
export type ProjectCostAdjustmentType =
  | 'additional_topup'
  | 'previous_period_balance'
  | 'transfer_to_cid'
  | 'carry_forward'
  | 'customer_bonus'
  | 'company_compensation'
  | 'refund_company'
  | 'refund_customer'
  | 'bank_fee'
  | 'rounding'
  | 'offset_next_topup'
  | 'other';
export type ProjectCostAdjustmentStatus = 'pending' | 'completed' | 'cancelled';

export type ProjectCostAdjustment = {
  id?: number;
  adjustmentType: ProjectCostAdjustmentType;
  status: ProjectCostAdjustmentStatus;
  amount: string | number;
  reference?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
  invoiceNumber?: string | null;
  reconciliationResult?: ProjectCostReconciliationResult | null;
  invoiceStatus?: ProjectCostInvoiceStatus | null;
  invoiceRecipientType?: ProjectCostInvoiceRecipientType | null;
  invoiceRecipientName?: string | null;
  reconciliationNote?: string | null;
  cashOutAmount?: string | number | null;
  actualCostAmount?: string | number | null;
  originalBalanceAmount?: string | number | null;
  handledBalanceAmount?: string | number | null;
  releasedBalanceAmount?: string | number | null;
  remainingBalanceAmount?: string | number | null;
  realizedCostAmount?: string | number | null;
  balanceStatus?: ProjectCostBalanceStatus | null;
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
  adjustments?: ProjectCostAdjustment[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectCostFilters = {
  keyword: string;
  entry_type: '' | ProjectCostEntryType;
  status: '' | ProjectCostStatus;
  reconciled_status: '' | 'matched' | 'unmatched';
  reconciliation_result: '' | ProjectCostReconciliationResult;
  balance_status: '' | ProjectCostBalanceStatus;
  date_from: string;
  date_to: string;
};

export type ProjectCostReconciliationInput = {
  reconciliationResult: ProjectCostReconciliationResult;
  invoiceStatus: ProjectCostInvoiceStatus;
  invoiceNumber?: string | null;
  invoiceRecipientType: ProjectCostInvoiceRecipientType;
  invoiceRecipientName?: string | null;
  reconciliationNote?: string | null;
  adjustments: ProjectCostAdjustment[];
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
