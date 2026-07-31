import type { AppOption } from '@/types/option';

export const SERVICE_KPI_GROUP_OPTION_GROUP = 'service_kpi_group';

export type ServiceKpiGroupMeta = {
  serviceRootIds: number[];
};

export function getServiceKpiGroupMeta(option?: AppOption | null): ServiceKpiGroupMeta {
  const rawIds = Array.isArray(option?.meta?.serviceRootIds) ? option.meta.serviceRootIds : [];

  return {
    serviceRootIds: [...new Set(rawIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))],
  };
}

export function getServiceKpiGroupForRoot(groups: AppOption[], serviceRootId: number) {
  return (
    groups.find((group) => getServiceKpiGroupMeta(group).serviceRootIds.includes(serviceRootId)) ||
    null
  );
}

export function toServiceKpiGroupPayload(label: string, serviceRootIds: number[]) {
  return {
    group: SERVICE_KPI_GROUP_OPTION_GROUP,
    label: label.trim(),
    meta: {
      serviceRootIds: [...new Set(serviceRootIds.map(Number))],
    },
    isActive: true,
  };
}
