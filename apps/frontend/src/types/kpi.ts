import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export type KpiPointType = 'bonus' | 'penalty';

export const KPI_CATEGORY_OPTION_GROUP = 'kpi_category';

export type KpiCategory = {
  key: string;
  label: string;
  type: KpiPointType;
  defaultScore: number;
};

export function kpiCategoryFromOption(option: AppOption): KpiCategory {
  const meta = option.meta || {};
  const defaultScore = Number(meta.defaultScore);

  return {
    key: option.key || '',
    label: option.label,
    type: meta.type === 'bonus' ? 'bonus' : 'penalty',
    defaultScore: Number.isFinite(defaultScore) ? defaultScore : 0,
  };
}

export type KpiPoint = {
  id: number;
  userId: number;
  entryDate: string;
  category: string;
  categoryLabel?: string;
  type: KpiPointType;
  score: string | number;
  customerRef?: string | null;
  note?: string | null;
  isApproved: boolean;
  approvedBy?: number | null;
  approvedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'code'> | null;
  approver?: Pick<User, 'id' | 'name'> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KpiPointFilters = {
  userId: string;
  category: string;
  type: string;
  dateFrom: string;
  dateTo: string;
};

export type KpiPointFormValues = {
  userId: string;
  entryDate: string;
  category: string;
  score: string;
  customerRef: string;
  note: string;
};
