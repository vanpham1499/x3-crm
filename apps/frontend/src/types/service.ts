export type ServiceItem = {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  content?: string | null;
  invoiceContent?: string | null;
  invoiceTiming?: string | null;
  description?: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
  children?: ServiceItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type ServiceFilters = {
  keyword: string;
  is_active: string;
};

export type ServiceFormValues = {
  parentId: string;
  code: string;
  name: string;
  content: string;
  invoiceContent: string;
  invoiceTiming: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
};
