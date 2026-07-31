import { DEFAULT_STATUS_COLOR } from '@/lib/status-colors';
import type { AppOption, OptionFormValues, OptionGroupConfig } from '@/types/option';

export const PROJECT_STATUS_OPTION_GROUP = 'project_status';
export const PROJECT_STATUS_REQUIRES_WEEKLY_REPORT_META = 'requiresWeeklyReport';

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
    group: 'industry',
    title: 'Ngành nghề',
  },
  {
    group: 'lead_service',
    title: 'Dịch vụ',
  },
];

export const CUSTOMER_OPTION_GROUPS: OptionGroupConfig[] = [
  {
    group: 'customer_type',
    title: 'Loại khách hàng',
  },
];

export const PROJECT_OPTION_GROUPS: OptionGroupConfig[] = [
  {
    group: PROJECT_STATUS_OPTION_GROUP,
    title: 'Trạng thái dự án',
  },
  {
    group: 'contract_status',
    title: 'Trạng thái hợp đồng',
  },
];

export const WEEKLY_CONDITION_OPTION_GROUP = 'weekly_condition';

export const REPORT_OPTION_GROUPS: OptionGroupConfig[] = [
  {
    group: WEEKLY_CONDITION_OPTION_GROUP,
    title: 'Tình trạng tuần',
  },
];

export const OPTION_SECTIONS = [
  {
    title: 'Lead',
    groups: LEAD_OPTION_GROUPS,
  },
  {
    title: 'Khách hàng',
    groups: CUSTOMER_OPTION_GROUPS,
  },
  {
    title: 'Dự án',
    groups: PROJECT_OPTION_GROUPS,
  },
  {
    title: 'Báo cáo',
    groups: REPORT_OPTION_GROUPS,
  },
];

export const SYSTEM_OPTION_GROUPS = OPTION_SECTIONS.flatMap((section) =>
  section.groups.map((group) => group.group),
);

export function getOptionColor(option?: AppOption | null) {
  const color = option?.meta?.color;

  return typeof color === 'string' && color ? color : DEFAULT_STATUS_COLOR;
}

export function getOptionDefaults(group: string, option?: AppOption | null): OptionFormValues {
  return {
    group,
    label: option?.label || '',
    color: getOptionColor(option),
    requiresWeeklyReport: projectStatusRequiresWeeklyReport(option),
    sortOrder: option?.sortOrder ?? 0,
    isActive: option?.isActive ?? true,
  };
}

export function toOptionPayload(values: OptionFormValues) {
  const projectStatusMeta =
    values.group === PROJECT_STATUS_OPTION_GROUP
      ? {
          [PROJECT_STATUS_REQUIRES_WEEKLY_REPORT_META]: values.requiresWeeklyReport,
        }
      : {};

  return {
    group: values.group,
    label: values.label.trim(),
    meta: {
      color: values.color || DEFAULT_STATUS_COLOR,
      ...projectStatusMeta,
    },
    sortOrder: Number(values.sortOrder) || 0,
    isActive: values.isActive,
  };
}

export function projectStatusRequiresWeeklyReport(option?: AppOption | null) {
  const value = option?.meta?.[PROJECT_STATUS_REQUIRES_WEEKLY_REPORT_META];

  return value !== false && value !== 'false' && value !== 0 && value !== '0';
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
