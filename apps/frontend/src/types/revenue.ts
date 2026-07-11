import type { ProjectCustomerSummary } from '@/types/project';
import type { ServiceItem } from '@/types/service';

export type RevenuePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type RevenueInvoiceStatus = 'not_issued' | 'issued';

export type RevenueItem = {
  id?: number;
  revenueId?: number;
  serviceId?: number | null;
  servicePackageId?: number | null;
  itemName: string;
  quantity?: string | number | null;
  unit?: string | null;
  unitPrice?: string | number | null;
  amount?: string | number | null;
  note?: string | null;
  service?: Pick<ServiceItem, 'id' | 'code' | 'name'> | null;
};

export type Revenue = {
  id: number;
  projectId?: number | null;
  revenueCode?: string | null;
  revenueType?: string | null;
  reportedDate?: string | null;
  paymentDueDate?: string | null;
  paidDate?: string | null;
  revenueMonth?: string | null;
  amountBeforeVat?: string | number | null;
  vatRate?: string | number | null;
  vatAmount?: string | number | null;
  amountAfterVat?: string | number | null;
  actualReceivedAmount?: string | number | null;
  paymentStatus?: RevenuePaymentStatus | string | null;
  invoiceStatus?: RevenueInvoiceStatus | string | null;
  note?: string | null;
  project?: {
    id: number;
    projectCode?: string | null;
    projectName?: string | null;
    customer?: Pick<ProjectCustomerSummary, 'id' | 'customerCode' | 'customerName'> | null;
  } | null;
  items?: RevenueItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type RevenueFilters = {
  keyword: string;
  project_id: string;
  payment_status: string;
  invoice_status: string;
};

export type RevenueLineFormValue = {
  id: number;
  serviceId: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type RevenueFormValues = {
  projectId: string;
  revenueCode: string;
  revenueType: string;
  reportedDate: string;
  paymentDueDate: string;
  paidDate: string;
  revenueMonth: string;
  vatRate: string;
  actualReceivedAmount: string;
  paymentStatus: string;
  invoiceStatus: string;
  note: string;
  items: RevenueLineFormValue[];
};
