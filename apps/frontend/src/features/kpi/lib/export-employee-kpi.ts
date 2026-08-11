import { downloadXlsxWorkbook, type XlsxCell } from '@/lib/xlsx-workbook';
import api from '@/services/api/client';
import type { EmployeeKpiRow, KpiDetailReport, KpiReport } from '@/types/kpi';

type EmployeeExportTask = {
  period: string;
  employee: EmployeeKpiRow;
};

type EmployeeExportResult = EmployeeExportTask & {
  detail: KpiDetailReport;
};

type ExportProgress = {
  completed: number;
  total: number;
};

const numberCell = (value: number): XlsxCell => ({ value, format: 'number' });
const percentCell = (value: number | null): XlsxCell => ({
  value: value === null ? null : value / 100,
  format: 'percent',
});

function projectTypeLabel(value?: string | null) {
  if (!value || value === 'O' || value === 'N') return 'Không chọn';

  return value;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<TResult>,
  onProgress?: (progress: ExportProgress) => void,
) {
  const results = new Array<TResult>(items.length);
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
        completed += 1;
        onProgress?.({ completed, total: items.length });
      }
    }),
  );

  return results;
}

function branch(result: EmployeeExportResult, key: 'implementation' | 'acquisition') {
  return result.detail.branches.find((item) => item.key === key);
}

function summaryRows(results: EmployeeExportResult[]) {
  return results.map((result) => {
    const implementation = branch(result, 'implementation');
    const acquisition = branch(result, 'acquisition');

    return [
      result.period,
      result.employee.code || '',
      result.employee.name,
      result.employee.departmentName || '',
      result.employee.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động',
      numberCell(result.employee.targetAmount),
      numberCell(result.detail.totals.receivedAmount),
      numberCell(result.detail.totals.costAmount),
      numberCell(result.detail.totals.refundAmount),
      numberCell(result.detail.totals.profitAmount),
      numberCell(implementation?.totals.receivedAmount ?? 0),
      numberCell(implementation?.totals.costAmount ?? 0),
      numberCell(implementation?.totals.refundAmount ?? 0),
      numberCell(implementation?.totals.profitAmount ?? 0),
      numberCell(acquisition?.totals.receivedAmount ?? 0),
      numberCell(acquisition?.totals.refundAmount ?? 0),
      numberCell(acquisition?.totals.profitAmount ?? 0),
      percentCell(result.employee.completionRate),
    ];
  });
}

function detailRows(results: EmployeeExportResult[]) {
  return results.flatMap((result) =>
    result.detail.branches.flatMap((branchItem) =>
      branchItem.entries.map((entry) => [
        result.period,
        result.employee.code || '',
        result.employee.name,
        result.employee.departmentName || '',
        branchItem.label,
        entry.label,
        { value: new Date(entry.eventAt), format: 'datetime' } satisfies XlsxCell,
        entry.project.id,
        entry.project.code || '',
        entry.project.name || '',
        projectTypeLabel(entry.project.type),
        entry.quotation?.id ?? '',
        entry.quotation?.code || '',
        entry.reference || '',
        numberCell(entry.sourceAmount),
        numberCell(entry.beforeVatAmount),
        numberCell(entry.profitImpactAmount),
      ]),
    ),
  );
}

export async function exportEmployeeKpiWorkbook(
  report: KpiReport,
  onProgress?: (progress: ExportProgress) => void,
) {
  const tasks: EmployeeExportTask[] = report.periods.flatMap((period) =>
    period.employees.map((employee) => ({ period: period.period, employee })),
  );

  if (tasks.length === 0) {
    throw new Error('Không có nhân sự trong phạm vi hiện tại để xuất Excel.');
  }

  onProgress?.({ completed: 0, total: tasks.length });
  const results = await mapWithConcurrency(
    tasks,
    4,
    async (task) => {
      const response = await api.get<KpiDetailReport>('/kpi/details', {
        params: {
          period: task.period,
          scope_type: 'employee',
          scope_id: task.employee.id,
        },
      });

      return { ...task, detail: response.data };
    },
    onProgress,
  );
  const filenamePeriod =
    report.periodFrom === report.periodTo
      ? report.periodFrom
      : `${report.periodFrom}_${report.periodTo}`;

  downloadXlsxWorkbook(`KPI-nhan-su_${filenamePeriod}.xlsx`, [
    {
      name: 'Tổng hợp KPI',
      columns: [
        { header: 'Tháng', width: 12 },
        { header: 'Mã nhân sự', width: 14 },
        { header: 'Nhân sự', width: 24 },
        { header: 'Phòng ban', width: 22 },
        { header: 'Trạng thái', width: 17 },
        { header: 'Kế hoạch', width: 18 },
        { header: 'Ghi nhận có VAT', width: 20 },
        { header: 'Chi phí có VAT', width: 18 },
        { header: 'Hoàn tiền có VAT', width: 20 },
        { header: 'Lợi nhuận trước VAT', width: 22 },
        { header: 'Triển khai - Ghi nhận có VAT', width: 25 },
        { header: 'Triển khai - Chi phí có VAT', width: 24 },
        { header: 'Triển khai - Hoàn tiền có VAT', width: 26 },
        { header: 'Triển khai - Lợi nhuận trước VAT', width: 28 },
        { header: 'Phụ trách KH - Ghi nhận có VAT', width: 28 },
        { header: 'Phụ trách KH - Hoàn tiền có VAT', width: 28 },
        { header: 'Phụ trách KH - Lợi nhuận trước VAT', width: 30 },
        { header: 'Hoàn thành', width: 15 },
      ],
      rows: summaryRows(results),
    },
    {
      name: 'Chi tiết đối soát',
      columns: [
        { header: 'Tháng', width: 12 },
        { header: 'Mã nhân sự', width: 14 },
        { header: 'Nhân sự', width: 24 },
        { header: 'Phòng ban', width: 22 },
        { header: 'Nhánh KPI', width: 25 },
        { header: 'Phát sinh', width: 28 },
        { header: 'Thời gian', width: 20 },
        { header: 'ID dự án', width: 12 },
        { header: 'Mã dự án', width: 24 },
        { header: 'Tên dự án', width: 28 },
        { header: 'Loại dự án', width: 15 },
        { header: 'ID báo phí', width: 12 },
        { header: 'Mã báo phí', width: 26 },
        { header: 'Tham chiếu', width: 34 },
        { header: 'Số nguồn có VAT', width: 20 },
        { header: 'Giá trị trước VAT', width: 20 },
        { header: 'Tác động LN trước VAT', width: 24 },
      ],
      rows: detailRows(results),
    },
  ]);
}
