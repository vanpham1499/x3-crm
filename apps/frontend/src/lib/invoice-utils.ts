import type { Invoice, InvoiceFormValues } from '@/types/invoice';
import type { Revenue } from '@/types/revenue';

export const DEFAULT_INVOICE_FILTERS = {
  keyword: '',
  status: '',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  issued: 'Đã xuất',
  cancelled: 'Đã hủy',
};

function toStringValue(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

export function getInvoiceDefaults(
  invoice?: Invoice | null,
  revenue?: Revenue | null,
  defaults?: Partial<InvoiceFormValues>,
): InvoiceFormValues {
  return {
    revenueId: toStringValue(invoice?.revenueId) || toStringValue(revenue?.id) || defaults?.revenueId || '',
    invoiceType: invoice?.invoiceType || defaults?.invoiceType || 'vat',
    invoiceNo: invoice?.invoiceNo || defaults?.invoiceNo || '',
    issuedDate: invoice?.issuedDate || defaults?.issuedDate || '',
    companyName: invoice?.companyName || defaults?.companyName || '',
    taxCode: invoice?.taxCode || defaults?.taxCode || '',
    address: invoice?.address || defaults?.address || '',
    receiverEmail: invoice?.receiverEmail || defaults?.receiverEmail || '',
    amountBeforeVat:
      toStringValue(invoice?.amountBeforeVat) || toStringValue(revenue?.amountBeforeVat) || defaults?.amountBeforeVat || '',
    vatAmount: toStringValue(invoice?.vatAmount) || toStringValue(revenue?.vatAmount) || defaults?.vatAmount || '',
    amountAfterVat:
      toStringValue(invoice?.amountAfterVat) || toStringValue(revenue?.amountAfterVat) || defaults?.amountAfterVat || '',
    status: invoice?.status || defaults?.status || 'draft',
    fileUrl: invoice?.fileUrl || defaults?.fileUrl || '',
    note: invoice?.note || defaults?.note || '',
  };
}

export function toInvoicePayload(values: InvoiceFormValues) {
  return {
    revenueId: values.revenueId || undefined,
    invoiceType: values.invoiceType.trim() || null,
    invoiceNo: values.invoiceNo.trim() || null,
    issuedDate: values.issuedDate || null,
    companyName: values.companyName.trim() || null,
    taxCode: values.taxCode.trim() || null,
    address: values.address.trim() || null,
    receiverEmail: values.receiverEmail.trim() || null,
    amountBeforeVat: values.amountBeforeVat ? Number(values.amountBeforeVat) : null,
    vatAmount: values.vatAmount ? Number(values.vatAmount) : null,
    amountAfterVat: values.amountAfterVat ? Number(values.amountAfterVat) : null,
    status: values.status,
    fileUrl: values.fileUrl.trim() || null,
    note: values.note.trim() || null,
  };
}
