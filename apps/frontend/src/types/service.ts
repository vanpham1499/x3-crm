export type ServiceItem = {
  id: number;
  parentId?: number | null;
  code: string;
  name: string;
  content?: string | null;
  invoiceContent?: string | null;
  invoiceTiming?: string | null;
  description?: string | null;
  level: number;
  sortOrder: number;
  unit?: string | null;
  defaultPrice?: number | null;
  isActive: boolean;
  parent?: {
    id: number;
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
  unit: string;
  defaultPrice: string;
  isActive: boolean;
};
