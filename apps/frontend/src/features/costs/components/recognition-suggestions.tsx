'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/services/api/client';
import { Alert, Checkbox, Tab, Tabs } from '@mui/material';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { AppDataTable } from '@/components/table/app-data-table';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { formatCurrency } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-error';

export type RecognitionSuggestion = {
  status: 'ready' | 'review' | 'waiting' | 'confirmed' | 'excluded';
  reason: string;
  allocations: { period: string; amount: number }[];
  fingerprint?: string;
};
export type RecognitionCandidate = {
  key: string;
  type: 'revenue' | 'cost';
  id: number;
  projectId: number;
  project: string;
  title: string;
  amount: number | null;
  suggestion: RecognitionSuggestion;
  canConfirm: boolean;
};
const month = (value: string) => `${value.slice(5)}/${value.slice(0, 4)}`;
const labels = { ready: 'Chờ xác nhận', review: 'Cần kiểm tra', waiting: 'Chờ đủ điều kiện' };

export function RecognitionSuggestions({
  keyword,
  counts,
  period,
  busy,
  onProject,
  onSubmit,
}: {
  keyword: string;
  counts: Record<string, number>;
  period: string;
  busy: boolean;
  onProject: (id: number) => void;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<keyof typeof labels>('ready');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmPageSize, setConfirmPageSize] = useState(10);
  const [selected, setSelected] = useState<RecognitionCandidate[]>([]);
  const [snapshot, setSnapshot] = useState<RecognitionCandidate[] | null>(null);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [confirmPage, setConfirmPage] = useState(1);
  const selectAll = useMutation({
    mutationFn: () =>
      api
        .get<{ rows: RecognitionCandidate[]; total: number; limit: number }>(
          '/partner-finance/suggestions/selection',
          { params: { period, keyword } },
        )
        .then((r) => r.data),
    onSuccess: (data) => setSelected(data.rows),
  });
  const query = useQuery({
    queryKey: ['partner-finance', 'suggestions', period, keyword, tab, page, pageSize],
    enabled: open,
    queryFn: ({ signal }) =>
      api
        .get<{ rows: RecognitionCandidate[]; pagination: { total: number; totalPages: number } }>(
          '/partner-finance/suggestions',
          {
            params: { period, keyword, status: tab, page, per_page: pageSize },
            signal,
          },
        )
        .then((r) => r.data),
  });
  const rows = query.data?.rows || [];
  const selectable = rows.filter((r) => r.suggestion.status === 'ready' && r.canConfirm);
  const checked = selected.map((r) => r.key);
  const pages = query.data?.pagination.totalPages || 1;
  const visiblePage = page;
  useEffect(() => {
    if (query.data && !query.isFetching && page > query.data.pagination.totalPages) {
      setPage(query.data.pagination.totalPages);
    }
  }, [query.data, query.isFetching, page]);
  return (
    <>
      <section
        className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
        aria-label="Kỳ ghi nhận"
      >
        <h2 className="mr-auto text-sm font-semibold">Kỳ ghi nhận</h2>
        <PrimaryActionButton
          onClick={() => {
            setTab('ready');
            setPage(1);
            setOpen(true);
          }}
        >
          Xác nhận hàng loạt ({counts.ready ?? '…'})
        </PrimaryActionButton>
        {Object.entries(labels)
          .filter(([key]) => key !== 'ready')
          .map(([key, label]) => (
            <DialogActionButton
              key={key}
              onClick={() => {
                setTab(key as keyof typeof labels);
                setPage(1);
                setOpen(true);
              }}
            >
              {label} ({counts[key] ?? '…'})
            </DialogActionButton>
          ))}
      </section>
      <AppDetailDialog
        open={open && !snapshot}
        title="Xác nhận kỳ ghi nhận"
        subtitle={`Tháng ${month(period)}`}
        maxWidth="lg"
        onClose={() => setOpen(false)}
        actions={
          <PrimaryActionButton
            disabled={!selected.length || busy || selectAll.isPending}
            onClick={() => {
              setSnapshot(selected);
              setRequestId(crypto.randomUUID());
              setError('');
              setConfirmPage(1);
            }}
          >
            Xác nhận đã chọn ({selected.length})
          </PrimaryActionButton>
        }
      >
        <Tabs
          value={tab}
          onChange={(_, value) => {
            setTab(value);
            setPage(1);
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {Object.entries(labels).map(([key, label]) => (
            <Tab key={key} value={key} label={`${label} (${counts[key] ?? '…'})`} />
          ))}
        </Tabs>
        {tab === 'ready' && (
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-sm">
            <Checkbox
              size="small"
              disabled={!selectable.length || busy || selectAll.isPending}
              checked={selectable.length > 0 && selectable.every((r) => checked.includes(r.key))}
              indeterminate={
                selectable.some((r) => checked.includes(r.key)) &&
                !selectable.every((r) => checked.includes(r.key))
              }
              slotProps={{
                input: { 'aria-label': 'Chọn các khoản đủ điều kiện trên trang này' },
              }}
              onChange={(_, value) =>
                setSelected((prev) =>
                  value
                    ? [
                        ...prev.filter((r) => !selectable.some((s) => s.key === r.key)),
                        ...selectable,
                      ].slice(0, 500)
                    : prev.filter((r) => !selectable.some((s) => s.key === r.key)),
                )
              }
            />
            <span>Chọn trang này · Đã chọn {selected.length}/500 khoản</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <DialogActionButton
                disabled={busy || selectAll.isPending}
                onClick={() => selectAll.mutate()}
              >
                {selectAll.isPending ? 'Đang chọn…' : 'Chọn tất cả đủ điều kiện'}
              </DialogActionButton>
              {!!selected.length && (
                <DialogActionButton
                  disabled={busy || selectAll.isPending}
                  onClick={() => {
                    setSelected([]);
                    selectAll.reset();
                  }}
                >
                  Bỏ chọn
                </DialogActionButton>
              )}
            </div>
          </div>
        )}
        {selectAll.isError && (
          <Alert severity="error">
            {getApiErrorMessage(selectAll.error, 'Không thể chọn các khoản. Vui lòng thử lại.')}
          </Alert>
        )}
        {tab === 'ready' && selectAll.data && selectAll.data.total > selectAll.data.limit && (
          <Alert severity="info">
            Có {selectAll.data.total} khoản đủ điều kiện. Mỗi lượt chọn tối đa{' '}
            {selectAll.data.limit} khoản; xác nhận xong có thể chọn lượt tiếp theo.
          </Alert>
        )}
        {query.isError && (
          <Alert severity="error">
            Không tải được danh sách.{' '}
            <DialogActionButton onClick={() => void query.refetch()}>Thử lại</DialogActionButton>
          </Alert>
        )}
        <AppDataTable
          isLoading={query.isFetching}
          minWidthClassName="min-w-[900px]"
          isEmpty={!rows.length}
          emptyText={
            query.isFetching
              ? 'Đang tải danh sách…'
              : `Không có khoản ${labels[tab].toLocaleLowerCase('vi')} phù hợp.`
          }
          columns={[
            { key: 'select', label: '', className: 'w-12' },
            { key: 'source', label: 'Dự án / nguồn', className: 'w-[32%]' },
            { key: 'amount', label: 'Giá trị', className: 'w-[16%]' },
            { key: 'period', label: 'Kỳ đề xuất', className: 'w-[15%]' },
            { key: 'reason', label: 'Căn cứ' },
          ]}
        >
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-slate-50">
              <td className="w-10 px-2">
                {tab === 'ready' && (
                  <Checkbox
                    size="small"
                    checked={selected.some((r) => r.key === row.key)}
                    disabled={
                      !row.canConfirm ||
                      !selectable.some((r) => r.key === row.key) ||
                      busy ||
                      selectAll.isPending ||
                      (!checked.includes(row.key) && selected.length >= 500)
                    }
                    slotProps={{ input: { 'aria-label': `Chọn ${row.title}` } }}
                    onChange={(_, value) =>
                      setSelected((prev) =>
                        value
                          ? [...prev.filter((r) => r.key !== row.key), row]
                          : prev.filter((r) => r.key !== row.key),
                      )
                    }
                  />
                )}
              </td>
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onProject(row.projectId);
                  }}
                  className="break-words text-left font-semibold text-primary hover:underline"
                >
                  {row.project}
                </button>
                <p className="mt-1 break-words text-xs text-slate-500">
                  {row.type === 'cost' ? 'Chi phí' : 'Doanh thu'} · {row.title}
                </p>
              </td>
              <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                {row.amount === null ? 'Cần kiểm tra' : formatCurrency(row.amount)}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                {row.suggestion.allocations.map((a) => month(a.period)).join(', ') ||
                  'Chưa xác định'}
              </td>
              <td className="max-w-xs px-3 py-3 text-xs text-slate-600">{row.suggestion.reason}</td>
            </tr>
          ))}
        </AppDataTable>
        <TablePaginationBar
          disabled={query.isFetching}
          page={visiblePage}
          totalPages={pages}
          totalItems={query.data?.pagination.total || 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </AppDetailDialog>
      {snapshot && (
        <AppFormDialog
          open
          title={`Xác nhận kỳ cho ${snapshot.length} khoản`}
          maxWidth="md"
          submitting={busy}
          onClose={() => {
            if (!busy) setSnapshot(null);
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              await onSubmit({
                requestId,
                period,
                items: snapshot.map((r) => ({
                  type: r.type,
                  id: r.id,
                  fingerprint: r.suggestion.fingerprint,
                })),
              });
              setSnapshot(null);
              setSelected([]);
              selectAll.reset();
            } catch (e) {
              setError(getApiErrorMessage(e, 'Không thể xác nhận. Vui lòng tải lại danh sách.'));
            }
          }}
          actions={
            <>
              <DialogActionButton disabled={busy} onClick={() => setSnapshot(null)}>
                Hủy
              </DialogActionButton>
              <DialogActionButton type="submit" tone="primary" disabled={busy}>
                {busy ? 'Đang xác nhận…' : `Xác nhận ${snapshot.length} khoản`}
              </DialogActionButton>
            </>
          }
        >
          {error && (
            <Alert severity="error" className="mb-3">
              {error}
            </Alert>
          )}
          <p className="mb-3 text-sm text-slate-600">
            Kiểm tra các tháng và giá trị phân bổ dưới đây trước khi ghi nhận.
          </p>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {(['revenue', 'cost'] as const).map((kind) => (
              <div key={kind} className="rounded-lg bg-slate-50 p-3 text-sm">
                <span>{kind === 'revenue' ? 'Doanh thu dịch vụ' : 'Chi phí trực tiếp'}</span>
                <strong className="mt-1 block">
                  {formatCurrency(
                    snapshot
                      .filter((r) => r.type === kind)
                      .reduce((s, r) => s + (r.amount || 0), 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
          <div className="divide-y rounded-lg border border-slate-200 px-3">
            {snapshot
              .slice((confirmPage - 1) * confirmPageSize, confirmPage * confirmPageSize)
              .map((r) => (
                <div key={r.key} className="py-3 text-sm">
                  <p className="font-medium break-words">
                    {r.type === 'revenue' ? r.title : `${r.project} · ${r.title}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {r.type === 'cost' ? 'Chi phí' : 'Doanh thu'} ·{' '}
                    {r.suggestion.allocations
                      .map((a) => `${month(a.period)}: ${formatCurrency(a.amount)}`)
                      .join(' · ')}
                  </p>
                </div>
              ))}
          </div>
          <TablePaginationBar
            page={confirmPage}
            totalPages={Math.ceil(snapshot.length / confirmPageSize)}
            totalItems={snapshot.length}
            pageSize={confirmPageSize}
            onPageChange={setConfirmPage}
            onPageSizeChange={(value) => {
              setConfirmPageSize(value);
              setConfirmPage(1);
            }}
          />
        </AppFormDialog>
      )}
    </>
  );
}
