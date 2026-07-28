'use client';

import { useEffect, useState } from 'react';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { getApiErrorMessage } from '@/lib/api-error';
import type { Meeting } from '@/types/meeting';

type MeetingStatusDialogProps = {
  meeting: Meeting | null;
  mode: 'complete' | 'cancel';
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
};

export function MeetingStatusDialog({
  meeting,
  mode,
  isSubmitting,
  onClose,
  onSubmit,
}: MeetingStatusDialogProps) {
  const [result, setResult] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meeting) return;

    setResult(meeting.result || '');
    setNextAction(meeting.nextAction || '');
    setNextActionDate(meeting.nextActionDate || '');
    setReason(meeting.cancellationReason || '');
    setError('');
  }, [meeting, mode]);

  if (!meeting) return null;

  const submit = async () => {
    if (mode === 'complete' && !result.trim()) {
      setError('Vui lòng nhập kết quả cuộc họp.');
      return;
    }

    if (mode === 'cancel' && !reason.trim()) {
      setError('Vui lòng nhập lý do hủy lịch.');
      return;
    }

    try {
      setError('');
      await onSubmit(
        mode === 'complete'
          ? {
              result: result.trim(),
              nextAction: nextAction.trim() || null,
              nextActionDate: nextActionDate || null,
            }
          : { reason: reason.trim() },
      );
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Không thể cập nhật lịch hẹn.'));
    }
  };

  return (
    <AppDetailDialog
      open
      title={mode === 'complete' ? 'Hoàn thành lịch hẹn' : 'Hủy lịch hẹn'}
      eyebrow={meeting.meetingCode || undefined}
      subtitle={meeting.subject}
      maxWidth="sm"
      onClose={onClose}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={onClose}>
            Đóng
          </DialogActionButton>
          <DialogActionButton
            tone="primary"
            startIcon={<CheckCircleOutlineRoundedIcon />}
            disabled={isSubmitting}
            onClick={() => void submit()}
          >
            {isSubmitting
              ? 'Đang xử lý...'
              : mode === 'complete'
                ? 'Xác nhận hoàn thành'
                : 'Hủy lịch'}
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-4 bg-slate-50/60 p-5">
        {mode === 'complete' ? (
          <>
            <FormInputField
              required
              multiline
              minRows={4}
              label="Kết quả cuộc họp"
              value={result}
              error={Boolean(error)}
              helperText={error}
              onChange={(event) => setResult(event.target.value)}
            />
            <FormInputField
              multiline
              minRows={3}
              label="Hành động tiếp theo"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
            <FormDatePicker
              label="Ngày thực hiện tiếp theo"
              value={nextActionDate}
              onChange={setNextActionDate}
            />
          </>
        ) : (
          <FormInputField
            required
            multiline
            minRows={4}
            label="Lý do hủy lịch"
            value={reason}
            error={Boolean(error)}
            helperText={error}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </div>
    </AppDetailDialog>
  );
}
