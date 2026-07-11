import { flattenServices } from '@/lib/service-utils';
import type { Customer, CustomerFormValues, CustomerPayload } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { ServiceItem } from '@/types/service';

export function getDateInputValue(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function findRootService(service: ServiceItem, services: ServiceItem[]) {
  const flatServices = flattenServices(services);
  const serviceMap = new Map(flatServices.map((item) => [item.id, item]));
  let current = serviceMap.get(service.id) || service;

  while (current.parentId && serviceMap.has(current.parentId)) {
    current = serviceMap.get(current.parentId)!;
  }

  return current;
}

export function findLeadSelectedService(lead: Lead | null | undefined, services: ServiceItem[]) {
  if (!lead) return null;

  const flatServices = flattenServices(services);

  if (lead.interestedServiceId) {
    const service = flatServices.find((item) => item.id === lead.interestedServiceId);
    if (service) return service;
  }

  if (lead.interestedService?.id) {
    const service = flatServices.find((item) => item.id === lead.interestedService?.id);
    if (service) return service;
  }

  const serviceLabels = [
    ...(lead.interestedServiceOptions || []).map((option) => option.label),
    lead.interestedServiceOption?.label,
    lead.interestedService?.name,
    lead.interestedServiceText,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return (
    flatServices.find((service) =>
      serviceLabels.some(
        (label) =>
          service.name.trim().toLowerCase() === label ||
          service.code.trim().toLowerCase() === label,
      ),
    ) || null
  );
}

export function getRootServiceCodeForLead(lead: Lead | null | undefined, services: ServiceItem[]) {
  const selectedService = findLeadSelectedService(lead, services);
  if (!selectedService) return 'DV1';

  return findRootService(selectedService, services).code || selectedService.code || 'DV1';
}

export function generateCustomerCodeFromLead(
  lead: Lead | null | undefined,
  _services: ServiceItem[],
) {
  return lead?.leadCode || '';
}

export function createEmptyCustomerFormValues(
  lead?: Lead | null,
  services: ServiceItem[] = [],
): CustomerFormValues {
  return {
    customerCode: lead ? generateCustomerCodeFromLead(lead, services) : '',
    leadId: idToString(lead?.id),
    customerName: lead?.customerName || '',
    customerType: '',
    customerTypeOptionId: '',
    companyName: lead?.customerName || '',
    representativeName: '',
    taxCode: '',
    identityNo: '',
    address: '',
    phone: lead?.phone || '',
    email: '',
    website: lead?.website || '',
    industry: lead?.industryOption?.label || lead?.industry || '',
    industryOptionId: '',
    birthday: '',
    sourceOptionId: idToString(lead?.sourceOptionId),
    salesUserId: idToString(lead?.assignedUserId),
    note: lead?.note || '',
  };
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    customerCode: customer.customerCode || '',
    leadId: idToString(customer.leadId ?? customer.lead?.id),
    customerName: customer.customerName || '',
    customerType: '',
    customerTypeOptionId: idToString(customer.customerTypeOptionId),
    companyName: customer.companyName || '',
    representativeName: customer.representativeName || '',
    taxCode: customer.taxCode || '',
    identityNo: customer.identityNo || '',
    address: customer.address || '',
    phone: customer.phone || '',
    email: customer.email || '',
    website: customer.website || '',
    industry: customer.industry || '',
    industryOptionId: '',
    birthday: getDateInputValue(customer.birthday),
    sourceOptionId: idToString(customer.sourceOptionId),
    salesUserId: idToString(customer.salesUserId),
    note: customer.note || '',
  };
}

export function buildCustomerPayload(values: CustomerFormValues): CustomerPayload {
  return {
    customerCode: emptyToNull(values.customerCode),
    leadId: emptyToNull(values.leadId),
    customerName: values.customerName.trim(),
    customerType: null,
    customerTypeOptionId: emptyToNull(values.customerTypeOptionId),
    companyName: emptyToNull(values.companyName),
    representativeName: emptyToNull(values.representativeName),
    taxCode: emptyToNull(values.taxCode),
    identityNo: emptyToNull(values.identityNo),
    address: emptyToNull(values.address),
    phone: emptyToNull(values.phone),
    email: emptyToNull(values.email),
    website: emptyToNull(values.website),
    industry: emptyToNull(values.industry),
    industryOptionId: null,
    birthday: values.birthday || null,
    sourceOptionId: emptyToNull(values.sourceOptionId),
    salesUserId: emptyToNull(values.salesUserId),
    note: emptyToNull(values.note),
  };
}

export function getUniqueCustomerOptions(customers: Customer[], key: keyof Customer) {
  const values = customers
    .flatMap((customer) => String(customer[key] || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'vi'));
}
