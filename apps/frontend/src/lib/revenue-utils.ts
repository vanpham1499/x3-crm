import type { Revenue, RevenueFormValues, RevenueLineFormValue } from '@/types/revenue';

export const DEFAULT_REVENUE_FILTERS = {
  keyword: '',
  project_id: '',
  payment_status: '',
  invoice_status: '',
};

export const REVENUE_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Chưa thu',
  partial: 'Thu một phần',
  paid: 'Đã thu',
};

export const REVENUE_INVOICE_STATUS_LABELS: Record<string, string> = {
  not_issued: 'Chưa xuất HĐ',
  issued: 'Đã xuất HĐ',
};

let lineSeed = 0;

function nextLineId(): number {
  lineSeed -= 1;
  return lineSeed;
}

function toStringValue(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

export function createEmptyRevenueLine(defaults?: Partial<RevenueLineFormValue>): RevenueLineFormValue {
  return {
    id: nextLineId(),
    serviceId: defaults?.serviceId || '',
    name: defaults?.name || '',
    unit: defaults?.unit || '',
    quantity: defaults?.quantity || '1',
    unitPrice: defaults?.unitPrice || '',
  };
}

export function getRevenueDefaults(
  revenue?: Revenue | null,
  defaults?: Partial<RevenueFormValues>,
): RevenueFormValues {
  const items: RevenueLineFormValue[] =
    revenue?.items && revenue.items.length > 0
      ? revenue.items.map((item) =>
          createEmptyRevenueLine({
            serviceId: toStringValue(item.serviceId),
            name: item.itemName,
            unit: item.unit || '',
            quantity: toStringValue(item.quantity) || '1',
            unitPrice: toStringValue(item.unitPrice),
          }),
        )
      : [createEmptyRevenueLine()];

  return {
    projectId: toStringValue(revenue?.projectId) || defaults?.projectId || '',
    revenueCode: revenue?.revenueCode || defaults?.revenueCode || '',
    revenueType: revenue?.revenueType || defaults?.revenueType || 'service_fee',
    reportedDate: revenue?.reportedDate || defaults?.reportedDate || '',
    paymentDueDate: revenue?.paymentDueDate || defaults?.paymentDueDate || '',
    paidDate: revenue?.paidDate || defaults?.paidDate || '',
    revenueMonth: revenue?.revenueMonth || defaults?.revenueMonth || '',
    vatRate: toStringValue(revenue?.vatRate) || defaults?.vatRate || '8',
    actualReceivedAmount: toStringValue(revenue?.actualReceivedAmount) || defaults?.actualReceivedAmount || '',
    paymentStatus: revenue?.paymentStatus || defaults?.paymentStatus || 'unpaid',
    invoiceStatus: revenue?.invoiceStatus || defaults?.invoiceStatus || 'not_issued',
    note: revenue?.note || defaults?.note || '',
    items,
  };
}

export function computeLineAmount(line: RevenueLineFormValue): number {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;

  return Math.round(quantity * unitPrice);
}

export function computeRevenueTotals(items: RevenueLineFormValue[], vatRate: string) {
  const subtotal = items.reduce((sum, line) => sum + computeLineAmount(line), 0);
  const rate = Number(vatRate) || 0;
  const vatAmount = Math.round((subtotal * rate) / 100);
  const total = subtotal + vatAmount;

  return { subtotal, vatAmount, total };
}

export function toRevenuePayload(values: RevenueFormValues) {
  const items = values.items
    .filter((line) => line.name.trim())
    .map((line) => ({
      serviceId: line.serviceId || null,
      itemName: line.name.trim(),
      item_name: line.name.trim(),
      quantity: Number(line.quantity) || 1,
      unit: line.unit.trim() || null,
      unitPrice: Number(line.unitPrice) || 0,
      amount: computeLineAmount(line),
    }));

  const { total } = computeRevenueTotals(values.items, values.vatRate);

  return {
    projectId: values.projectId,
    revenueCode: values.revenueCode.trim() || null,
    revenueType: values.revenueType.trim() || null,
    reportedDate: values.reportedDate || null,
    paymentDueDate: values.paymentDueDate || null,
    paidDate: values.paidDate || null,
    revenueMonth: values.revenueMonth || null,
    vatRate: Number(values.vatRate) || 0,
    actualReceivedAmount: values.actualReceivedAmount ? Number(values.actualReceivedAmount) : total,
    paymentStatus: values.paymentStatus,
    invoiceStatus: values.invoiceStatus,
    note: values.note.trim() || null,
    items,
  };
}

export function formatRevenueMonth(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('vi-VN', { month: '2-digit', year: 'numeric' }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}
