'use client';

import { useEffect, useMemo, useRef } from 'react';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { CircularProgress, IconButton, LinearProgress } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { getMediaPreviewUrl } from '@/lib/media-url';
import api from '@/services/api/client';
import type { WeeklyReportAttachment } from '@/types/weekly-report';

const ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.zip';
const HELPER_TEXT =
  'Hỗ trợ ảnh (jpeg, png, gif, webp) và tài liệu (pdf, doc, xls, csv, zip), tối đa 10MB.';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mimeType?: string | null) {
  return Boolean(mimeType?.startsWith('image/'));
}

function EmptyState() {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-500">
      <AttachFileRoundedIcon className="mb-2 text-3xl text-slate-300" />
      <p className="text-sm font-semibold">Chưa có tệp đính kèm nào</p>
    </div>
  );
}

function PanelShell({
  title,
  helperText,
  isBusy,
  onPickFiles,
  inputRef,
  onInputChange,
  children,
}: {
  title: string;
  helperText: string;
  isBusy: boolean;
  onPickFiles: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (files: FileList) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <TabActionButton
          startIcon={
            isBusy ? <CircularProgress size={16} color="inherit" /> : <UploadFileRoundedIcon />
          }
          disabled={isBusy}
          onClick={onPickFiles}
        >
          {isBusy ? 'Đang tải lên...' : 'Tải tệp lên'}
        </TabActionButton>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPT}
          onChange={(event) => {
            if (event.target.files?.length) onInputChange(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {isBusy && <LinearProgress color="primary" />}

      <div className="space-y-3 p-5">
        {children}
        <p className="text-xs leading-5 text-slate-500">{helperText}</p>
      </div>
    </section>
  );
}

function AttachmentRow({
  fileName,
  mimeType,
  previewUrl,
  meta,
  onRemove,
  isRemoving,
}: {
  fileName: string;
  mimeType?: string | null;
  previewUrl: string;
  meta: string;
  onRemove: () => void;
  isRemoving?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      {isImageMime(mimeType) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={fileName}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <DescriptionRoundedIcon />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-bold text-slate-900 hover:underline"
            title={fileName}
          >
            {fileName}
          </a>
        ) : (
          <p className="truncate text-sm font-bold text-slate-900" title={fileName}>
            {fileName}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{meta}</p>
      </div>

      <IconButton size="small" title="Xóa tệp" disabled={isRemoving} onClick={onRemove}>
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </div>
  );
}

type ExistingModeProps = {
  mode: 'existing';
  reportId: number;
  attachments: WeeklyReportAttachment[];
};

type PendingModeProps = {
  mode: 'pending';
  files: File[];
  onFilesChange: (files: File[]) => void;
};

export function WeeklyReportAttachmentsPanel(props: ExistingModeProps | PendingModeProps) {
  if (props.mode === 'pending') {
    return <PendingAttachmentsPanel {...props} />;
  }

  return <ExistingAttachmentsPanel {...props} />;
}

function ExistingAttachmentsPanel({ reportId, attachments }: ExistingModeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post(`/weekly-reports/${reportId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports', String(reportId)] });
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Tải lên tệp thất bại')),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachment: WeeklyReportAttachment) =>
      api.delete(`/weekly-report-attachments/${attachment.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-reports', String(reportId)] });
      notify.success('Đã xóa tệp đính kèm');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa tệp thất bại')),
  });

  const uploadFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    const results = await Promise.allSettled(files.map((file) => uploadMutation.mutateAsync(file)));
    const failed = results.filter((result) => result.status === 'rejected').length;

    if (failed === 0) {
      notify.success(
        files.length > 1 ? `Đã tải lên ${files.length} tệp` : 'Đã tải lên tệp đính kèm',
      );
    } else if (failed < files.length) {
      notify.error(`${failed}/${files.length} tệp tải lên thất bại`);
    }
  };

  return (
    <PanelShell
      title="Tệp đính kèm / Hình ảnh"
      helperText={HELPER_TEXT}
      isBusy={uploadMutation.isPending}
      onPickFiles={() => inputRef.current?.click()}
      inputRef={inputRef}
      onInputChange={uploadFiles}
    >
      {attachments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              fileName={attachment.fileName}
              mimeType={attachment.mimeType}
              previewUrl={getMediaPreviewUrl(attachment.fileUrl)}
              meta={`${attachment.uploadedBy?.name || '-'} · ${formatDate(attachment.createdAt)}`}
              onRemove={() => deleteMutation.mutate(attachment)}
              isRemoving={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function PendingAttachmentsPanel({ files, onFilesChange }: PendingModeProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrls = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : '')),
    [files],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  return (
    <PanelShell
      title="Tệp đính kèm / Hình ảnh"
      helperText={`${HELPER_TEXT} Tệp sẽ được tải lên sau khi lưu báo cáo.`}
      isBusy={false}
      onPickFiles={() => inputRef.current?.click()}
      inputRef={inputRef}
      onInputChange={(fileList) => onFilesChange([...files, ...Array.from(fileList)])}
    >
      {files.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {files.map((file, index) => (
            <AttachmentRow
              key={`${file.name}-${file.lastModified}-${index}`}
              fileName={file.name}
              mimeType={file.type}
              previewUrl={previewUrls[index]}
              meta={formatSize(file.size)}
              onRemove={() => onFilesChange(files.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}
    </PanelShell>
  );
}
