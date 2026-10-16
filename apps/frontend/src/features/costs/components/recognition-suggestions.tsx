'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Tab, Tabs } from '@mui/material';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { FormInputField } from '@/components/form/form-input-field';
import { formatCurrency } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-error';

export type RecognitionSuggestion = {
  status: 'ready' | 'review' | 'waiting' | 'confirmed' | 'excluded';
  reason: string;
  allocations: { period: string; amount: number }[];
  fingerprint?: string;
};
export type RecognitionCandidate = {
  key: string; type: 'revenue' | 'cost'; id: number; projectId: number;
  project: string; title: string; amount: number | null;
  suggestion: RecognitionSuggestion; canConfirm: boolean;
};
const month = (value: string) => `${value.slice(5)}/${value.slice(0, 4)}`;
const labels = { ready: 'Chờ xác nhận', review: 'Cần kiểm tra', waiting: 'Chờ đủ điều kiện' };

export function RecognitionSuggestions({ candidates, period, busy, onProject, onSubmit }: {
  candidates: RecognitionCandidate[]; period: string; busy: boolean;
  onProject: (id: number) => void;
  onSubmit: (data: unknown) => Promise<void>;
}) {
  const [tab, setTab] = useState<keyof typeof labels>('ready');
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<RecognitionCandidate[] | null>(null);
  const [requestId, setRequestId] = useState('');
  const [reason, setReason] = useState('Xác nhận theo kỳ đề xuất');
  const [error, setError] = useState('');
  const [confirmPage, setConfirmPage] = useState(1);
  const current = candidates.filter((r) => r.suggestion.status !== 'ready' || r.suggestion.allocations.some((a) => a.period === period));
  const rows = current.filter((r) => r.suggestion.status === tab);
  const selectable = current.filter((r) => r.suggestion.status === 'ready' && r.canConfirm).slice(0, 500);
  const selected = selectable.filter((r) => checked.includes(r.key));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const visiblePage = Math.min(page, pages);
  const pagination = (value: number, total: number, change: (n: number) => void) => (
    <div className="flex items-center justify-end gap-2 p-3 text-sm">
      <span className="mr-auto text-slate-500">{total} khoản</span>
      <Button size="small" disabled={value <= 1} onClick={() => change(value - 1)}>Trước</Button>
      <span>{value}</span>
      <Button size="small" disabled={value * 10 >= total} onClick={() => change(value + 1)}>Sau</Button>
    </div>
  );
  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Xác nhận kỳ ghi nhận">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="font-semibold">Xác nhận kỳ ghi nhận</h2>
          <p className="mt-1 text-xs text-slate-500">Đề xuất tháng {month(period)} · Các khoản thiếu kỳ được giữ ở Cần kiểm tra.</p>
        </div>
        <PrimaryActionButton disabled={!selected.length || busy} onClick={() => {
          setSnapshot(selected); setRequestId(crypto.randomUUID()); setError(''); setConfirmPage(1);
        }}>Xác nhận đã chọn ({selected.length})</PrimaryActionButton>
      </div>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); setPage(1); }} variant="scrollable" scrollButtons="auto">
        {Object.entries(labels).map(([key, label]) => <Tab key={key} value={key} label={`${label} (${current.filter((r) => r.suggestion.status === key).length})`} />)}
      </Tabs>
      {tab === 'ready' && <div className="flex items-center gap-1 border-t px-3 py-1 text-sm">
        <Checkbox size="small" disabled={!selectable.length || busy} checked={selectable.length > 0 && selected.length === selectable.length}
          indeterminate={selected.length > 0 && selected.length < selectable.length}
          slotProps={{ input: { 'aria-label': 'Chọn các khoản đủ điều kiện theo bộ lọc, gồm các trang' } }}
          onChange={(_, value) => setChecked(value ? selectable.map((r) => r.key) : [])} />
        <span>Chọn các khoản đủ điều kiện theo bộ lọc (tối đa 500)</span>
      </div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-slate-600"><tr>
            {['', 'Dự án / nguồn', 'Giá trị', 'Kỳ đề xuất', 'Căn cứ'].map((label, i) => <th key={i} className="px-3 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice((visiblePage - 1) * 10, visiblePage * 10).map((row) => <tr key={row.key} className="hover:bg-slate-50">
              <td className="w-10 px-2">{tab === 'ready' && <Checkbox size="small" checked={selected.some((r) => r.key === row.key)}
                disabled={!row.canConfirm || !selectable.some((r) => r.key === row.key) || busy || (!checked.includes(row.key) && selected.length >= 500)}
                slotProps={{ input: { 'aria-label': `Chọn ${row.title}` } }} onChange={(_, value) => setChecked((prev) => value ? [...prev, row.key] : prev.filter((key) => key !== row.key))} />}</td>
              <td className="px-3 py-3"><button type="button" onClick={() => onProject(row.projectId)} className="font-semibold text-primary hover:underline">{row.project}</button>
                <p className="mt-1 text-xs text-slate-500">{row.type === 'cost' ? 'Chi phí' : 'Doanh thu'} · {row.title}</p></td>
              <td className="px-3 py-3 whitespace-nowrap tabular-nums">{row.amount === null ? 'Cần kiểm tra' : formatCurrency(row.amount)}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.suggestion.allocations.map((a) => month(a.period)).join(', ') || 'Chưa xác định'}</td>
              <td className="max-w-xs px-3 py-3 text-xs text-slate-600">{row.suggestion.reason}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Không có khoản {labels[tab].toLocaleLowerCase('vi')} phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      {pagination(visiblePage, rows.length, setPage)}
      {snapshot && <AppFormDialog open title={`Xác nhận kỳ cho ${snapshot.length} khoản`} maxWidth="md" submitting={busy}
        onClose={() => { if (!busy) setSnapshot(null); }} onSubmit={async (event) => {
          event.preventDefault(); setError('');
          if (reason.trim().length < 3) { setError('Nhập nội dung xác nhận.'); return; }
          try {
            await onSubmit({ requestId, period, reason: reason.trim(), items: snapshot.map((r) => ({ type: r.type, id: r.id, fingerprint: r.suggestion.fingerprint })) });
            setSnapshot(null); setChecked([]);
          } catch (e) { setError(getApiErrorMessage(e, 'Không thể xác nhận. Vui lòng tải lại danh sách.')); }
        }} actions={<>
          <DialogActionButton disabled={busy} onClick={() => setSnapshot(null)}>Hủy</DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={busy}>{busy ? 'Đang xác nhận…' : `Xác nhận ${snapshot.length} khoản`}</DialogActionButton>
        </>}>
        {error && <Alert severity="error" className="mb-3">{error}</Alert>}
        <p className="mb-3 text-sm text-slate-600">Kiểm tra các tháng và giá trị phân bổ dưới đây trước khi ghi nhận.</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {(['revenue', 'cost'] as const).map((kind) => <div key={kind} className="rounded-lg bg-slate-50 p-3 text-sm">
            <span>{kind === 'revenue' ? 'Doanh thu dịch vụ' : 'Chi phí trực tiếp'}</span>
            <strong className="mt-1 block">{formatCurrency(snapshot.filter((r) => r.type === kind).reduce((s, r) => s + (r.amount || 0), 0))}</strong>
          </div>)}
        </div>
        <div className="divide-y rounded-lg border border-slate-200 px-3">
          {snapshot.slice((confirmPage - 1) * 10, confirmPage * 10).map((r) => <div key={r.key} className="py-3 text-sm">
            <p className="font-medium break-words">{r.type === 'revenue' ? r.title : `${r.project} · ${r.title}`}</p>
            <p className="mt-1 text-xs text-slate-600">{r.type === 'cost' ? 'Chi phí' : 'Doanh thu'} · {r.suggestion.allocations.map((a) => `${month(a.period)}: ${formatCurrency(a.amount)}`).join(' · ')}</p>
          </div>)}
        </div>
        {pagination(confirmPage, snapshot.length, setConfirmPage)}
        <FormInputField label="Nội dung xác nhận" value={reason} onChange={(e) => setReason(e.target.value)} required />
      </AppFormDialog>}
    </section>
  );
}
