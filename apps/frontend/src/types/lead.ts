import type { AppOption } from '@/types/option';

export type LeadStatus = {
  id: string;
  type?: string;
  name: string;
  sortOrder?: number;
};

export type LeadRelationOption = {
  id: string;
  name: string;
  code?: string;
  email?: string;
};

export type Lead = {
  id: string;
  leadCode?: string | null;
  customerName: string;
  statusId?: string | null;
  statusOptionId?: string | null;
  occurredDate?: string | null;
  assignedUserId?: string | null;
  sourceId?: string | null;
  sourceOptionId?: string | null;
  industryOptionId?: string | null;
  interestedServiceOptionId?: string | null;
  interestedServiceOptionIds?: string[];
  interestedServiceId?: string | null;
  interestedServiceText?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  planLink?: string | null;
  zaloGroup?: string | null;
  note?: string | null;
  closedDate?: string | null;
  convertedCustomerId?: string | null;
  status?: LeadStatus | null;
  statusOption?: AppOption | null;
  assignedUser?: LeadRelationOption | null;
  source?: LeadRelationOption | null;
  sourceOption?: AppOption | null;
  industryOption?: AppOption | null;
  interestedServiceOption?: AppOption | null;
  interestedServiceOptions?: AppOption[];
  interestedService?: LeadRelationOption | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadFilters = {
  keyword: string;
  status_id: string;
  status_option_id: string;
  assigned_user_id: string;
  source_id: string;
  source_option_id: string;
  industry_option_id: string;
  interested_service_option_id: string;
  interested_service_id: string;
};

export type LeadFormValues = {
  customerName: string;
  statusId: string;
  statusOptionId: string;
  occurredDate: string;
  assignedUserId: string;
  sourceId: string;
  sourceOptionId: string;
  sourceName: string;
  interestedServiceOptionId: string;
  interestedServiceOptionIds: string[];
  interestedServiceId: string;
  interestedServiceText: string;
  phone: string;
  website: string;
  industry: string;
  planLink: string;
  zaloGroup: string;
  note: string;
  closedDate: string;
};

export type CustomerSourceOption = {
  id: string;
  name: string;
};
