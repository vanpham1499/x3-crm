import { getAdTopupCardLabel } from '@/lib/ad-topup-card-options';
import { formatCustomerIdentity } from '@/lib/customer-utils';
import { downloadXlsxWorkbook, type XlsxCell } from '@/lib/xlsx-workbook';
import api from '@/services/api/client';
import type {
  ProjectCost,
  ProjectCostAdjustmentType,
  ProjectCostFilters,
} from '@/types/project-cost';

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ad_spend: 'Nạp quảng cáo',
  partner_cost: 'Chi phí đối tác',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ nạp / chờ chi',
  completed: 'Đã nạp / đã chi',
  cancelled: 'Đã hủy',
};

const RECONCILIATION_LABELS: Record<string, string> = {
  matched: 'Khớp chuẩn',
  unmatched: 'Chưa khớp',
};

const BALANCE_STATUS_LABELS: Record<string, string> = {
  none: 'Không có',
  pending: 'Chờ xác nhận',
  resolved: 'Đã hoàn hạn mức',
};

const ADJUSTMENT_TYPE_LABELS: Record<ProjectCostAdjustmentType, string> = {
  additional_topup: 'Nạp thêm',
  previous_period_balance: 'Dư ngân sách kỳ trước',
  transfer_to_cid: 'Chuyển sang CID khác',
  carry_forward: 'Giữ sang kỳ sau',
  customer_bonus: 'Nạp dư cho khách',
  company_compensation: 'Công ty bù thêm',
  refund_company: 'Hoàn về công ty',
  refund_customer: 'Hoàn cho khách',
  bank_fee: 'Phí ngân hàng',
  rounding: 'Làm tròn',
  offset_next_topup: 'Cấn trừ lần nạp sau',
  other: 'Khác',
};

const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

const CID_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
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

function projectTypeLabel(value?: string | null) {
  if (!value || value === 'O' || value === 'N') return 'Không chọn';

  return value;
}

function userLabel(user?: { code?: string | null; name?: string | null } | null) {
  return [user?.code, user?.name].filter(Boolean).join(' - ');
}

function sourceLabel(cost: ProjectCost) {
  if (cost.entryType === 'ad_spend') {
    return cost.bankAccountOption ? getAdTopupCardLabel(cost.bankAccountOption) : '';
  }

  return cost.partnerOption?.label || cost.partnerOption?.value || '';
}

