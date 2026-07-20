import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';

export type QuotationStatus = 'draft' | 'won';

export type QuotationItem = {
  id?: number;
  quotationId?: number;
  serviceId?: number | null;
  itemCode?: string | null;
  itemName: string;
  description?: string | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  amountBeforeVat?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  amountAfterVat?: string | number | null;
  sortOrder?: number | null;
  metadata?: Record<string, unknown> | null;
  service?: ServiceItem | null;
};

export type Quotation = {
  id: number;
  quotationCode?: string | null;
  paymentContent?: string | null;
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  serviceId?: number | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  status?: QuotationStatus | string | null;
  subtotalAmount?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  totalAmount?: string | number | null;
  paidAmount?: string | number | null;
  outstandingAmount?: string | number | null;
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overpaid' | string | null;
  depositAmount?: string | number | null;
  validUntil?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  lead?: Pick<Lead, 'id' | 'leadCode' | 'customerName' | 'assignedUserId'> | null;
  customer?: Pick<Customer, 'id' | 'customerCode' | 'customerName' | 'salesUserId'> | null;
  project?: Pick<
    ProjectItem,
    'id' | 'projectCode' | 'projectName' | 'projectType' | 'managerUserId' | 'salesUserId'
  > | null;
  contract?: {
    id: number;
    contractNo?: string | null;
  } | null;
  service?: ServiceItem | null;
  items?: QuotationItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuotationFilters = {
  keyword: string;
  status: string;
};

export type QuotationLineFormValue = {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  locked?: boolean;
};
