import { formatCustomerIdentity } from '@/lib/customer-utils';
import { getPaymentDisplayStatus } from '@/lib/payment-display-status';
import { downloadXlsxWorkbook, type XlsxCell } from '@/lib/xlsx-workbook';
import api from '@/services/api/client';
import type { PaginatedResponse } from '@/types/pagination';
import type { Payment, PaymentFilters, PaymentRefund, PaymentRefundFilters } from '@/types/payment';

const REFUND_TYPE_LABELS: Record<string, string> = {
  deposit: 'Hoàn cọc',
  payment: 'Hoàn thanh toán',
  overpayment: 'Hoàn tiền thừa',
  compensation: 'Bù thêm cho khách',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ chuyển',
  completed: 'Đã chuyển',
  cancelled: 'Đã hủy',
};

const RECEIPT_TYPE_LABELS: Record<string, string> = {
  customer: 'Khoản thu khách hàng',
  internal: 'Giao dịch nội bộ',
  other: 'Giao dịch khác',
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

function uniqueText(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].join(', ');
}

function quotationCodes(payment: Payment) {
  return uniqueText([
    payment.quotation?.quotationCode,
    ...(payment.allocations || []).map((allocation) => allocation.quotation?.quotationCode),
  ]);
}

function projectLabels(payment: Payment) {
  return uniqueText([
    payment.project
      ? [payment.project.projectCode, payment.project.projectName].filter(Boolean).join(' - ')
      : '',
    ...(payment.allocations || []).map((allocation) =>
      allocation.quotation?.project
        ? [allocation.quotation.project.projectCode, allocation.quotation.project.projectName]
            .filter(Boolean)
            .join(' - ')
        : '',
    ),
  ]);
}

function customerLabels(payment: Payment) {
  return uniqueText([
    payment.customer ? formatCustomerIdentity(payment.customer) : '',
    ...(payment.allocations || []).map((allocation) =>
      allocation.quotation?.customer ? formatCustomerIdentity(allocation.quotation.customer) : '',
    ),
  ]);
}

async function fetchAllRefunds(filters: PaymentRefundFilters) {
  const refunds: PaymentRefund[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get<PaginatedResponse<PaymentRefund>>('/payment-refunds', {
      params: {
        keyword: filters.keyword.trim() || undefined,
        refund_type: filters.refund_type || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        page,
        per_page: 100,
      },
    });
    refunds.push(...response.data.data);
    lastPage = response.data.meta.lastPage;
    page += 1;
  } while (page <= lastPage);

  return refunds;
}

