import { P2_CATEGORY_OPTION_GROUP, p2CategoryFromOption } from '@/types/p2';
import type { P2PointType } from '@/types/p2';
import type { AppOption } from '@/types/option';

export { P2_CATEGORY_OPTION_GROUP };

export type P2CategoryFormValues = {
  label: string;
  type: P2PointType;
  defaultScore: string;
  isActive: boolean;
};

export function getP2CategoryDefaults(option?: AppOption | null): P2CategoryFormValues {
  if (!option) {
    return { label: '', type: 'bonus', defaultScore: '1', isActive: true };
  }

  const category = p2CategoryFromOption(option);

  return {
    label: category.label,
    type: category.type,
    defaultScore: String(category.defaultScore),
    isActive: option.isActive !== false,
  };
}

export function toP2CategoryPayload(values: P2CategoryFormValues, sortOrder?: number | null) {
  return {
    group: P2_CATEGORY_OPTION_GROUP,
    label: values.label.trim(),
    sortOrder: sortOrder ?? undefined,
    meta: {
      type: values.type,
      defaultScore: Number(values.defaultScore) || 0,
    },
    isActive: values.isActive,
  };
}
