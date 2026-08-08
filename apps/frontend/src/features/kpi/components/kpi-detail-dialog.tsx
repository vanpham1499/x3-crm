'use client';

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import api from '@/services/api/client';
import type { KpiDetailEntry, KpiDetailReport, KpiDetailTotals, KpiScopeType } from '@/types/kpi';

export type KpiDetailDialogState = {
  scopeType: KpiScopeType;
  scopeId: number;
  scopeName: string;
  period: string;
};

type KpiDetailDialogProps = {
  state: KpiDetailDialogState | null;
  onClose: () => void;
};

const detailTone = {
  received: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  acquisition_credit: 'bg-blue-50 text-blue-700 ring-blue-200',
  cost: 'bg-rose-50 text-rose-700 ring-rose-200',
  refund: 'bg-amber-50 text-amber-700 ring-amber-200',
  acquisition_refund: 'bg-amber-50 text-amber-700 ring-amber-200',
} satisfies Record<KpiDetailEntry['kind'], string>;

function formatMonthLabel(period: string) {
  const [year, month] = period.split('-');

  return `Tháng ${month}/${year}`;
}

function impactTone(amount: number) {
  if (amount > 0) return 'text-emerald-700';
  if (amount < 0) return 'text-rose-700';
  return 'text-slate-500';
}

function formatImpact(amount: number) {
  return `${amount > 0 ? '+' : ''}${formatCurrency(amount)}`;
}

function DetailSummary({ totals }: { totals: KpiDetailTotals }) {
  const items = [
    { label: 'Ghi nhận có VAT', value: totals.receivedAmount, tone: 'text-emerald-700' },
    { label: 'Chi phí có VAT', value: totals.costAmount, tone: 'text-rose-700' },
    { label: 'Hoàn tiền có VAT', value: totals.refundAmount, tone: 'text-amber-700' },
    {
      label: 'Lợi nhuận trước VAT',
      value: totals.profitAmount,
      tone: impactTone(totals.profitAmount),
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs font-bold text-slate-500">{item.label}</p>
          <p
            className={`mt-1 whitespace-nowrap text-base font-extrabold tabular-nums ${item.tone}`}
          >
            {formatCurrency(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DetailRows({ entries }: { entries: KpiDetailEntry[] }) {
  return (
    <AppDataTable
      columns={[
        { key: 'date', label: 'Thời gian', className: 'w-[135px]' },
        { key: 'type', label: 'Phát sinh', className: 'w-[190px]' },
        { key: 'project', label: 'Dự án', className: 'w-[210px]' },
        { key: 'reference', label: 'Báo phí / Tham chiếu', className: 'w-[230px]' },
        { key: 'source', label: 'Số nguồn có VAT', className: 'w-[160px] text-right' },
        { key: 'impact', label: 'Tác động LN trước VAT', className: 'w-[180px] text-right' },
      ]}
      isEmpty={entries.length === 0}
      emptyText="Không có phát sinh trong tháng này"
      minWidthClassName="min-w-[1105px]"
    >
      {entries.map((entry) => (
        <tr key={entry.id} className="hover:bg-slate-50/80">
          <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-600">
            {formatDateTime(entry.eventAt)}
          </td>
          <td className="px-3 py-3">
            <span
              className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${detailTone[entry.kind]}`}
            >
              {entry.label}
            </span>
          </td>
          <td className="px-3 py-3">
            <EntityTableLink
              href={`/projects/${entry.project.id}`}
              title={[entry.project.code, entry.project.name].filter(Boolean).join(' - ')}
              tone="blue"
            >
              {entry.project.code || entry.project.name || `Dự án #${entry.project.id}`}
            </EntityTableLink>
            <span className="mt-0.5 block text-xs font-semibold text-slate-500">
              Loại {entry.project.type === 'O' ? 'Không chọn' : entry.project.type || '-'}
            </span>
          </td>
          <td className="px-3 py-3">
            {entry.quotation ? (
              <EntityTableLink href={`/quotations/${entry.quotation.id}`} tone="primary">
                {entry.quotation.code || `Báo phí #${entry.quotation.id}`}
              </EntityTableLink>
            ) : null}
            <span
              className="mt-0.5 block truncate text-xs font-semibold text-slate-500"
              title={entry.reference}
            >
              {entry.reference || '-'}
            </span>
          </td>
          <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-800">
            {formatCurrency(entry.sourceAmount)}
          </td>
          <td
            className={`whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums ${impactTone(entry.profitImpactAmount)}`}
          >
            {formatImpact(entry.profitImpactAmount)}
          </td>
        </tr>
      ))}
    </AppDataTable>
  );
}

export function KpiDetailDialog({ state, onClose }: KpiDetailDialogProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<KpiDetailReport>({
    queryKey: ['kpi', 'details', state?.period, state?.scopeType, state?.scopeId],
    queryFn: ({ signal }) =>
      api
        .get<KpiDetailReport>('/kpi/details', {
          params: {
            period: state?.period,
            scope_type: state?.scopeType,
            scope_id: state?.scopeId,
          },
          signal,
        })
        .then((response) => response.data),
    enabled: Boolean(state),
  });

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={`Đối soát KPI · ${state?.scopeName || ''}`}
      maxWidth="xl"
      submitting={false}
      contentClassName="!p-0"
      onClose={onClose}
      onSubmit={(event) => event.preventDefault()}
      actions={<DialogActionButton onClick={onClose}>Đóng</DialogActionButton>}
    >
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <p className="text-sm font-bold text-slate-800">
          {state ? formatMonthLabel(state.period) : ''}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          Mỗi dòng hiển thị số nguồn để đối soát và phần tác động thực tế vào lợi nhuận trước VAT.
        </p>
      </div>

      {isLoading ? (
        <div
          className="grid min-h-64 place-items-center"
          aria-label="Đang tải dữ liệu đối soát KPI"
        >
          <div className="text-center">
            <CircularProgress size={30} />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Đang tải dữ liệu đối soát...
            </p>
          </div>
        </div>
      ) : isError ? (
        <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
          <p className="font-bold text-rose-800">Không thể tải dữ liệu đối soát</p>
          <p className="mt-1 text-sm text-rose-700">
            {getApiErrorMessage(error, 'Vui lòng thử tải lại dữ liệu.')}
          </p>
          <DialogActionButton
            startIcon={<RefreshRoundedIcon />}
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? 'Đang tải...' : 'Tải lại'}
          </DialogActionButton>
        </div>
      ) : data ? (
        <div className="space-y-4 p-5">
          <DetailSummary totals={data.totals} />

          {data.branches
            .filter((branch) => branch.entries.length > 0)
            .map((branch) => (
              <section
                key={branch.key}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{branch.label}</h3>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {branch.entries.length} phát sinh được dùng trong công thức
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">Lợi nhuận trước VAT</p>
                    <p
                      className={`mt-0.5 text-base font-extrabold tabular-nums ${impactTone(branch.totals.profitAmount)}`}
                    >
                      {formatCurrency(branch.totals.profitAmount)}
                    </p>
                  </div>
                </header>
                <DetailRows entries={branch.entries} />
              </section>
            ))}
        </div>
      ) : null}
    </AppFormDialog>
  );
}
