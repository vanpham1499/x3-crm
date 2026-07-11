export type AppOption = {
  id: number;
  group: string;
  key?: string | null;
  value?: string | null;
  label: string;
  meta?: Record<string, unknown>;
  sortOrder?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OptionFormValues = {
  group: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

export type OptionGroupConfig = {
  group: string;
  title: string;
};
