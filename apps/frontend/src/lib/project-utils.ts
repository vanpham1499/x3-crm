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

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

export function getProjectDefaults(
  project?: ProjectItem | null,
  defaults?: Partial<ProjectFormValues>,
): ProjectFormValues {
  const contract = project?.contracts?.[0];

  return {
    projectCode: project?.projectCode || defaults?.projectCode || '',
    customerId: idToString(project?.customerId) || defaults?.customerId || '',
    quotationId: idToString(project?.quotationId) || defaults?.quotationId || '',
    serviceId: idToString(project?.serviceId) || defaults?.serviceId || '',
    projectName: project?.projectName || defaults?.projectName || '',
    statusOptionId: idToString(project?.statusOptionId) || defaults?.statusOptionId || '',
    managerUserId: idToString(project?.managerUserId) || defaults?.managerUserId || '',
    salesUserId: idToString(project?.salesUserId) || defaults?.salesUserId || '',
    zaloGroup: project?.zaloGroup || defaults?.zaloGroup || '',
    planLink: project?.planLink || defaults?.planLink || '',
    startDate: project?.startDate || defaults?.startDate || '',
    endDate: project?.endDate || defaults?.endDate || '',
    note: project?.note || defaults?.note || '',
    contractId: idToString(contract?.id) || defaults?.contractId || '',
    contractNo: project?.projectCode || contract?.contractNo || defaults?.contractNo || '',
    contractStatusOptionId:
      idToString(contract?.contractStatusOptionId) || defaults?.contractStatusOptionId || '',
    depositAmount:
      contract?.depositAmount !== undefined && contract?.depositAmount !== null
        ? String(contract.depositAmount)
        : defaults?.depositAmount || '',
    signedDate: contract?.signedDate || defaults?.signedDate || '',
    expiredDate: contract?.expiredDate || defaults?.expiredDate || '',
    contractMonth: contract?.contractMonth || defaults?.contractMonth || '',
    fileUrl: contract?.fileUrl || defaults?.fileUrl || '',
    contractNote: contract?.note || defaults?.contractNote || '',
  };
}

export function toProjectPayload(values: ProjectFormValues) {
  const payload: Record<string, unknown> = {
    projectCode: values.projectCode.trim() || null,
    customerId: values.customerId,
    quotationId: values.quotationId || null,
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

  const hasContract =
    Boolean(values.contractId) ||
    [
      values.contractNo,
      values.contractStatusOptionId,
      values.depositAmount,
      values.signedDate,
      values.expiredDate,
      values.contractMonth,
      values.fileUrl,
      values.contractNote,
    ].some((value) => value.trim());

  if (hasContract) {
    payload.contract = {
      id: values.contractId || undefined,
      contractNo: values.contractNo.trim() || null,
      contractStatusOptionId: values.contractStatusOptionId || null,
      depositAmount: values.depositAmount ? Number(values.depositAmount) : null,
      signedDate: values.signedDate || null,
      expiredDate: values.expiredDate || null,
      contractMonth: values.contractMonth.trim() || null,
      fileUrl: values.fileUrl.trim() || null,
      note: values.contractNote.trim() || null,
    };
  }

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

export function toCodeSegment(value?: string | null): string {
  return (value || '')
    .trim()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '');
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
  const parts = [customerCode, rootServiceCode, projectName].map((part) => toCodeSegment(part));

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
