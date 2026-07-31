'use client';

import { useEffect, useState } from 'react';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { FormInputField } from '@/components/form/form-input-field';
import type { WeeklyReport } from '@/types/weekly-report';

type WeeklyReportRejectDialogProps = {
  report: WeeklyReport | null;
  loading: boolean;
  onClose: () => void;
  onReject: (report: WeeklyReport, reason: string) => Promise<unknown>;
};

export function WeeklyReportRejectDialog({
  report,
  loading,
  onClose,
  onReject,
}: WeeklyReportRejectDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!report) {
      setReason('');
      setError('');
    }
  }, [report]);

  const close = () => {
    if (loading) return;
    setReason('');
    setError('');
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(report)}
      title="Từ chối báo cáo tuần"
      maxWidth="sm"
      submitting={loading}
      onClose={close}
      onSubmit={async (event) => {
        event.preventDefault();
        const normalizedReason = reason.trim();

        if (!normalizedReason) {
          setError('Vui lòng nhập lý do để người lập báo cáo chỉnh sửa.');
          return;
        }

        if (!report) return;

        try {
          await onReject(report, normalizedReason);
          close();
        } catch {
          // Notification lỗi API được xử lý tại page gọi action.
        }
      }}
      actions={
        <>
          <DialogActionButton disabled={loading} onClick={close}>
            Hủy
          </DialogActionButton>
          <div className="flex-1" />
          <DialogActionButton
            type="submit"
            tone="danger"
            startIcon={<BlockRoundedIcon />}
            disabled={loading}
          >
            {loading ? 'Đang từ chối...' : 'Từ chối báo cáo'}
          </DialogActionButton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-6 text-slate-600">
          Báo cáo sẽ chuyển sang trạng thái bị từ chối. Người lập có thể chỉnh sửa theo lý do bên
          dưới và gửi duyệt lại.
        </p>
        <FormInputField
          multiline
          minRows={4}
          autoFocus
          required
          label="Lý do từ chối"
          placeholder="Nêu rõ nội dung cần bổ sung hoặc chỉnh sửa..."
          value={reason}
          error={Boolean(error)}
          helperText={error || 'Lý do sẽ hiển thị trực tiếp trên trang chỉnh sửa báo cáo.'}
          slotProps={{
            htmlInput: { maxLength: 2000 },
            formHelperText: { role: error ? 'alert' : undefined },
          }}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError('');
          }}
        />
      </div>
    </AppFormDialog>
  );
}
