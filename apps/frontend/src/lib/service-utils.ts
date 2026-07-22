import type { ServiceFormValues, ServiceItem } from '@/types/service';

export type FlatServiceItem = ServiceItem & {
  depth: number;
  pathName: string;
};

export function flattenServices(
  services: ServiceItem[],
  depth = 0,
  parentPath = '',
): FlatServiceItem[] {
  return services.flatMap((service) => {
    const pathName = parentPath ? `${parentPath} / ${service.name}` : service.name;
    const current: FlatServiceItem = { ...service, depth, pathName };

    return [current, ...flattenServices(service.children || [], depth + 1, pathName)];
  });
}

export function countServices(services: ServiceItem[]) {
  const flat = flattenServices(services);

  return {
    total: flat.length,
    active: flat.filter((service) => service.isActive).length,
    root: flat.filter((service) => !service.parentId).length,
  };
}

export function getServiceSiblings(services: ServiceItem[], parentId: number | null) {
  if (parentId === null) return services;

  for (const service of services) {
    if (service.id === parentId) return service.children || [];

    const nested = getServiceSiblings(service.children || [], parentId);
    if (nested.length > 0) return nested;
  }

  return [];
}

export function reorderServiceSiblings(
  services: ServiceItem[],
  parentId: number | null,
  orderedIds: number[],
): ServiceItem[] {
  const applyOrder = (siblings: ServiceItem[]) => {
    const siblingMap = new Map(siblings.map((service) => [service.id, service]));

    return orderedIds
      .map((id, index) => {
        const service = siblingMap.get(id);
        return service ? { ...service, sortOrder: (index + 1) * 10 } : null;
      })
      .filter((service): service is ServiceItem => Boolean(service));
  };

  if (parentId === null) return applyOrder(services);

  return services.map((service) =>
    service.id === parentId
      ? { ...service, children: applyOrder(service.children || []) }
      : {
          ...service,
          children: reorderServiceSiblings(service.children || [], parentId, orderedIds),
        },
  );
}

export function getServiceDefaults(
  service?: ServiceItem,
  parent?: ServiceItem | null,
): ServiceFormValues {
  return {
    parentId:
      service?.parentId !== undefined && service?.parentId !== null
        ? String(service.parentId)
        : parent?.id !== undefined && parent?.id !== null
          ? String(parent.id)
          : '',
    code: service?.code || '',
    name: service?.name || '',
    content: service?.content || '',
    invoiceContent: service?.invoiceContent || '',
    invoiceTiming: service?.invoiceTiming || '',
  };
}

export function toServicePayload(values: ServiceFormValues) {
  return {
    parentId: values.parentId || null,
    code: values.code.trim(),
    name: values.name.trim(),
    content: values.content.trim() || null,
    invoiceContent: values.invoiceContent.trim() || null,
    invoiceTiming: values.invoiceTiming.trim() || null,
  };
}
