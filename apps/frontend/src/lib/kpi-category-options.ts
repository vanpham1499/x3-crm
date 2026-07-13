import { KPI_CATEGORY_OPTION_GROUP, kpiCategoryFromOption } from '@/types/kpi';
import type { KpiPointType } from '@/types/kpi';
import type { AppOption } from '@/types/option';

export { KPI_CATEGORY_OPTION_GROUP };

export type KpiCategoryFormValues = {
  label: string;
  type: KpiPointType;
  defaultScore: string;
  isActive: boolean;
};

export function getKpiCategoryDefaults(option?: AppOption | null): KpiCategoryFormValues {
  if (!option) {
    return { label: '', type: 'bonus', defaultScore: '1', isActive: true };
  }

  const category = kpiCategoryFromOption(option);

  return {
    label: category.label,
    type: category.type,
    defaultScore: String(category.defaultScore),
    isActive: option.isActive !== false,
  };
}

export function toKpiCategoryPayload(values: KpiCategoryFormValues, sortOrder?: number | null) {
  return {
    group: KPI_CATEGORY_OPTION_GROUP,
    label: values.label.trim(),
    sortOrder: sortOrder ?? undefined,
    meta: {
      type: values.type,
      defaultScore: Number(values.defaultScore) || 0,
    },
    isActive: values.isActive,
  };
}
