'use client';

import { useState } from 'react';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { LinearProgress } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { MultiImageUpload } from '@/components/upload/multi-image-upload';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { WeeklyReportAttachment } from '@/types/weekly-report';

const MAX_REPORT_IMAGES = 20;

type ExistingModeProps = {
  mode: 'existing';
  reportId: number;
  attachments: WeeklyReportAttachment[];
  readOnly?: boolean;
};

type PendingModeProps = {
  mode: 'pending';
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
};

function isImageAttachment(attachment: WeeklyReportAttachment) {
  return Boolean(attachment.mimeType?.startsWith('image/'));
}

function PanelShell({ isBusy, children }: { isBusy: boolean; children: React.ReactNode }) {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-14 items-center border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-base font-bold text-slate-950">Hình ảnh</h2>
      </div>
      {isBusy && <LinearProgress color="primary" />}
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyImages() {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-500">
      <ImageRoundedIcon className="mb-2 text-3xl text-slate-300" />
      <p className="text-sm font-semibold">Chưa có hình ảnh nào</p>
    </div>
  );
}

export function WeeklyReportAttachmentsPanel(props: ExistingModeProps | PendingModeProps) {
  if (props.mode === 'pending') {
    return <PendingImagesPanel {...props} />;
  }

  return <ExistingImagesPanel {...props} />;
}

function PendingImagesPanel({ imageUrls, onImageUrlsChange }: PendingModeProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <PanelShell isBusy={isUploading}>
      <MultiImageUpload
        value={imageUrls}
        onChange={onImageUrlsChange}
        onUploadingChange={setIsUploading}
        maxFiles={MAX_REPORT_IMAGES}
        imageLabel="Ảnh báo cáo"
        captionLabel="Ảnh"
        collectionLabel="báo cáo tuần"
        helperText="Chọn từ thư viện, tải ảnh mới hoặc dán ảnh bằng Ctrl+V. Ảnh sẽ được gắn vào báo cáo sau khi lưu."
      />
    </PanelShell>
  );
}

function ExistingImagesPanel({ reportId, attachments, readOnly = false }: ExistingModeProps) {
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const imageAttachments = attachments.filter(isImageAttachment);
  const imageUrls = imageAttachments.map((attachment) => attachment.fileUrl);

  const attachMutation = useMutation({
    mutationFn: (mediaUrl: string) =>
      api.post(`/weekly-reports/${reportId}/attachments`, { media_url: mediaUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports', String(reportId)] });
    },
    onError: (error) =>
      notify.error(getApiErrorMessage(error, 'Không thể gắn ảnh vào báo cáo tuần')),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachment: WeeklyReportAttachment) =>
      api.delete(`/weekly-report-attachments/${attachment.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports', String(reportId)] });
      notify.success('Đã xóa ảnh khỏi báo cáo');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa ảnh thất bại')),
  });

  const isBusy = isUploading || attachMutation.isPending || deleteMutation.isPending;

  const updateImages = (nextUrls: string[]) => {
    const addedUrl = nextUrls.find((url) => !imageUrls.includes(url));
    if (addedUrl) {
      attachMutation.mutate(addedUrl);
      return;
    }

    const removedAttachment = imageAttachments.find(
      (attachment) => !nextUrls.includes(attachment.fileUrl),
    );
    if (removedAttachment) {
      deleteMutation.mutate(removedAttachment);
    }
  };

  return (
    <PanelShell isBusy={isBusy}>
      {imageUrls.length === 0 && readOnly ? (
        <EmptyImages />
      ) : (
        <MultiImageUpload
          value={imageUrls}
          onChange={updateImages}
          onUploadingChange={setIsUploading}
          maxFiles={MAX_REPORT_IMAGES}
          disabled={readOnly || isBusy}
          imageLabel="Ảnh báo cáo"
          captionLabel="Ảnh"
          collectionLabel="báo cáo tuần"
          helperText={
            readOnly
              ? 'Hình ảnh đã được đính kèm trong báo cáo tuần.'
              : 'Chọn từ thư viện, tải ảnh mới hoặc dán ảnh bằng Ctrl+V.'
          }
        />
      )}
    </PanelShell>
  );
}
