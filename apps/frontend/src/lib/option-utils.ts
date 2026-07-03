import type { AppOption, OptionFormValues, OptionGroupConfig } from '@/types/option';

export const LEAD_OPTION_GROUPS: OptionGroupConfig[] = [
  {
    group: 'lead_status',
    title: 'Trạng thái lead',
  },
  {
    group: 'lead_source',
    title: 'Nguồn phát sinh',
  },
  {
    group: 'lead_service',
    title: 'Dịch vụ',
  },
];

export function getOptionColor(option?: AppOption | null) {
  const color = option?.meta?.color;

  return typeof color === 'string' && color ? color : '#00a878';
}

export function getOptionDefaults(group: string, option?: AppOption | null): OptionFormValues {
  return {
    group,
    label: option?.label || '',
    color: getOptionColor(option),
    sortOrder: option?.sortOrder ?? 0,
    isActive: option?.isActive ?? true,
  };
}

export function toOptionPayload(values: OptionFormValues) {
  return {
    group: values.group,
    label: values.label.trim(),
    meta: {
      color: values.color || '#00a878',
    },
    sortOrder: Number(values.sortOrder) || 0,
    isActive: values.isActive,
  };
}

export function groupOptions(options: AppOption[]) {
  const grouped = options.reduce<Record<string, AppOption[]>>((acc, option) => {
    acc[option.group] = acc[option.group] || [];
    acc[option.group].push(option);
    return acc;
  }, {});

  Object.keys(grouped).forEach((group) => {
    grouped[group].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.label.localeCompare(b.label),
    );
  });

  return grouped;
}
