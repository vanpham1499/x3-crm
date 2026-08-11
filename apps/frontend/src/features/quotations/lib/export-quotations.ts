import { formatCustomerIdentity } from '@/lib/customer-utils';
import { getQuotationPaymentStatusLabel } from '@/lib/quotation-utils';
import { downloadXlsxWorkbook, type XlsxCell } from '@/lib/xlsx-workbook';
import api from '@/services/api/client';
import type { Quotation, QuotationFilters, QuotationItem } from '@/types/quotation';

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Báo phí',
  won: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

const numberCell = (value?: string | number | null): XlsxCell => ({
  value: Number(value) || 0,
  format: 'number',
});

function dateTimeCell(value?: string | null): XlsxCell | string {
  if (!value) return '';
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : { value: date, format: 'datetime' };
}

function metadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];

  return typeof value === 'string' || typeof value === 'number' ? value : '';
}

function metadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key] === true ? 'Có' : 'Không';
}

function projectTypeLabel(value?: string | number | null) {
  if (!value || value === 'O' || value === 'N') return 'Không chọn';

  return String(value);
}

function pricingModeLabel(value?: string | number | null) {
  if (value === 'management_fee') return 'Phí quản lý theo ngân sách';
  if (value === 'quantity_price') return 'Số lượng × đơn giá';

  return value ? String(value) : '';
}

function customerLabel(quotation: Quotation) {
  if (quotation.customer) return formatCustomerIdentity(quotation.customer);
  if (quotation.lead) {
    return formatCustomerIdentity({ customerName: quotation.lead.customerName });
  }

  return '';
}

function itemRows(quotations: Quotation[]) {
  return quotations.flatMap((quotation) =>
    (quotation.items || []).map((item: QuotationItem, index) => [
      quotation.id,
      quotation.quotationCode || '',
      quotation.project?.projectCode || '',
      quotation.project?.projectName || '',
      customerLabel(quotation),
      index + 1,
      item.itemCode || '',
      item.itemName,
      item.description || '',
      metadataValue(item.metadata, 'unit'),
      numberCell(item.quantity),
      numberCell(item.unitPrice),
      numberCell(item.amountBeforeVat),
      numberCell(item.vatRate),
      numberCell(item.vatAmount),
      numberCell(item.amountAfterVat),
      item.service?.code || '',
      item.service?.name || '',
      metadataBoolean(item.metadata, 'excludedFromTotal'),
      metadataBoolean(item.metadata, 'countsTowardTopupBudget'),
      metadataBoolean(item.metadata, 'locked'),
    ]),
  );
}

export async function exportQuotationsWorkbook(filters: QuotationFilters) {
  const response = await api.get<Quotation[]>('/quotations', {
    params: {
      keyword: filters.keyword.trim() || undefined,
      status: filters.status || undefined,
      created_by: filters.created_by || undefined,
    },
  });
  const quotations = response.data;

  if (quotations.length === 0) {
    throw new Error('Không có báo phí trong phạm vi và bộ lọc hiện tại để xuất Excel.');
  }

  const exportedAt = new Intl.DateTimeFormat('en-CA').format(new Date());

  downloadXlsxWorkbook(`Bao-phi_${exportedAt}.xlsx`, [
    {
      name: 'Tổng hợp báo phí',
      columns: [
        { header: 'ID báo phí', width: 12 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Nội dung chuyển khoản', width: 30 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 28 },
        { header: 'Loại dự án', width: 14 },
        { header: 'Khách hàng', width: 32 },
        { header: 'Mã dịch vụ', width: 16 },
        { header: 'Tên dịch vụ', width: 28 },
        { header: 'Số hợp đồng', width: 20 },
        { header: 'Trạng thái báo phí', width: 20 },
        { header: 'Trạng thái thanh toán', width: 25 },
        { header: 'Tổng trước VAT', width: 18 },
        { header: 'Thuế suất VAT (%)', width: 18 },
        { header: 'Tiền VAT', width: 18 },
        { header: 'Tiền cọc', width: 18 },
        { header: 'Tổng thanh toán', width: 20 },
        { header: 'Tổng đã nhận', width: 18 },
        { header: 'Đã hoàn', width: 18 },
        { header: 'Bù thêm', width: 18 },
        { header: 'Thực thu', width: 18 },
        { header: 'Còn phải thu', width: 18 },
        { header: 'Ngân sách', width: 18 },
        { header: 'Nhóm doanh thu', width: 18 },
        { header: 'Cách tính giá', width: 18 },
        { header: 'Ngày hiệu lực đến', width: 18 },
        { header: 'Ghi chú', width: 36 },
        { header: 'Mã người tạo', width: 16 },
        { header: 'Người tạo', width: 24 },
        { header: 'Email người tạo', width: 28 },
        { header: 'Ngày tạo', width: 20 },
        { header: 'Cập nhật lần cuối', width: 20 },
      ],
      rows: quotations.map((quotation) => [
        quotation.id,
        quotation.quotationCode || '',
        quotation.paymentContent || '',
        quotation.project?.projectCode || '',
        quotation.project?.projectName || '',
        projectTypeLabel(
          quotation.project?.projectType || metadataValue(quotation.metadata, 'projectType'),
        ),
        customerLabel(quotation),
        quotation.serviceCode || quotation.service?.code || '',
        quotation.serviceName || quotation.service?.name || '',
        quotation.contract?.contractNo || '',
        QUOTATION_STATUS_LABELS[quotation.status || ''] || quotation.status || '',
        getQuotationPaymentStatusLabel(quotation),
        numberCell(quotation.subtotalAmount),
        numberCell(quotation.vatRate),
        numberCell(quotation.vatAmount),
        numberCell(quotation.depositAmount),
        numberCell(quotation.totalAmount),
        numberCell(quotation.grossPaidAmount),
        numberCell(quotation.refundedAmount),
        numberCell(quotation.compensationAmount),
        numberCell(quotation.paidAmount),
        numberCell(quotation.outstandingAmount),
        numberCell(metadataValue(quotation.metadata, 'budget')),
        metadataValue(quotation.metadata, 'revenueGroup'),
        pricingModeLabel(metadataValue(quotation.metadata, 'pricingMode')),
        quotation.validUntil || '',
        quotation.note || '',
        quotation.createdBy?.code || '',
        quotation.createdBy?.name || '',
        quotation.createdBy?.email || '',
        dateTimeCell(quotation.createdAt),
        dateTimeCell(quotation.updatedAt),
      ]),
    },
    {
      name: 'Hạng mục báo phí',
      columns: [
        { header: 'ID báo phí', width: 12 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 28 },
        { header: 'Khách hàng', width: 32 },
        { header: 'STT', width: 8 },
        { header: 'Mã hạng mục', width: 16 },
        { header: 'Tên hạng mục', width: 34 },
        { header: 'Mô tả', width: 36 },
        { header: 'Đơn vị', width: 16 },
        { header: 'Số lượng', width: 14 },
        { header: 'Đơn giá', width: 18 },
        { header: 'Trước VAT', width: 18 },
        { header: 'Thuế suất VAT (%)', width: 18 },
        { header: 'Tiền VAT', width: 18 },
        { header: 'Sau VAT', width: 18 },
        { header: 'Mã dịch vụ', width: 16 },
        { header: 'Tên dịch vụ', width: 28 },
        { header: 'Không tính vào tổng', width: 20 },
        { header: 'Tính vào tiền có thể nạp', width: 24 },
        { header: 'Hạng mục hệ thống', width: 20 },
      ],
      rows: itemRows(quotations),
    },
  ]);
}
