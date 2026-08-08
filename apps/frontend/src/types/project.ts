import type { Customer } from '@/types/customer';
import type { Contract } from '@/types/contract';
import type { LeadTimelineEntry } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

export type ProjectUserSummary = Pick<User, 'id' | 'code' | 'name' | 'email' | 'departmentId'>;

export type ProjectType = 'K' | 'M' | 'O';
export type StoredProjectType = ProjectType | 'N';

export type ProjectCustomerSummary = Pick<
  Customer,
  'id' | 'customerCode' | 'customerName' | 'companyName' | 'phone' | 'email' | 'leadId'
>;

export type ProjectItem = {
  id: number;
  projectCode?: string | null;
  customerId: number;
  quotationId?: number | null;
  serviceId: number;
  projectName: string;
  projectType?: StoredProjectType | null;
  statusId?: number | null;
  statusOptionId?: number | null;
  managerUserId?: number | null;
  salesUserId?: number | null;
  zaloGroup?: string | null;
  planLink?: string | null;
  weeklyReportLink?: string | null;
  customerTrackingReportLink?: string | null;
  adminWebAccount?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  note?: string | null;
  customer?: ProjectCustomerSummary | null;
  quotation?: Pick<Quotation, 'id' | 'quotationCode'> | null;
  quotations?: Pick<Quotation, 'id' | 'quotationCode'>[];
  service?: ServiceItem | null;
  statusOption?: AppOption | null;
  managerUser?: ProjectUserSummary | null;
  salesUser?: ProjectUserSummary | null;
  createdBy?: ProjectUserSummary | null;
  weeklySetting?: {
    id: number;
    reportOwnerUserId?: number | null;
    reportWeekday?: number | null;
    monthlyBudget?: string | number | null;
    isActive?: boolean;
  } | null;
  contracts?: Contract[];
  payments?: ProjectPaymentSummary[];
  timelines?: LeadTimelineEntry[];
  canUpdate?: boolean;
  canDelete?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectPaymentSummary = {
  id: number;
  quotationId?: number | null;
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  transactionDate?: string | null;
  transactionContent?: string | null;
  amount?: string | number | null;
  status?: string | null;
  reconciledStatus?: string | null;
};

export type ProjectFilters = {
  keyword: string;
  service_id: string;
  status_option_id: string;
  manager_user_id: string;
  sales_user_id: string;
};

export type ProjectFormValues = {
  projectCode: string;
  customerId: string;
  serviceId: string;
  projectName: string;
  projectType: ProjectType;
  statusOptionId: string;
  managerUserId: string;
  weeklyReportWeekday: string;
  planLink: string;
  monthlyBudget: string;
  customerTrackingReportLink: string;
  adminWebAccount: string;
  startDate: string;
  endDate: string;
  note: string;
};
