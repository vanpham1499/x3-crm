export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export type Invoice = {
  id: number;
  revenueId?: number | null;
  customerId?: number | null;
  invoiceType?: string | null;
  invoiceNo?: string | null;
  issuedDate?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
  address?: string | null;
  receiverEmail?: string | null;
  amountBeforeVat?: string | number | null;
  vatAmount?: string | number | null;
  amountAfterVat?: string | number | null;
  status?: InvoiceStatus | string | null;
  fileUrl?: string | null;
  note?: string | null;
  revenue?: {
    id: number;
    revenueCode?: string | null;
    project?: {
      id: number;
      projectCode?: string | null;
      projectName?: string | null;
    } | null;
  } | null;
  customer?: {
    id: number;
    customerCode?: string | null;
    customerName?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InvoiceFilters = {
  keyword: string;
  status: string;
};

export type InvoiceFormValues = {
  revenueId: string;
  invoiceType: string;
  invoiceNo: string;
  issuedDate: string;
  companyName: string;
  taxCode: string;
  address: string;
  receiverEmail: string;
  amountBeforeVat: string;
  vatAmount: string;
  amountAfterVat: string;
  status: string;
  fileUrl: string;
  note: string;
};
