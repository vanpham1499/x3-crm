'use client';

import { useRef, useState } from 'react';
import { Alert, MenuItem } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage, getApiFieldErrors } from '@/lib/api-error';
import { formatCustomerIdentity } from '@/lib/customer-utils';
import api from '@/services/api/client';
import type { Quotation } from '@/types/quotation';
import type { QuotationVoidPreview } from '@/types/quotation-void';
import { formatVoidMoney, QuotationVoidEntries } from './quotation-void-history';

function errorMessage(error: unknown) {
  const errors = Object.values(getApiFieldErrors(error));
  return errors.length
    ? [...new Set(errors)].join(' ')
    : getApiErrorMessage(error, 'Không thể xử lý hủy báo phí.');
}

export function QuotationVoidDialog({
  quotation,
  onClose,
}: {
  quotation: Quotation;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [mode, setMode] = useState<'release' | 'transfer'>('release');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<QuotationVoidPreview | null>(null);
  const [error, setError] = useState('');
  // Retain the exact submitted body on ambiguous network failures for safe retries.
  const submittedBody = useRef<Record<string, unknown> | null>(null);
  const {
    data: targets = [],
    isFetching: loadingTargets,
    isError: targetsError,
  } = useQuery<Quotation[]>({
    queryKey: [
      'quotations',
      'void-targets',
      quotation.id,
      quotation.projectId,
      quotation.customerId,
    ],
    queryFn: () =>
      api
        .get<Quotation[]>('/quotations', {
          params: {
            project_id: quotation.projectId,
            customer_id: quotation.customerId,
            allocation_open: true,
          },
        })
        .then((response) => response.data),
    enabled: mode === 'transfer' && Boolean(quotation.projectId && quotation.customerId),
  });
  const resetPreview = () => {
    setPreview(null);
    setCode('');
    setError('');
    submittedBody.current = null;
  };
  const previewMutation = useMutation({
    mutationFn: () =>
      api
        .post<QuotationVoidPreview>(`/quotations/${quotation.id}/void-preview`, {
          mode,
          ...(mode === 'transfer' ? { targetQuotationId: Number(targetId) } : {}),
        })
        .then((response) => response.data),
    onSuccess: (data) => {
      setPreview(data);
      setError('');
      submittedBody.current = null;
    },
    onError: (failure) => {
      setPreview(null);
      setError(errorMessage(failure));
    },
  });
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api
        .post<{ quotation: Quotation }>(`/quotations/${quotation.id}/void`, body)
        .then((response) => response.data),
    onSuccess: async (result) => {
      // Apply the result after cancelling requests that could restore old cached data.
      // Remove stale in-flight snapshots before invalidation, across all affected modules.
      const keys = [
        'quotations',
        'payments',
        'payment-refunds',
        'projects',
        'project-costs',
        'kpi',
        'dashboard',
        'notifications',
      ];
      await Promise.all(keys.map((key) => queryClient.cancelQueries({ queryKey: [key] })));
      queryClient.setQueryData(['quotations', String(quotation.id)], result.quotation);
      await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      notify.success('Đã hủy báo phí và xử lý phân bổ. Giao dịch ngân hàng được giữ nguyên.');
      onClose();
    },
    onError: (failure) => {
      setError(errorMessage(failure));
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status && status >= 400 && status < 500) {
        resetPreview();
        setError(errorMessage(failure));
      }
    },
  });
  const busy = mutation.isPending || previewMutation.isPending;
  const canConfirm = Boolean(
    preview &&
    preview.blockers.length === 0 &&
    code.trim() === preview.sourceCode &&
    reason.trim().length >= 5 &&
    !busy,
  );
  const uncertainRetry = Boolean(submittedBody.current) && mutation.isError;

  return (
    <AppFormDialog
      open
      title="Hủy báo phí tạo nhầm"
      maxWidth="md"
      submitting={busy}
      onClose={onClose}
      contentClassName="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if ((!canConfirm && !uncertainRetry) || busy || !preview) return;
        const body = submittedBody.current ?? {
          mode: preview.mode,
          ...(preview.targetId ? { targetQuotationId: preview.targetId } : {}),
          reason: reason.trim(),
          confirmationCode: code.trim(),
          fingerprint: preview.fingerprint,
          requestId: globalThis.crypto.randomUUID(),
        };
        submittedBody.current = body;
        mutation.mutate(body);
      }}
      actions={
        <>
          <DialogActionButton onClick={onClose} disabled={busy}>
            Đóng
          </DialogActionButton>
          <DialogActionButton
            disabled={busy || uncertainRetry || (mode === 'transfer' && !targetId)}
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending ? 'Đang kiểm tra...' : 'Xem kết quả dự kiến'}
          </DialogActionButton>
          <DialogActionButton
            type="submit"
            tone="danger"
            disabled={busy || (!canConfirm && !uncertainRetry)}
          >
            {mutation.isPending
              ? 'Đang xử lý...'
              : uncertainRetry
                ? 'Thử xác nhận lại'
                : 'Xác nhận hủy báo phí'}
          </DialogActionButton>
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="break-all font-extrabold text-slate-950">{quotation.quotationCode}</p>
        <p className="mt-1 break-all">
          {quotation.project?.projectCode} · {formatCustomerIdentity(quotation.customer)}
        </p>
        <p className="mt-2">
          Tổng báo: <strong>{formatVoidMoney(quotation.totalAmount)}</strong> · Đã phân bổ:{' '}
          <strong>{formatVoidMoney(quotation.grossPaidAmount)}</strong>
        </p>
      </div>
      <Alert severity="warning">
        Không xóa tiền ngân hàng hoặc tự hoàn tiền khách. Báo phí bị hủy không còn hiệu lực; lịch sử
        được giữ để đối chiếu.
      </Alert>
      <FormSelectField
        label="Cách xử lý tiền"
        value={mode}
        disabled={busy || uncertainRetry}
        onChange={(event) => {
          setMode(event.target.value as 'release' | 'transfer');
          setTargetId('');
          resetPreview();
        }}
      >
        <MenuItem value="release">Hủy và chuyển về chưa phân bổ</MenuItem>
        <MenuItem value="transfer">Hủy và chuyển sang báo phí đúng</MenuItem>
      </FormSelectField>
      {mode === 'transfer' ? (
        <FormSelectField
          label="Báo phí đúng — cùng khách hàng và dự án"
          value={targetId}
          disabled={busy || uncertainRetry || loadingTargets}
          error={targetsError}
          helperText={
            targetsError
              ? 'Không tải được báo phí đích. Đóng và mở lại để thử.'
              : 'Chỉ chuyển tối đa công nợ đích; phần dư về chưa phân bổ.'
          }
          onChange={(event) => {
            setTargetId(event.target.value);
            resetPreview();
          }}
        >
          <MenuItem value="" disabled>
            Chọn báo phí còn công nợ
          </MenuItem>
          {targets
            .filter((item) => item.id !== quotation.id && !item.isVoided)
            .map((item) => (
              <MenuItem key={item.id} value={String(item.id)}>
                {item.quotationCode} — Còn {formatVoidMoney(item.outstandingAmount)}
              </MenuItem>
            ))}
        </FormSelectField>
      ) : null}
      {error ? (
        <Alert severity="error">
          {error}
          {uncertainRetry
            ? ' Chưa xác nhận được kết quả. Nút thử lại gửi đúng yêu cầu cũ, không xử lý tiền hai lần.'
            : ''}
        </Alert>
      ) : null}
      {preview ? (
        <>
          {preview.blockers.map((message, index) => (
            <Alert severity="error" key={index}>
              {message}
            </Alert>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Phân bổ bị gỡ', preview.allocatedAmount],
              ['Chuyển sang báo phí', preview.transferAmount],
              ['Về chưa phân bổ', preview.releaseAmount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 font-extrabold">{formatVoidMoney(value)}</p>
              </div>
            ))}
          </div>
          <p className="text-sm">
            Hạn mức còn có thể nạp của dự án:{' '}
            <strong>{formatVoidMoney(preview.availableBudgetBefore)}</strong> →{' '}
            <strong>{formatVoidMoney(preview.availableBudgetAfter)}</strong>.
          </p>
          {preview.targetCode ? (
            <p className="break-all text-sm">
              Báo phí đích: <strong>{preview.targetCode}</strong> · Công nợ sau xử lý:{' '}
              <strong>{formatVoidMoney(preview.targetOutstandingAfter)}</strong>.
            </p>
          ) : null}
          <QuotationVoidEntries entries={preview.entries} />
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <p>
              KPI báo phí đầu thu đủ: {preview.acquisitionBefore?.quotationCode || 'Chưa ghi nhận'}{' '}
              → {preview.acquisitionAfter?.quotationCode || 'Chưa ghi nhận'}.
            </p>
            {preview.warnings.map((message, index) => (
              <p key={index}>{message}</p>
            ))}
          </div>
        </>
      ) : null}
      <FormInputField
        label="Lý do hủy"
        multiline
        minRows={2}
        required
        value={reason}
        disabled={busy || uncertainRetry}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
        helperText="Bắt buộc ghi rõ lý do, tối thiểu 5 ký tự."
        onChange={(event) => setReason(event.target.value)}
      />
      <FormInputField
        label="Nhập lại mã báo phí đầy đủ để xác nhận"
        required
        value={code}
        disabled={busy || uncertainRetry || !preview}
        helperText={preview?.sourceCode || 'Xem kết quả dự kiến trước khi xác nhận.'}
        onChange={(event) => setCode(event.target.value)}
      />
    </AppFormDialog>
  );
}