export async function exportPaymentsWorkbook(
  filters: PaymentFilters,
  refundFilters: PaymentRefundFilters,
) {
  const [paymentResponse, refunds] = await Promise.all([
    api.get<Payment[]>('/payments', {
      params: {
        keyword: filters.keyword.trim() || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    }),
    fetchAllRefunds(refundFilters),
  ]);
  const payments = paymentResponse.data;

  if (payments.length === 0 && refunds.length === 0) {
    throw new Error('Không có dữ liệu thanh toán trong phạm vi và bộ lọc hiện tại để xuất Excel.');
  }

  const exportedAt = new Intl.DateTimeFormat('en-CA').format(new Date());

  downloadXlsxWorkbook(`Thanh-toan_${exportedAt}.xlsx`, [
    {
      name: 'Tiền nhận vào',
      columns: [
        { header: 'ID giao dịch', width: 14 },
        { header: 'Thời gian', width: 20 },
        { header: 'Mã tham chiếu', width: 24 },
        { header: 'Người chuyển', width: 24 },
        { header: 'Ngân hàng', width: 18 },
        { header: 'Tài khoản nhận', width: 22 },
        { header: 'Nội dung chuyển khoản', width: 42 },
        { header: 'Số tiền', width: 18 },
        { header: 'Đã phân bổ', width: 18 },
        { header: 'Đã hoàn', width: 18 },
        { header: 'Bù thêm', width: 18 },
        { header: 'Tiền ra', width: 18 },
        { header: 'Chưa phân bổ', width: 18 },
        { header: 'Còn có thể hoàn', width: 20 },
        { header: 'Trạng thái', width: 26 },
        { header: 'Loại giao dịch', width: 22 },
        { header: 'Số hóa đơn', width: 20 },
        { header: 'Báo phí', width: 36 },
        { header: 'Dự án', width: 42 },
        { header: 'Khách hàng', width: 36 },
        { header: 'Hợp đồng', width: 20 },
        { header: 'Ghi chú', width: 36 },
        { header: 'Ngày khớp', width: 20 },
        { header: 'Ngày tạo', width: 20 },
        { header: 'Cập nhật lần cuối', width: 20 },
      ],
      rows: payments.map((payment) => [
        payment.id,
        dateTimeCell(payment.transactionAt || payment.transactionDate),
        payment.reference || '',
        payment.senderName || '',
        payment.bankGateway || '',
        payment.bankAccount || '',
        payment.transactionContent || '',
        numberCell(payment.amount),
        numberCell(payment.allocatedAmount),
        numberCell(payment.refundedAmount),
        numberCell(payment.compensationAmount),
        numberCell(payment.outboundAmount),
        numberCell(payment.unallocatedAmount),
        numberCell(payment.refundableAmount),
        getPaymentDisplayStatus(payment).label,
        RECEIPT_TYPE_LABELS[payment.receiptType || 'customer'] || payment.receiptType || '',
        payment.invoiceNumber || '',
        quotationCodes(payment),
        projectLabels(payment),
        customerLabels(payment),
        payment.contract?.contractNo || '',
        payment.note || '',
        dateTimeCell(payment.matchedAt),
        dateTimeCell(payment.createdAt),
        dateTimeCell(payment.updatedAt),
      ]),
    },
    {
      name: 'Phân bổ báo phí',
      columns: [
        { header: 'ID phân bổ', width: 14 },
        { header: 'ID giao dịch', width: 14 },
        { header: 'Thời gian giao dịch', width: 20 },
        { header: 'Mã giao dịch', width: 24 },
        { header: 'Nội dung chuyển khoản', width: 42 },
        { header: 'ID báo phí', width: 14 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Dự án', width: 42 },
        { header: 'Khách hàng', width: 36 },
        { header: 'Số tiền phân bổ', width: 20 },
        { header: 'Đã hoàn', width: 18 },
        { header: 'Còn có thể hoàn', width: 20 },
        { header: 'Cọc có thể hoàn', width: 20 },
        { header: 'Thời gian phân bổ', width: 20 },
        { header: 'Ghi chú phân bổ', width: 40 },
      ],
      rows: payments.flatMap((payment) =>
        (payment.allocations || []).map((allocation) => [
          allocation.id,
          payment.id,
          dateTimeCell(payment.transactionAt || payment.transactionDate),
          payment.reference || '',
          payment.transactionContent || '',
          allocation.quotationId,
          allocation.quotation?.quotationCode || '',
          allocation.quotation?.project
            ? [allocation.quotation.project.projectCode, allocation.quotation.project.projectName]
                .filter(Boolean)
                .join(' - ')
            : '',
          allocation.quotation?.customer
            ? formatCustomerIdentity(allocation.quotation.customer)
            : '',
          numberCell(allocation.amount),
          numberCell(allocation.refundedAmount),
          numberCell(allocation.refundableAmount),
          numberCell(allocation.depositRefundableAmount),
          dateTimeCell(allocation.allocatedAt),
          allocation.note || '',
        ]),
      ),
    },
    {
      name: 'Tiền hoàn ra',
      columns: [
        { header: 'ID hoàn tiền', width: 14 },
        { header: 'ID giao dịch nguồn', width: 18 },
        { header: 'Thời gian giao dịch nguồn', width: 22 },
        { header: 'Nội dung giao dịch nguồn', width: 42 },
        { header: 'Loại hoàn tiền', width: 22 },
        { header: 'Trạng thái', width: 18 },
        { header: 'Số tiền', width: 18 },
        { header: 'Ngày dự kiến', width: 20 },
        { header: 'Ngày chuyển', width: 20 },
        { header: 'Ngày hoàn tất', width: 20 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Dự án', width: 42 },
        { header: 'Khách hàng', width: 36 },
        { header: 'Người nhận', width: 24 },
        { header: 'Tài khoản nhận', width: 22 },
        { header: 'Ngân hàng nhận', width: 22 },
        { header: 'Lý do', width: 36 },
        { header: 'Mã tham chiếu', width: 24 },
        { header: 'Số hóa đơn', width: 20 },
        { header: 'Ghi chú', width: 36 },
        { header: 'Người tạo', width: 28 },
        { header: 'Ngày tạo', width: 20 },
        { header: 'Cập nhật lần cuối', width: 20 },
      ],
      rows: refunds.map((refund) => [
        refund.id,
        refund.paymentId,
        dateTimeCell(refund.payment?.transactionAt),
        refund.payment?.transactionContent || '',
        REFUND_TYPE_LABELS[refund.refundType] || refund.refundType,
        REFUND_STATUS_LABELS[refund.status] || refund.status,
        numberCell(refund.amount),
        dateTimeCell(refund.scheduledAt),
        dateTimeCell(refund.refundedAt),
        dateTimeCell(refund.completedAt),
        refund.quotation?.quotationCode || '',
        refund.project
          ? [refund.project.projectCode, refund.project.projectName].filter(Boolean).join(' - ')
          : '',
        refund.customer ? formatCustomerIdentity(refund.customer) : '',
        refund.recipientName || '',
        refund.recipientAccount || '',
        refund.recipientBank || '',
        refund.reason || '',
        refund.reference || '',
        refund.invoiceNumber || refund.payment?.invoiceNumber || '',
        refund.note || '',
        [refund.createdBy?.code, refund.createdBy?.name].filter(Boolean).join(' - '),
        dateTimeCell(refund.createdAt),
        dateTimeCell(refund.updatedAt),
      ]),
    },
  ]);
}
