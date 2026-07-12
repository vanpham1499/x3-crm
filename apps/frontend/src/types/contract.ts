import type { AppOption } from '@/types/option';

export type InvoiceRecipientType = 'customer' | 'other';

export type Contract = {
  id: number;
  projectId: number;
  quotationId?: number | null;
  leadId?: number | null;
  customerId?: number | null;
  contractNo?: string | null;
  contractStatusId?: number | null;
  contractStatusOptionId?: number | null;
  depositAmount?: string | number | null;
  signedDate?: string | null;
  expiredDate?: string | null;
  contractMonth?: string | null;
  fileUrl?: string | null;
  note?: string | null;
  invoiceRecipientType?: InvoiceRecipientType | null;
  invoiceRecipientName?: string | null;
  invoiceRepresentativeName?: string | null;
  invoiceTaxCode?: string | null;
  invoiceAddress?: string | null;
  invoiceEmail?: string | null;
  invoicePhone?: string | null;
  contractStatusOption?: AppOption | null;
  quotation?: {
    id: number;
    quotationCode?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ContractFormValues = {
  quotationId: string;
  contractNo: string;
  contractStatusOptionId: string;
  depositAmount: string;
  signedDate: string;
  expiredDate: string;
  contractMonth: string;
  fileUrl: string;
  note: string;
  invoiceRecipientType: InvoiceRecipientType;
  invoiceRecipientName: string;
  invoiceRepresentativeName: string;
  invoiceTaxCode: string;
  invoiceAddress: string;
  invoiceEmail: string;
  invoicePhone: string;
};
