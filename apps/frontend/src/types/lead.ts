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
  occurredDate?: string | null;
  assignedUserId?: string | null;
  sourceId?: string | null;
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
  assignedUser?: LeadRelationOption | null;
  source?: LeadRelationOption | null;
  interestedService?: LeadRelationOption | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadFilters = {
  keyword: string;
  status_id: string;
  assigned_user_id: string;
  source_id: string;
  interested_service_id: string;
};

export type LeadFormValues = {
  leadCode: string;
  customerName: string;
  statusId: string;
  occurredDate: string;
  assignedUserId: string;
  sourceId: string;
  sourceName: string;
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
