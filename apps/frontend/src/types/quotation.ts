import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export type QuotationStatus = 'draft' | 'won' | 'refunded';

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
  grossPaidAmount?: string | number | null;
  refundedAmount?: string | number | null;
  depositRefundedAmount?: string | number | null;
  paymentRefundedAmount?: string | number | null;
  compensationAmount?: string | number | null;
  outboundAmount?: string | number | null;
  overCompensationAmount?: string | number | null;
  collectibleAmount?: string | number | null;
  outstandingAmount?: string | number | null;
  paymentStatus?:
    'unpaid' | 'partial' | 'paid' | 'overpaid' | 'partially_refunded' | 'refunded' | string | null;
  isFullyRefunded?: boolean;
  isPaymentLocked?: boolean;
  depositAmount?: string | number | null;
  accountReconciliationImageUrls?: string[];
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
  createdBy?: Pick<User, 'id' | 'code' | 'name' | 'email'> | null;
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