export async function exportCostsWorkbook(filters: ProjectCostFilters) {
  const response = await api.get<ProjectCost[]>('/project-costs', {
    params: {
      keyword: filters.keyword.trim() || undefined,
      entry_type: filters.entry_type || undefined,
      status: filters.status || undefined,
      reconciled_status: filters.reconciled_status || undefined,
      reconciliation_result: filters.reconciliation_result || undefined,
      balance_status: filters.balance_status || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    },
  });
  const costs = response.data;

  if (costs.length === 0) {
    throw new Error('Không có chi phí trong phạm vi và bộ lọc hiện tại để xuất Excel.');
  }

  const exportedAt = new Intl.DateTimeFormat('en-CA').format(new Date());

  downloadXlsxWorkbook(`Chi-phi_${exportedAt}.xlsx`, [
    {
      name: 'Tổng hợp chi phí',
      columns: [
        { header: 'ID chi phí', width: 14 },
        { header: 'Ngày chi', width: 16 },
        { header: 'Loại chi phí', width: 20 },
        { header: 'Trạng thái chi', width: 20 },
        { header: 'ID dự án', width: 12 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 30 },
        { header: 'Loại dự án', width: 14 },
        { header: 'Khách hàng', width: 34 },
        { header: 'Số tiền có thể nạp', width: 22 },
        { header: 'ID báo phí', width: 14 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Nguồn chi / Đối tác', width: 32 },
        { header: 'CID', width: 22 },
        { header: 'Tài khoản quảng cáo', width: 26 },
        { header: 'CID đã dừng', width: 16 },
        { header: 'Số tiền nhập', width: 18 },
        { header: 'Thuế suất VAT (%)', width: 18 },
        { header: 'Tiền VAT', width: 18 },
        { header: 'Giảm trừ', width: 18 },
        { header: 'Tổng chi', width: 18 },
        { header: 'Dòng tiền đã chi', width: 20 },
        { header: 'Chi phí thực tế', width: 20 },
        { header: 'Số dư gốc', width: 18 },
        { header: 'Số dư đã xử lý', width: 20 },
        { header: 'Hạn mức đã trả lại', width: 22 },
        { header: 'Số dư còn lại', width: 18 },
        { header: 'Chi phí ghi nhận', width: 20 },
        { header: 'Trạng thái số dư', width: 20 },
        { header: 'Kết quả đối soát', width: 20 },
        { header: 'Số hóa đơn', width: 20 },
        { header: 'Ghi chú đối soát', width: 40 },
        { header: 'Người đối soát', width: 26 },
        { header: 'Thời gian đối soát', width: 20 },
        { header: 'Ghi chú chi phí', width: 40 },
        { header: 'Ngày tạo', width: 20 },
        { header: 'Cập nhật lần cuối', width: 20 },
      ],
      rows: costs.map((cost) => [
        cost.id,
        cost.transactionDate || '',
        ENTRY_TYPE_LABELS[cost.entryType] || cost.entryType,
        STATUS_LABELS[cost.status] || cost.status,
        cost.projectId,
        cost.project?.projectCode || '',
        cost.project?.projectName || '',
        projectTypeLabel(cost.project?.projectType),
        cost.project?.customer ? formatCustomerIdentity(cost.project.customer) : '',
        numberCell(cost.project?.availableTopupBudget),
        cost.quotationId || '',
        cost.quotation?.quotationCode || '',
        sourceLabel(cost),
        cost.cid || '',
        cost.adAccount || '',
        cost.cidIsDead ? 'Có' : 'Không',
        numberCell(cost.amountBeforeVat),
        numberCell(cost.vatRate),
        numberCell(cost.vatAmount),
        numberCell(cost.discountAmount),
        numberCell(cost.totalAmount),
        numberCell(cost.cashOutAmount),
        numberCell(cost.actualCostAmount),
        numberCell(cost.originalBalanceAmount),
        numberCell(cost.handledBalanceAmount),
        numberCell(cost.releasedBalanceAmount),
        numberCell(cost.remainingBalanceAmount),
        numberCell(cost.realizedCostAmount),
        BALANCE_STATUS_LABELS[cost.balanceStatus || ''] || cost.balanceStatus || '',
        RECONCILIATION_LABELS[cost.reconciliationResult || ''] ||
          cost.reconciliationResult ||
          'Chưa đối soát',
        cost.invoiceNumber || '',
        cost.reconciliationNote || '',
        userLabel(cost.reconciledBy),
        dateTimeCell(cost.reconciledAt),
        cost.note || '',
        dateTimeCell(cost.createdAt),
        dateTimeCell(cost.updatedAt),
      ]),
    },
    {
      name: 'Điều chỉnh chi phí',
      columns: [
        { header: 'ID điều chỉnh', width: 16 },
        { header: 'ID chi phí', width: 14 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 30 },
        { header: 'Mã báo phí', width: 28 },
        { header: 'Loại điều chỉnh', width: 28 },
        { header: 'Trạng thái', width: 18 },
        { header: 'Số tiền', width: 18 },
        { header: 'Tham chiếu', width: 26 },
        { header: 'Ghi chú', width: 40 },
        { header: 'Ngày tạo', width: 20 },
        { header: 'Cập nhật lần cuối', width: 20 },
      ],
      rows: costs.flatMap((cost) =>
        (cost.adjustments || []).map((adjustment) => [
          adjustment.id || '',
          cost.id,
          cost.project?.projectCode || '',
          cost.project?.projectName || '',
          cost.quotation?.quotationCode || '',
          ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] || adjustment.adjustmentType,
          ADJUSTMENT_STATUS_LABELS[adjustment.status] || adjustment.status,
          numberCell(adjustment.amount),
          adjustment.reference || '',
          adjustment.note || '',
          dateTimeCell(adjustment.createdAt),
          dateTimeCell(adjustment.updatedAt),
        ]),
      ),
    },
    {
      name: 'Sự kiện CID',
      columns: [
        { header: 'ID sự kiện', width: 14 },
        { header: 'ID chi phí', width: 14 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 30 },
        { header: 'CID', width: 22 },
        { header: 'Tài khoản quảng cáo', width: 26 },
        { header: 'Ngày dừng', width: 16 },
        { header: 'Số thực chạy', width: 18 },
        { header: 'Không thu hồi', width: 18 },
        { header: 'Hạn mức trả lại', width: 20 },
        { header: 'Trạng thái', width: 18 },
        { header: 'Ghi chú', width: 40 },
        { header: 'Người báo', width: 26 },
        { header: 'Thời gian báo', width: 20 },
        { header: 'Người xác nhận', width: 26 },
        { header: 'Thời gian xác nhận', width: 20 },
      ],
      rows: costs.flatMap((cost) => {
        const incident = cost.cidIncident;
        if (!incident) return [];

        return [
          [
            incident.id,
            cost.id,
            cost.project?.projectCode || '',
            cost.project?.projectName || '',
            cost.cid || '',
            cost.adAccount || '',
            incident.stoppedAt || '',
            numberCell(incident.spentAmount),
            numberCell(incident.unrecoverableAmount),
            numberCell(incident.releasedAmount),
            CID_STATUS_LABELS[incident.status] || incident.status,
            incident.note || '',
            userLabel(incident.reportedBy),
            dateTimeCell(incident.reportedAt),
            userLabel(incident.confirmedBy),
            dateTimeCell(incident.confirmedAt),
          ],
        ];
      }),
    },
  ]);
}
