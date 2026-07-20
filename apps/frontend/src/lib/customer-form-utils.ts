import type { Customer, CustomerFormValues, CustomerPayload } from '@/types/customer';
import type { Lead } from '@/types/lead';

export function getDateInputValue(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function emptyToNull(value: unknown) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

export function createEmptyCustomerFormValues(lead?: Lead | null): CustomerFormValues {
  return {
    customerCode: '',
    leadId: idToString(lead?.id),
    customerName: lead?.customerName || '',
    customerType: '',
    customerTypeOptionId: '',
    companyName: lead?.customerName || '',
    representativeName: '',
    taxCode: '',
    identityNo: '',
    identityImageUrls: [],
    address: '',
    phone: lead?.phone || '',
    email: '',
    invoiceEmail: '',
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
    identityImageUrls: customer.identityImageUrls || [],
    address: customer.address || '',
    phone: customer.phone || '',
    email: customer.email || '',
    invoiceEmail: customer.invoiceEmail || '',
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
    leadId: emptyToNull(values.leadId),
    customerName: String(values.customerName || '').trim(),
    customerType: null,
    customerTypeOptionId: emptyToNull(values.customerTypeOptionId),
    companyName: emptyToNull(values.companyName),
    representativeName: emptyToNull(values.representativeName),
    taxCode: emptyToNull(values.taxCode),
    identityNo: emptyToNull(values.identityNo),
    identityImageUrls: values.identityImageUrls,
    address: emptyToNull(values.address),
    phone: emptyToNull(values.phone),
    email: emptyToNull(values.email),
    invoiceEmail: emptyToNull(values.invoiceEmail),
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
