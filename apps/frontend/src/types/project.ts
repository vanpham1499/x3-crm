import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export type ProjectUserSummary = Pick<User, 'id' | 'code' | 'name' | 'email'>;

export type ProjectCustomerSummary = Pick<
  Customer,
  'id' | 'customerCode' | 'customerName' | 'companyName' | 'phone' | 'email' | 'leadId'
>;

export type ProjectContract = {
  id: string;
  projectId?: string | null;
  contractNo?: string | null;
  contractStatusId?: string | null;
  contractStatusOptionId?: string | null;
  depositAmount?: number | string | null;
  signedDate?: string | null;
  expiredDate?: string | null;
  contractMonth?: string | null;
  fileUrl?: string | null;
  note?: string | null;
  contractStatusOption?: AppOption | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectItem = {
  id: string;
  projectCode?: string | null;
  customerId: string;
  quotationId?: string | null;
  serviceId: string;
  projectName: string;
  statusId?: string | null;
  statusOptionId?: string | null;
  managerUserId?: string | null;
  salesUserId?: string | null;
  zaloGroup?: string | null;
  planLink?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  customer?: ProjectCustomerSummary | null;
  quotation?: Pick<Quotation, 'id' | 'quotationCode'> | null;
  service?: ServiceItem | null;
  statusOption?: AppOption | null;
  managerUser?: ProjectUserSummary | null;
  salesUser?: ProjectUserSummary | null;
  contracts?: ProjectContract[];
  payments?: ProjectPaymentSummary[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectPaymentSummary = {
  id: string;
  quotationId?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  contractId?: string | null;
  transactionDate?: string | null;
  transactionContent?: string | null;
  amount?: string | number | null;
  status?: string | null;
  reconciledStatus?: string | null;
};

export type ProjectFilters = {
  keyword: string;
  customer_id: string;
  service_id: string;
  status_option_id: string;
  manager_user_id: string;
  sales_user_id: string;
};

export type ProjectFormValues = {
  projectCode: string;
  customerId: string;
  quotationId: string;
  serviceId: string;
  projectName: string;
  statusOptionId: string;
  managerUserId: string;
  salesUserId: string;
  zaloGroup: string;
  planLink: string;
  startDate: string;
  endDate: string;
  note: string;
  contractId: string;
  contractNo: string;
  contractStatusOptionId: string;
  depositAmount: string;
  signedDate: string;
  expiredDate: string;
  contractMonth: string;
  fileUrl: string;
  contractNote: string;
};
