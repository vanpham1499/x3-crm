'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import { PageHeader } from '@/components/shell/page-header';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { AppDataTable } from '@/components/table/app-data-table';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { CompactMonthPicker } from '@/components/form/compact-month-picker';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { FormInputField } from '@/components/form/form-input-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import { QuotationCompletionButton } from '@/features/quotations/components/quotation-completion-button';
import { RecognitionSuggestions, type RecognitionSuggestion } from './recognition-suggestions';

type Allocation = { period: string; amount: number };
type Recognition = { revision: number; amount: number; allocations: Allocation[] };
type Payment = {
  id: number;
  amount: number;
  paidOn: string;
  reference: string;
  voided: boolean;
  legacy: boolean;
  voidReason?: string;
};
type Cost = {
  partnerId: number | null;
  id: number;
  partner: string;
  amount: number;
  paid: number;
  remaining: number;
  paidOn: string | null;
  workPeriod: string | null;
  quotationId: number | null;
  usesLedger: boolean;
  canFund: boolean;
  reconciled: boolean;
  recognition: Recognition | null;
  suggestion?: RecognitionSuggestion;
  payments: Payment[];
};
type Quote = {
  requiresCompletion: boolean;
  workCompletedPeriod: string | null;
  canUpdateCompletion: boolean;
  id: number;
  code: string;
  amount: number | null;
  recognition: Recognition | null;
  suggestion?: RecognitionSuggestion;
  needsReview: boolean;
};
type Project = {
  id: number;
  code: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  paidInPeriod: number;
  receivedInPeriod: number;
  payable: number;
  unconfirmedPayable: number;
  partialScope: boolean;
  reviewCount: number;
  readyCount: number;
  waitingCount: number;
  canConfirm: boolean;
  costs: Cost[];
  quotations: Quote[];
};
type Report = {
  period: string;
  locked: boolean;
  canLock: boolean;
  rows: Project[];
  pagination: { page: number; total: number; totalPages: number };
};
type Target = {
  type: 'cost' | 'revenue';
  id: number;
  title: string;
  amount: number;
  recognition: Recognition | null;
  suggestion?: RecognitionSuggestion;
  period?: string | null;
};
type Action =
  | { kind: 'recognition'; target: Target; remove?: boolean }
  | { kind: 'payment'; cost: Cost; companions?: Cost[] }
  | { kind: 'void'; cost: Cost; payment: Payment }
  | { kind: 'period'; locked: boolean };
type History = {
  action: string;
  reason: string;
  actor: string;
  created_at: string;
  before: string | null;
  after: string | null;
};

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const monthLabel = (period: string) => `${period.slice(5, 7)}/${period.slice(0, 4)}`;
const historyLabels: Record<string, string> = {
  work_completion: 'Xác nhận tháng hoàn thành',
  confirm: 'Xác nhận ghi nhận',
  adjust: 'Điều chỉnh ghi nhận',
  unconfirm: 'Gỡ ghi nhận',
  payment: 'Ghi thanh toán',
  void_payment: 'Hủy ghi thanh toán',
};
const money = (value: number) => formatCurrency(value);

function Periods({ recognition }: { recognition: Recognition | null }) {
  return recognition ? (
    <span className="text-xs text-slate-500">
      {recognition.allocations.map((r) => monthLabel(r.period)).join(', ')}
    </span>
  ) : (
    <span className="text-xs text-amber-700">Chưa xác nhận kỳ</span>
  );
}

