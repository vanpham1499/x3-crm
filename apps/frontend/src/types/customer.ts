export type Customer = {
  customerCode: string;
  leadCode: string;
  status: string;
  createdAt: string;
  note: string;
  owner: string;
  source: string;
  service: string;
  planLink: string;
  phone: string;
  website: string;
  industry: string;
  zaloGroup: string;
  closedAt: string;
};

export type CustomerFormValues = {
  customerCode: string;
  status: string;
  createdAt: string;
  note: string;
  owners: string[];
  sources: string[];
  services: string[];
  planLink: string;
  phone: string;
  website: string;
  industry: string;
  zaloGroup: string;
  closedAt: string;
};

export type CustomerPayload = CustomerFormValues & {
  leadCode?: string;
};
