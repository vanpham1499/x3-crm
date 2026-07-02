import type { Customer, CustomerFormValues, CustomerPayload } from '@/types/customer';

export function getDateInputValue(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function createEmptyCustomerFormValues(): CustomerFormValues {
  const today = getDateInputValue();

  return {
    customerCode: '',
    status: 'Theo dõi',
    createdAt: today,
    note: '',
    owners: [],
    sources: [],
    services: [],
    planLink: '',
    phone: '',
    website: '',
    industry: '',
    zaloGroup: '',
    closedAt: '',
  };
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    customerCode: customer.customerCode,
    status: customer.status || 'Theo dõi',
    createdAt: getDateInputValue(customer.createdAt),
    note: customer.note,
    owners: customer.owner ? [customer.owner] : [],
    sources: customer.source ? [customer.source] : [],
    services: customer.service
      ? customer.service
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    planLink: customer.planLink,
    phone: customer.phone,
    website: customer.website,
    industry: customer.industry,
    zaloGroup: customer.zaloGroup,
    closedAt: customer.closedAt ? getDateInputValue(customer.closedAt) : '',
  };
}

export function buildCustomerPayload(values: CustomerFormValues, leadCode?: string): CustomerPayload {
  return {
    ...values,
    leadCode,
    customerCode: values.customerCode.trim(),
    note: values.note.trim(),
    planLink: values.planLink.trim(),
    phone: values.phone.trim(),
    website: values.website.trim(),
    industry: values.industry.trim(),
    zaloGroup: values.zaloGroup.trim(),
  };
}

export function getUniqueCustomerOptions(customers: Customer[], key: keyof Customer) {
  const values = customers
    .flatMap((customer) => String(customer[key] || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'vi'));
}