function FinanceActionDialog({
  action,
  period,
  busy,
  onClose,
  onSubmit,
}: {
  action: Action;
  period: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (path: string, method: 'post' | 'put' | 'delete', data: unknown) => Promise<void>;
}) {
  const target = action.kind === 'recognition' ? action.target : null;
  const reasonRequired = action.kind !== 'recognition' || !!action.remove || !!target?.recognition;
  const [rows, setRows] = useState<Allocation[]>(
    target?.recognition?.allocations ||
      (target?.suggestion?.allocations.length ? target.suggestion.allocations : null) || [
        { period: target?.period || period, amount: target?.amount || 0 },
      ],
  );
  const [reason, setReason] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState(
    action.kind === 'payment' ? String(action.cost.remaining) : '',
  );
  const [reference, setReference] = useState('');
  const [extraPayments, setExtraPayments] = useState<Record<number, string>>({});
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const title =
    action.kind === 'recognition'
      ? `${action.remove ? 'Gỡ' : 'Xác nhận'} ghi nhận ${target?.type === 'cost' ? 'chi phí' : 'doanh thu'}`
      : action.kind === 'payment'
        ? 'Ghi thanh toán đối tác'
        : action.kind === 'void'
          ? 'Hủy ghi thanh toán'
          : action.locked
            ? 'Chốt kỳ'
            : 'Mở lại kỳ';
  return (
    <AppFormDialog
      open
      title={title}
      maxWidth="sm"
      submitting={busy}
      onClose={onClose}
      contentClassName="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        if (reasonRequired && reason.trim().length < 3) {
          setError('Nhập nội dung xác nhận hoặc lý do điều chỉnh.');
          return;
        }
        try {
          if (action.kind === 'recognition') {
            const data = {
              revision: target?.recognition?.revision || 0,
              reason: reason.trim() || undefined,
              allocations: rows,
            };
            await onSubmit(
              `/partner-finance/${action.target.type}/${action.target.id}/recognition`,
              action.remove ? 'delete' : 'put',
              data,
            );
          } else if (action.kind === 'payment') {
            if (
              !paidOn ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) <= 0 ||
              Number(amount) > action.cost.remaining
            ) {
              setError('Kiểm tra ngày chi và số tiền còn phải trả.');
              return;
            }
            await onSubmit('/partner-finance/payments', 'post', {
              requestId,
              paidOn,
              allocations: [
                { costId: action.cost.id, amount: Number(amount) },
                ...Object.entries(extraPayments).map(([id, value]) => ({
                  costId: Number(id),
                  amount: Number(value),
                })),
              ],
              reference,
              note: reason,
            });
          } else if (action.kind === 'void')
            await onSubmit(
              `/partner-finance/cost/${action.cost.id}/payments/${action.payment.id}`,
              'delete',
              { reason },
            );
          else
            await onSubmit(`/partner-finance/periods/${period}`, 'put', {
              locked: action.locked,
              reason,
            });
        } catch (err) {
          setError(getApiErrorMessage(err, 'Không thể lưu.'));
        }
      }}
      actions={
        <>
          <DialogActionButton disabled={busy} onClick={onClose}>
            Đóng
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Xác nhận'}
          </DialogActionButton>
        </>
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      {target && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="font-semibold break-words">{target.title}</p>
          <p className="mt-1 text-sm">
            Giá trị trước VAT: <strong>{money(target.amount)}</strong>
          </p>
        </div>
      )}
      {action.kind === 'recognition' && !action.remove && (
        <>
          <p className="text-sm text-slate-500">
            Xác nhận công việc đủ điều kiện ghi nhận trong các kỳ dưới đây.
          </p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_32px] items-center gap-2">
              <CompactMonthPicker
                label="Kỳ công việc"
                value={row.period}
                onChange={(value) =>
                  setRows(rows.map((r, i) => (i === index ? { ...r, period: value } : r)))
                }
              />
              <FormInputField
                label="Giá trị"
                type="number"
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                value={row.amount || ''}
                onChange={(e) =>
                  setRows(
                    rows.map((r, i) =>
                      i === index ? { ...r, amount: Number(e.target.value) } : r,
                    ),
                  )
                }
              />
              <IconButton
                aria-label="Bỏ kỳ"
                size="small"
                disabled={rows.length === 1 || busy}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              disabled={busy}
              onClick={() => setRows([...rows, { period: '', amount: 0 }])}
            >
              Thêm kỳ
            </Button>
            <span className="text-sm">
              Đã phân bổ: {money(rows.reduce((s, r) => s + r.amount, 0))}
            </span>
          </div>
        </>
      )}
      {action.kind === 'recognition' && action.remove && (
        <Alert severity="warning">
          Gỡ số liệu khỏi báo cáo kỳ. Các khoản đã thanh toán và lịch sử vẫn được giữ.
        </Alert>
      )}
      {action.kind === 'payment' && (
        <>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-semibold">{action.cost.partner}</p>
            <p className="mt-1 text-sm">
              Còn phải trả: <strong>{money(action.cost.remaining)}</strong>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormDatePicker
              label="Ngày thực chi"
              value={paidOn}
              onChange={setPaidOn}
              max={today()}
              required
            />
            <FormInputField
              label="Số tiền đã trả"
              type="number"
              slotProps={{ htmlInput: { min: 0.01, max: action.cost.remaining, step: '0.01' } }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <FormInputField
            label="Mã giao dịch / chứng từ"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          {!!action.companions?.length && (
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Phân bổ thêm cho khoản khác của cùng đối tác
              </summary>
              <div className="mt-2 space-y-3">
                {action.companions.map((cost) => (
                  <div key={cost.id} className="space-y-2">
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={cost.id in extraPayments}
                          onChange={(_, checked) =>
                            setExtraPayments((previous) => {
                              const next = { ...previous };
                              if (checked) next[cost.id] = String(cost.remaining);
                              else delete next[cost.id];
                              return next;
                            })
                          }
                        />
                      }
                      label={
                        <span className="text-sm">
                          Khoản #{cost.id} · Còn {money(cost.remaining)}
                        </span>
                      }
                    />
                    {cost.id in extraPayments && (
                      <FormInputField
                        label={`Phân bổ khoản #${cost.id}`}
                        type="number"
                        value={extraPayments[cost.id]}
                        onChange={(e) =>
                          setExtraPayments({ ...extraPayments, [cost.id]: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
          <p className="text-sm font-semibold">
            Tổng ghi thanh toán:{' '}
            {money(
              Number(amount) +
                Object.values(extraPayments).reduce((sum, value) => sum + Number(value), 0),
            )}
          </p>
          <p className="text-xs text-slate-500">
            Chỉ ghi nhận khoản đã chuyển; thao tác này không chuyển tiền.
          </p>
        </>
      )}
      {action.kind === 'void' && (
        <Alert severity="warning">
          Hủy ghi nhận {money(action.payment.amount)} ngày {action.payment.paidOn}. Công nợ sẽ tăng
          lại; không thực hiện hoàn tiền qua ngân hàng.
        </Alert>
      )}
      {action.kind === 'period' && (
        <Alert severity={action.locked ? 'info' : 'warning'}>
          {monthLabel(period)} ·{' '}
          {action.locked
            ? 'Khóa ghi nhận và thanh toán đối tác trong kỳ. Những khoản chưa đối soát không được tự đưa vào báo cáo.'
            : 'Cho phép điều chỉnh lại số liệu kỳ. Mọi thay đổi được lưu lịch sử.'}
        </Alert>
      )}
      {reasonRequired && (
        <FormInputField
          label="Nội dung xác nhận / lý do"
          multiline
          minRows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      )}
    </AppFormDialog>
  );
}

function HistoryDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['partner-finance-history', target.type, target.id],
    queryFn: ({ signal }) =>
      api
        .get<History[]>(`/partner-finance/${target.type}/${target.id}/history`, { signal })
        .then((r) => r.data),
  });
  function snapshot(text: string | null) {
    if (!text) return null;
    try {
      const value = JSON.parse(text);
      return (
        value?.allocations
          ?.map((r: Allocation) => `${monthLabel(r.period)}: ${money(r.amount)}`)
          .join(' · ') || null
      );
    } catch {
      return null;
    }
  }
  return (
    <AppFormDialog
      open
      title="Lịch sử đối soát"
      onClose={onClose}
      onSubmit={(e) => e.preventDefault()}
      actions={<DialogActionButton onClick={onClose}>Đóng</DialogActionButton>}
    >
      <p className="mb-4 font-semibold break-words">{target.title}</p>
      {query.isPending ? (
        <CircularProgress size={24} />
      ) : query.isError ? (
        <Alert severity="error">
          Không tải được lịch sử. <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </Alert>
      ) : !query.data.length ? (
        <p className="text-sm text-slate-500">Chưa có thay đổi.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {query.data.map((entry, i) => (
            <div key={i} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{historyLabels[entry.action] || entry.action}</strong>
                <span className="text-xs text-slate-500">
                  {entry.actor} · {new Date(entry.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <p>{entry.reason}</p>
              {snapshot(entry.before) && (
                <p className="text-xs text-slate-500">Trước: {snapshot(entry.before)}</p>
              )}
              {snapshot(entry.after) && (
                <p className="text-xs text-slate-500">Sau: {snapshot(entry.after)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppFormDialog>
  );
}

export function PartnerFinanceManager() {
  const params = useSearchParams();
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(keyword);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  const [selectedId, setSelectedId] = useState(Number(params.get('project')) || 0);
  const [action, setAction] = useState<Action | null>(null);
  const [history, setHistory] = useState<Target | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const client = useQueryClient();
  const notify = useAppNotification();
  const query = useQuery({
    queryKey: ['partner-finance', 'projects', period, search, page, pageSize],
    placeholderData: keepPreviousData,
    enabled: /^20\d{2}-\d{2}$/.test(period),
    queryFn: ({ signal }) =>
      api
        .get<Report>('/partner-finance', {
          params: { period, keyword: search, page, per_page: pageSize },
          signal,
        })
        .then((r) => r.data),
  });
  const summary = useQuery({
    queryKey: ['partner-finance', 'summary', period, search],
    queryFn: ({ signal }) =>
      api
        .get<{
          totals: Record<string, number>;
          counts: Record<string, number>;
          partialScope: boolean;
        }>('/partner-finance/summary', { params: { period, keyword: search }, signal })
        .then((r) => r.data),
  });
  const detail = useQuery({
    queryKey: ['partner-finance', 'detail', selectedId, period],
    enabled: selectedId > 0,
    queryFn: ({ signal }) =>
      api
        .get<Project>(`/partner-finance/projects/${selectedId}`, { params: { period }, signal })
        .then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: async ({
      path,
      method,
      data,
    }: {
      path: string;
      method: 'post' | 'put' | 'delete';
      data: unknown;
    }) => {
      await api.request({ url: path, method, data });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['partner-finance'] }),
        client.invalidateQueries({ queryKey: ['partner-finance-history'] }),
        client.invalidateQueries({ queryKey: ['project-costs'] }),
        client.invalidateQueries({ queryKey: ['projects'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setAction(null);
      notify.success('Đã lưu đối soát.');
    },
  });
  const rows = query.data?.rows || [];
  const totalPages = query.data?.pagination.totalPages || 1;
  const visiblePage = page;
  const selected = detail.data;
  const totals = summary.data?.totals || {};
  const costTarget = (c: Cost): Target => ({
    type: 'cost',
    id: c.id,
    title: `${selected?.code} · ${c.partner}`,
    amount: c.amount,
    recognition: c.recognition,
    period: c.workPeriod,
    suggestion: c.suggestion,
  });
  const quoteTarget = (q: Quote): Target => ({
    type: 'revenue',
    id: q.id,
    title: q.code,
    amount: q.amount || 0,
    recognition: q.recognition,
    suggestion: q.suggestion,
  });
  const buttons = (target: Target, canConfirm: boolean) => (
    <div className="flex flex-wrap gap-1">
      {canConfirm && (
        <>
          <Button
            size="small"
            onClick={() => setAction({ kind: 'recognition', target })}
            disabled={
              mutation.isPending ||
              target.amount < 0 ||
              (target.type === 'cost' && target.amount === 0)
            }
          >
            {target.recognition ? 'Điều chỉnh kỳ' : 'Xác nhận kỳ'}
          </Button>
          {target.recognition && (
            <Button
              size="small"
              color="inherit"
              onClick={() => setAction({ kind: 'recognition', target, remove: true })}
            >
              Gỡ ghi nhận
            </Button>
          )}
        </>
      )}
      <Button size="small" color="inherit" onClick={() => setHistory(target)}>
        Lịch sử
      </Button>
    </div>
  );
  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-4 md:p-6">
      <PageHeader
        title="Công nợ & lợi nhuận"
        actions={
          <PrimaryActionButton
            href="/costs"
            tone="secondary"
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          >
            Danh sách chi phí
          </PrimaryActionButton>
        }
      />
      <section
        aria-label="Bộ lọc công nợ và lợi nhuận"
        className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <ListFilterBar>
          <CompactSearchField
            label="Từ khóa"
            placeholder="Mã hoặc tên dự án..."
            value={keyword}
            onChange={(value) => {
              setKeyword(value);
              setPage(1);
            }}
          />
          <div>
            <CompactMonthPicker
              label="Kỳ báo cáo"
              value={period}
              onChange={(v) => {
                if (!v) return;
                setPeriod(v);
                setPage(1);
              }}
            />
          </div>
          <div data-list-filter-action className="flex flex-wrap items-center gap-2">
            {query.data && (
              <Chip
                size="small"
                label={query.data?.locked ? 'Đã chốt kỳ' : 'Kỳ đang mở'}
                color={query.data?.locked ? 'default' : 'success'}
                variant="outlined"
                className="!rounded-md !text-xs"
              />
            )}
            {query.data?.canLock && (
              <PrimaryActionButton
                tone="secondary"
                startIcon={
                  query.data.locked ? (
                    <LockOpenRoundedIcon fontSize="small" />
                  ) : (
                    <LockOutlinedIcon fontSize="small" />
                  )
                }
                disabled={query.isFetching}
                onClick={() => setAction({ kind: 'period', locked: !query.data?.locked })}
              >
                {query.data.locked ? 'Mở lại kỳ' : 'Chốt kỳ'}
              </PrimaryActionButton>
            )}
            <PrimaryActionButton
              tone="secondary"
              startIcon={
                query.isFetching ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RefreshRoundedIcon fontSize="small" />
                )
              }
              onClick={() => void client.invalidateQueries({ queryKey: ['partner-finance'] })}
              disabled={query.isFetching}
            >
              {query.isFetching ? 'Đang tải...' : 'Tải lại'}
            </PrimaryActionButton>
          </div>
        </ListFilterBar>
      </section>
      {query.isPending ? (
        <div className="p-12 text-center">
          <CircularProgress size={26} />
        </div>
      ) : query.isError ? (
        <Alert severity="error">{getApiErrorMessage(query.error, 'Không tải được báo cáo.')}</Alert>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Doanh thu dịch vụ và chi phí theo kỳ đã xác nhận · Công nợ tại hiện tại
          </p>
          {summary.isError && (
            <Alert severity="error">
              Không tải được số tổng hợp.{' '}
              <Button onClick={() => void summary.refetch()}>Thử lại</Button>
            </Alert>
          )}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['Doanh thu ghi nhận', totals.revenue],
              ['Chi phí ghi nhận', totals.cost],
              ['Lợi nhuận đã ghi nhận', totals.profit],
              ['Tiền thu trong kỳ (chưa trừ hoàn)', totals.received],
              ['Thực chi trong kỳ', totals.paid],
              ['Còn phải trả đã xác nhận', totals.payable],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p
                  className={`mt-2 text-lg font-bold tabular-nums ${Number(value) < 0 ? 'text-rose-700' : 'text-slate-900'}`}
                >
                  {summary.isPending ? '…' : summary.isError ? '—' : money(Number(value))}
                </p>
              </div>
            ))}
          </div>
          <RecognitionSuggestions
            key={`${period}:${search}`}
            keyword={search}
            counts={summary.data?.counts || {}}
            period={period}
            busy={mutation.isPending}
            onProject={setSelectedId}
            onSubmit={async (data) => {
              await mutation.mutateAsync({
                path: '/partner-finance/recognitions/batch',
                method: 'post',
                data,
              });
            }}
          />
          {summary.data?.partialScope && (
            <Alert severity="info" className="mb-4">
              Số liệu chỉ gồm các khoản anh/chị có quyền xem; chưa phản ánh toàn bộ lợi nhuận dự án.
            </Alert>
          )}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <AppDataTable
              isLoading={query.isFetching}
              minWidthClassName="min-w-[950px]"
              isEmpty={!rows.length}
              emptyText="Chưa có dự án phù hợp."
              columns={[
                { key: 'project', label: 'Dự án', className: 'w-[30%]' },
                { key: 'revenue', label: 'Doanh thu' },
                { key: 'cost', label: 'Chi phí' },
                { key: 'profit', label: 'Lợi nhuận' },
                { key: 'payable', label: 'Còn phải trả' },
                { key: 'review', label: 'Đối soát', className: 'w-[17%]' },
              ]}
            >
              {rows.map((r) => (
                <tr key={r.id} className={selectedId === r.id ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      disabled={query.isFetching}
                      className="break-words text-left font-semibold text-primary hover:underline"
                    >
                      {r.code}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">{r.name}</p>
                  </td>
                  {[r.revenue, r.cost, r.profit, r.payable].map((v, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 whitespace-nowrap tabular-nums ${v < 0 ? 'text-rose-700' : ''}`}
                    >
                      {money(v)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Button
                      size="small"
                      disabled={query.isFetching}
                      onClick={() => setSelectedId(r.id)}
                    >
                      {r.reviewCount
                        ? `${r.reviewCount} cần kiểm tra`
                        : r.readyCount
                          ? `${r.readyCount} chờ xác nhận`
                          : 'Chi tiết'}
                    </Button>
                  </td>
                </tr>
              ))}
            </AppDataTable>
            <TablePaginationBar
              disabled={query.isFetching}
              page={visiblePage}
              totalPages={totalPages}
              totalItems={query.data?.pagination.total || 0}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </section>
          {selectedId > 0 && !selected && (
            <AppDetailDialog open title="Chi tiết dự án" onClose={() => setSelectedId(0)}>
              <div className="p-6">
                {detail.isError ? (
                  <Alert severity="error">
                    Không tải được dự án.{' '}
                    <Button onClick={() => void detail.refetch()}>Thử lại</Button>
                  </Alert>
                ) : (
                  <CircularProgress size={24} />
                )}
              </div>
            </AppDetailDialog>
          )}
          {selectedId > 0 && selected && (
            <AppDetailDialog
              open={!action && !history}
              title={selected.code}
              subtitle={selected.name}
              maxWidth="lg"
              onClose={() => setSelectedId(0)}
              actions={
                <DialogActionButton href={`/projects/${selected.id}?tab=finance`}>
                  Mở dự án
                </DialogActionButton>
              }
            >
              <div className="space-y-4 p-4 md:p-5">
                <h3 className="text-sm font-semibold">Doanh thu dịch vụ trước VAT</h3>
                {!selected.quotations.length && (
                  <p className="text-sm text-slate-500">Chưa có báo phí được phép xem.</p>
                )}
                {selected.quotations.map((q) => (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium break-all">{q.code}</p>
                      <p className="my-1 text-sm font-semibold">
                        {q.amount === null ? 'Cần kiểm tra cơ cấu báo phí' : money(q.amount)}
                      </p>
                      <Periods recognition={q.recognition} />
                      {q.suggestion && !q.recognition && (
                        <p className="mt-1 text-xs text-slate-600">{q.suggestion.reason}</p>
                      )}
                      {q.needsReview && (
                        <p className="text-xs text-amber-700">Nguồn cần đối soát lại.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <QuotationCompletionButton quotation={{ ...q, quotationCode: q.code }} />
                      {buttons(quoteTarget(q), selected.canConfirm && q.amount !== null)}
                    </div>
                  </div>
                ))}
                <h3 className="border-t pt-4 text-sm font-semibold">
                  Chi phí & thanh toán đối tác
                </h3>
                {!selected.costs.length && (
                  <p className="text-sm text-slate-500">Chưa có chi phí đối tác.</p>
                )}
                {selected.costs.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{c.partner}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Khoản #{c.id}
                          {c.quotationId
                            ? ` · ${selected.quotations.find((q) => q.id === c.quotationId)?.code || `Báo phí #${c.quotationId}`}`
                            : ' · Chưa gắn báo phí'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                          <span>
                            Chi phí <strong>{money(c.amount)}</strong>
                          </span>
                          <span>
                            Đã trả <strong>{money(c.paid)}</strong>
                          </span>
                          <span>
                            {c.recognition ? 'Còn phải trả' : 'Còn lại chưa xác nhận'}{' '}
                            <strong className="text-amber-700">{money(c.remaining)}</strong>
                          </span>
                        </div>
                        <div className="mt-2">
                          <Periods recognition={c.recognition} />
                          {c.suggestion && !c.recognition && (
                            <p className="mt-1 text-xs text-slate-600">{c.suggestion.reason}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        {buttons(costTarget(c), selected.canConfirm)}
                        {c.canFund && c.remaining > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!c.recognition}
                            onClick={() =>
                              setAction({
                                kind: 'payment',
                                cost: c,
                                companions: selected.costs.filter(
                                  (other) =>
                                    other.id !== c.id &&
                                    c.partnerId !== null &&
                                    other.partnerId === c.partnerId &&
                                    other.remaining > 0 &&
                                    other.recognition &&
                                    other.canFund &&
                                    !other.reconciled,
                                ),
                              })
                            }
                          >
                            Ghi thanh toán
                          </Button>
                        )}
                      </div>
                    </div>
                    {!c.usesLedger && c.paid > 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        Khoản đã chi trước đây: {money(c.paid)} · {c.paidOn || 'Thiếu ngày chi'}.
                        Xác nhận kỳ để đối soát vào sổ mới.
                      </p>
                    )}
                    {!!c.payments.length && (
                      <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                        {c.payments.map((p) => (
                          <div
                            key={p.id}
                            className={`flex flex-wrap items-center justify-between gap-2 py-2 text-xs ${p.voided ? 'text-slate-400' : 'text-slate-600'}`}
                          >
                            <span>
                              {p.paidOn} · {money(p.amount)} ·{' '}
                              {p.reference || 'Không có mã chứng từ'}
                              {p.legacy ? ' · Lịch sử cũ' : ''}
                              {p.voided ? ` · Đã hủy: ${p.voidReason}` : ''}
                            </span>
                            {c.canFund && !c.reconciled && !p.voided && !p.legacy && (
                              <Button
                                size="small"
                                color="inherit"
                                onClick={() => setAction({ kind: 'void', cost: c, payment: p })}
                              >
                                Hủy ghi nhận
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AppDetailDialog>
          )}
        </>
      )}
      {action && (
        <FinanceActionDialog
          action={action}
          period={period}
          busy={mutation.isPending}
          onClose={() => setAction(null)}
          onSubmit={(path, method, data) => mutation.mutateAsync({ path, method, data })}
        />
      )}
      {history && <HistoryDialog target={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
