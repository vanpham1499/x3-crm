'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@mui/material';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { CompactMonthPicker } from '@/components/form/compact-month-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';

type Source = {
  id: number;
  quotationCode?: string | null;
  requiresCompletion?: boolean;
  workCompletedPeriod?: string | null;
  canUpdateCompletion?: boolean;
};

export function QuotationCompletionButton({ quotation }: { quotation: Source }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [expected, setExpected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/quotations/${quotation.id}/work-completion`, {
        period: period || null,
        expectedPeriod: expected,
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      await Promise.all(
        [
          'partner-finance',
          'partner-finance-history',
          'projects',
          'project',
          'quotations',
          'quotation',
          'dashboard',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      setOpen(false);
    },
  });
  if (!quotation.requiresCompletion) return null;
  const label = quotation.workCompletedPeriod
    ? `Hoàn thành ${quotation.workCompletedPeriod.slice(5)}/${quotation.workCompletedPeriod.slice(0, 4)}`
    : 'Tháng hoàn thành';
  if (!quotation.canUpdateCompletion)
    return (
      <span className="text-xs text-slate-500">
        {quotation.workCompletedPeriod ? label : 'Chưa xác nhận hoàn thành'}
      </span>
    );
  return (
    <>
      <DialogActionButton
        onClick={() => {
          setPeriod(quotation.workCompletedPeriod || '');
          setExpected(quotation.workCompletedPeriod || null);
          setReason('');
          mutation.reset();
          setOpen(true);
        }}
      >
        {label}
      </DialogActionButton>
      <AppFormDialog
        open={open}
        title="Tháng hoàn thành công việc"
        maxWidth="sm"
        submitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if ((!expected || reason.trim().length >= 3) && (period || null) !== expected)
            mutation.mutate();
        }}
        actions={
          <>
            <DialogActionButton disabled={mutation.isPending} onClick={() => setOpen(false)}>
              Hủy
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              type="submit"
              disabled={
                mutation.isPending ||
                (!!expected && reason.trim().length < 3) ||
                (period || null) === expected
              }
            >
              {mutation.isPending ? 'Đang lưu…' : 'Lưu'}
            </DialogActionButton>
          </>
        }
      >
        <p className="mb-4 text-sm font-medium">{quotation.quotationCode}</p>
        {mutation.isError && (
          <Alert severity="error" className="mb-3">
            {getApiErrorMessage(mutation.error, 'Không lưu được tháng hoàn thành.')}
          </Alert>
        )}
        <div className="space-y-4">
          <CompactMonthPicker
            label="Tháng hoàn thành"
            value={period}
            onChange={(value) => setPeriod(value || '')}
          />
          {!!expected && (
            <FormInputField
              label="Lý do điều chỉnh"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              multiline
              minRows={2}
            />
          )}
          {!!expected && (
            <DialogActionButton disabled={mutation.isPending} onClick={() => setPeriod('')}>
              Gỡ tháng hoàn thành
            </DialogActionButton>
          )}
        </div>
      </AppFormDialog>
    </>
  );
}
