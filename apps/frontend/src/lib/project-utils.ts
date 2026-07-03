import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';

export const DEFAULT_PROJECT_FILTERS = {
  keyword: '',
  customer_id: '',
  service_id: '',
  status_option_id: '',
  manager_user_id: '',
  sales_user_id: '',
};

export function getProjectDefaults(
  project?: ProjectItem | null,
  defaults?: Partial<ProjectFormValues>,
): ProjectFormValues {
  return {
    projectCode: project?.projectCode || defaults?.projectCode || '',
    customerId: project?.customerId || defaults?.customerId || '',
    serviceId: project?.serviceId || defaults?.serviceId || '',
    projectName: project?.projectName || defaults?.projectName || '',
    statusOptionId: project?.statusOptionId || defaults?.statusOptionId || '',
    managerUserId: project?.managerUserId || defaults?.managerUserId || '',
    salesUserId: project?.salesUserId || defaults?.salesUserId || '',
    zaloGroup: project?.zaloGroup || defaults?.zaloGroup || '',
    planLink: project?.planLink || defaults?.planLink || '',
    startDate: project?.startDate || defaults?.startDate || '',
    endDate: project?.endDate || defaults?.endDate || '',
    note: project?.note || defaults?.note || '',
  };
}

export function toProjectPayload(values: ProjectFormValues) {
  return {
    projectCode: values.projectCode.trim() || null,
    customerId: values.customerId,
    serviceId: values.serviceId,
    projectName: values.projectName.trim(),
    statusOptionId: values.statusOptionId || null,
    managerUserId: values.managerUserId || null,
    salesUserId: values.salesUserId || null,
    zaloGroup: values.zaloGroup.trim() || null,
    planLink: values.planLink.trim() || null,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    note: values.note.trim() || null,
  };
}

export function getRootServiceCode(services: ServiceItem[], serviceId: string): string {
  for (const service of services) {
    if (service.id === serviceId) return service.code;

    const childCode = getRootServiceCode(service.children || [], serviceId);
    if (childCode) return service.code;
  }

  return '';
}

export function generateProjectCode({
  customerCode,
  rootServiceCode,
  projectName,
}: {
  customerCode?: string | null;
  rootServiceCode?: string | null;
  projectName?: string | null;
}) {
  const parts = [customerCode, rootServiceCode, projectName].map((part) => (part || '').trim());

  if (parts.some((part) => !part)) return '';

  return parts.join('.');
}

export function getProjectStatusColor(project: ProjectItem) {
  const color = project.statusOption?.meta?.color;

  return typeof color === 'string' && color.trim() ? color : '#64748b';
}

export function getProjectExternalUrl(value?: string | null) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function formatProjectDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
  } catch {
    return value;
  }
}
