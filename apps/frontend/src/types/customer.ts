import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export type CustomerLeadSummary = {
  id: string;
  leadCode?: string | null;
  customerName?: string | null;
};

export type Customer = {
  id: string;
  customerCode: string;
  leadCode?: string | null;
  status?: string | null;
  owner?: string | null;
  source?: string | null;
  service?: string | null;
  planLink?: string | null;
  zaloGroup?: string | null;
  closedAt?: string | null;
  leadId?: string | null;
  customerName: string;
  customerType?: string | null;
  customerTypeOptionId?: string | null;
  companyName?: string | null;
  representativeName?: string | null;
  taxCode?: string | null;
  identityNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  industryOptionId?: string | null;
  birthday?: string | null;
  sourceOptionId?: string | null;
  salesUserId?: string | null;
  note?: string | null;
  lead?: CustomerLeadSummary | null;
  customerTypeOption?: AppOption | null;
  sourceOption?: AppOption | null;
  industryOption?: AppOption | null;
  salesUser?: Pick<User, 'id' | 'code' | 'name' | 'email'> | null;
  projectsCount?: number;
  invoicesCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerFilters = {
  keyword: string;
  customer_type_option_id: string;
  source_option_id: string;
  industry_option_id: string;
  sales_user_id: string;
  lead_id: string;
};

export type CustomerFormValues = {
  customerCode: string;
  status?: string;
  createdAt?: string;
  owners?: string[];
  sources?: string[];
  services?: string[];
  planLink?: string;
  zaloGroup?: string;
  closedAt?: string;
  leadId: string;
  customerName: string;
  customerType: string;
  customerTypeOptionId: string;
  companyName: string;
  representativeName: string;
  taxCode: string;
  identityNo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  industry: string;
  industryOptionId: string;
  birthday: string;
  sourceOptionId: string;
  salesUserId: string;
  note: string;
};

export type CustomerPayload = {
  customerCode?: string | null;
  leadId?: string | null;
  customerName: string;
  customerType?: string | null;
  customerTypeOptionId?: string | null;
  companyName?: string | null;
  representativeName?: string | null;
  taxCode?: string | null;
  identityNo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  industryOptionId?: string | null;
  birthday?: string | null;
  sourceOptionId?: string | null;
  salesUserId?: string | null;
  note?: string | null;
};
