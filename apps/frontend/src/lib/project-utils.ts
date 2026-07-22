import type { ProjectFormValues, ProjectItem, ProjectType } from '@/types/project';
import type { ServiceItem } from '@/types/service';

export const DEFAULT_PROJECT_FILTERS = {
  keyword: '',
  service_id: '',
  status_option_id: '',
  manager_user_id: '',
  sales_user_id: '',
};

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function dateInputValue(value?: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function todayInputValue(): string {
  return dateInputValue(new Date().toISOString());
}

export function getProjectDefaults(
  project?: ProjectItem | null,
  defaults?: Partial<ProjectFormValues>,
): ProjectFormValues {
  return {
    projectCode: project?.projectCode || defaults?.projectCode || '',
    customerId: idToString(project?.customerId) || defaults?.customerId || '',
    quotationId: idToString(project?.quotationId) || defaults?.quotationId || '',
    serviceId: idToString(project?.serviceId) || defaults?.serviceId || '',
    projectName: project?.projectName || defaults?.projectName || '',
    projectType:
      project?.projectType === 'M' || project?.projectType === 'K' || project?.projectType === 'N'
        ? project.projectType
        : defaults?.projectType || 'K',
    statusOptionId: idToString(project?.statusOptionId) || defaults?.statusOptionId || '',
    managerUserId: idToString(project?.managerUserId) || defaults?.managerUserId || '',
    weeklyReportWeekday:
      idToString(project?.weeklySetting?.reportWeekday) || defaults?.weeklyReportWeekday || '',
    planLink: project?.planLink || defaults?.planLink || '',
    weeklyReportLink: project?.weeklyReportLink || defaults?.weeklyReportLink || '',
    customerTrackingReportLink:
      project?.customerTrackingReportLink || defaults?.customerTrackingReportLink || '',
    adminWebAccount: project?.adminWebAccount || defaults?.adminWebAccount || '',
    startDate:
      project?.startDate ||
      defaults?.startDate ||
      dateInputValue(project?.createdAt) ||
      todayInputValue(),
    endDate: project?.endDate || defaults?.endDate || '',
    note: project?.note || defaults?.note || '',
  };
}

export function toProjectPayload(values: ProjectFormValues) {
  const payload: Record<string, unknown> = {
    customerId: values.customerId,
    quotationId: values.quotationId || null,
    serviceId: values.serviceId,
    projectName: values.projectName.trim(),
    projectType: values.projectType,
    statusOptionId: values.statusOptionId || null,
    managerUserId: values.managerUserId || null,
    reportWeekday: values.weeklyReportWeekday ? Number(values.weeklyReportWeekday) : null,
    planLink: values.planLink.trim() || null,
    weeklyReportLink: values.weeklyReportLink.trim() || null,
    customerTrackingReportLink: values.customerTrackingReportLink.trim() || null,
    adminWebAccount: values.adminWebAccount.trim() || null,
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    note: values.note.trim() || null,
  };

  return payload;
}

export function getRootServiceCode(services: ServiceItem[], serviceId: string): string {
  for (const service of services) {
    if (String(service.id) === serviceId) return service.code;

    const childCode = getRootServiceCode(service.children || [], serviceId);
    if (childCode) return service.code;
  }

  return '';
}

export function getRootServiceItem(services: ServiceItem[], serviceId: string): ServiceItem | null {
  for (const service of services) {
    if (String(service.id) === serviceId) return service;

    const child = getRootServiceItem(service.children || [], serviceId);
    if (child) return service;
  }

  return null;
}

export function toCodeSegment(value?: string | null): string {
  return (value || '')
    .trim()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9._-]/g, '');
}

export function generateProjectCode({
  customerCode,
  rootServiceCode,
  projectType,
  projectName,
}: {
  customerCode?: string | null;
  rootServiceCode?: string | null;
  projectType?: ProjectType | null;
  projectName?: string | null;
}) {
  const parts = [
    customerCode,
    rootServiceCode,
    ...(projectType === 'N' ? [] : [projectType]),
    projectName,
  ].map((part) => toCodeSegment(part));

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
