'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import {
  Button,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { ImageLightbox } from '@/components/media/image-lightbox';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { UserDateTimeCell } from '@/components/table/user-date-time-cell';
import { clipboardImageFile, formatFileSize, getImageValidationError } from '@/lib/image-file';
import { getMediaPreviewUrl } from '@/lib/media-url';
import type { MediaItem, MediaUsage } from '@/types/media';

type MediaManagerProps = {
  images: MediaItem[];
  keyword: string;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onKeywordChange: (keyword: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onCreate: (file: File, name: string) => Promise<unknown>;
  onUpdate: (image: MediaItem, name: string) => Promise<unknown>;
  onDelete: (image: MediaItem, detachUsage: boolean) => Promise<unknown>;
};

type ViewMode = 'grid' | 'table';

const usageClasses: Record<MediaUsage['type'], string> = {
  customer: 'bg-slate-100 text-slate-700 ring-slate-200',
  quotation: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  weekly_report: 'bg-sky-50 text-sky-700 ring-sky-200',
  user: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function UsageLinks({ usages, compact = false }: { usages: MediaUsage[]; compact?: boolean }) {
  if (usages.length === 0) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
        Chưa sử dụng
      </span>
    );
  }

  if (compact) {
    const groups = Object.values(
      usages.reduce<Record<string, { usage: MediaUsage; count: number; labels: string[] }>>(
        (result, usage) => {
          const current = result[usage.type];

          if (current) {
            current.count += 1;
            current.labels.push(usage.label);
          } else {
            result[usage.type] = { usage, count: 1, labels: [usage.label] };
          }

          return result;
        },
        {},
      ),
    );

    return (
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {groups.slice(0, 2).map(({ usage, count, labels }) => (
          <Link
            key={usage.type}
            href={usage.href}
            title={labels.join('\n')}
            className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${usageClasses[usage.type]}`}
          >
            {usage.typeLabel}
            {count > 1 ? ` · ${count}` : ''}
          </Link>
        ))}
        {groups.length > 2 && (
          <span
            title={groups
              .slice(2)
              .map(({ usage, count }) => `${usage.typeLabel}: ${count}`)
              .join('\n')}
            className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200"
          >
            +{groups.length - 2}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {usages.map((usage) => (
        <Link
          key={`${usage.type}-${usage.entityId}`}
          href={usage.href}
          title={`${usage.typeLabel}: ${usage.label}`}
          className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${usageClasses[usage.type]}`}
        >
          <span className="shrink-0">{usage.typeLabel}</span>
          <span className="truncate font-semibold opacity-80">· {usage.label}</span>
        </Link>
      ))}
    </div>
  );
}

function MediaActions({
  image,
  onEdit,
  onDelete,
}: {
  image: MediaItem;
  onEdit: (image: MediaItem) => void;
  onDelete: (image: MediaItem) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Tác vụ ảnh ${image.originalName || image.fileName}`}
        title="Tác vụ"
        className="!h-8 !w-8 !text-slate-500"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ list: { dense: true } }}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onEdit(image);
          }}
        >
          <EditRoundedIcon className="mr-2 !text-[18px] text-slate-500" />
          Sửa tên ảnh
        </MenuItem>
        <MenuItem
          className="!text-red-600"
          onClick={() => {
            setAnchorEl(null);
            onDelete(image);
          }}
        >
          <DeleteRoundedIcon className="mr-2 !text-[18px]" />
          Xóa ảnh
        </MenuItem>
      </Menu>
    </>
  );
}

function MediaUploadDialog({
  open,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (file: File, name: string) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl('');
    setName('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const selectFile = (nextFile: File) => {
    const validationError = getImageValidationError(nextFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setName(nextFile.name);
    setError('');
  };

  useEffect(() => {
    if (!open) return;

    const handlePaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items || []).find((candidate) =>
        candidate.type.startsWith('image/'),
      );
      const pastedFile = item?.getAsFile();

      if (!pastedFile) return;
      event.preventDefault();
      selectFile(clipboardImageFile(pastedFile));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // The listener must be recreated when the current preview changes so URL cleanup stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, previewUrl]);

  useEffect(() => {
    if (!open) clearPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pasteFromClipboard = async () => {
    setError('');

    if (!navigator.clipboard?.read) {
      setError('Trình duyệt chưa cho phép đọc clipboard. Hãy nhấn Ctrl+V trong popup.');
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) => type.startsWith('image/'));

        if (!imageType) continue;
        const blob = await clipboardItem.getType(imageType);
        selectFile(clipboardImageFile(blob));
        return;
      }

      setError('Clipboard chưa có ảnh.');
    } catch {
      setError('Không thể đọc clipboard. Hãy nhấn Ctrl+V trong popup.');
    }
  };

  const closeDialog = () => {
    if (submitting) return;
    clearPreview();
    onClose();
  };

  return (
    <AppFormDialog
      open={open}
      title="Thêm ảnh vào thư viện"
      maxWidth="sm"
      submitting={submitting}
      contentClassName="space-y-4"
      onClose={closeDialog}
      onSubmit={async (event) => {
        event.preventDefault();

        if (!file) {
          setError('Vui lòng chọn hoặc dán một ảnh.');
          return;
        }

        if (!name.trim()) {
          setError('Vui lòng nhập tên ảnh.');
          return;
        }

        try {
          await onSubmit(file, name.trim());
          clearPreview();
          onClose();
        } catch {
          // Notification is handled by the request mutation; keep the dialog open for retry.
        }
      }}
      actions={
        <>
          <DialogActionButton disabled={submitting} onClick={closeDialog}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={submitting || !file}>
            {submitting ? 'Đang tải...' : 'Thêm ảnh'}
          </DialogActionButton>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) selectFile(selectedFile);
        }}
      />

      <div className="grid min-h-56 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Ảnh xem trước" className="max-h-64 w-full object-contain" />
        ) : (
          <div className="py-8 text-center text-slate-500">
            <AddPhotoAlternateRoundedIcon className="!text-5xl text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">Chọn hoặc dán ảnh để xem trước</p>
            <p className="mt-1 text-xs">JPG, PNG, GIF, WEBP · tối đa 3MB</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <DialogActionButton
          startIcon={<CloudUploadRoundedIcon />}
          disabled={submitting}
          onClick={() => inputRef.current?.click()}
        >
          Chọn từ máy
        </DialogActionButton>
        <DialogActionButton
          startIcon={<ContentPasteRoundedIcon />}
          disabled={submitting}
          onClick={() => void pasteFromClipboard()}
        >
          Dán ảnh (Ctrl+V)
        </DialogActionButton>
      </div>

      <TextField
        fullWidth
        size="small"
        label="Tên ảnh *"
        value={name}
        error={Boolean(error && file && !name.trim())}
        onChange={(event) => setName(event.target.value)}
      />
      {file && (
        <p className="text-xs font-medium text-slate-500">
          {file.type} · {formatFileSize(file.size)}
        </p>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </AppFormDialog>
  );
}

function MediaEditDialog({
  image,
  submitting,
  onClose,
  onSubmit,
}: {
  image: MediaItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (image: MediaItem, name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(image?.originalName || image?.fileName || '');
    setError('');
  }, [image]);

  return (
    <AppFormDialog
      open={Boolean(image)}
      title="Chỉnh sửa ảnh"
      maxWidth="sm"
      submitting={submitting}
      contentClassName="space-y-4"
      onClose={onClose}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!image) return;

        if (!name.trim()) {
          setError('Vui lòng nhập tên ảnh.');
          return;
        }

        try {
          await onSubmit(image, name.trim());
          onClose();
        } catch {
          // Notification is handled by the request mutation; keep the dialog open for retry.
        }
      }}
      actions={
        <>
          <DialogActionButton disabled={submitting} onClick={onClose}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={submitting}>
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </DialogActionButton>
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getMediaPreviewUrl(image?.url) || image?.previewUrl || ''}
          alt={image?.originalName || image?.fileName || 'Ảnh'}
          className="h-64 w-full object-contain"
        />
      </div>
      <TextField
        autoFocus
        fullWidth
        size="small"
        label="Tên ảnh *"
        value={name}
        error={Boolean(error)}
        helperText={error}
        onChange={(event) => {
          setName(event.target.value);
          setError('');
        }}
      />
      {image && <UsageLinks usages={image.usages || []} />}
    </AppFormDialog>
  );
}

function MediaPreviewDialog({
  image,
  onClose,
  onEdit,
  onDelete,
}: {
  image: MediaItem | null;
  onClose: () => void;
  onEdit: (image: MediaItem) => void;
  onDelete: (image: MediaItem) => void;
}) {
  if (!image) return null;

  const createdAt = image.createdAt
    ? new Date(image.createdAt).toLocaleString('vi-VN')
    : 'Không xác định';

  return (
    <ImageLightbox
      open
      images={[
        {
          src: image.url || image.previewUrl || '',
          alt: image.originalName || image.fileName,
          label: `${formatFileSize(image.size)} · ${image.mimeType || image.fileType || 'Ảnh'} · ${image.uploader?.name || 'Hệ thống'} · ${createdAt}`,
        },
      ]}
      title={image.originalName || image.fileName}
      onClose={onClose}
      actions={
        <>
          <DialogActionButton
            startIcon={<EditRoundedIcon />}
            onClick={() => {
              onClose();
              onEdit(image);
            }}
          >
            Sửa tên
          </DialogActionButton>
          <Button
            color="error"
            variant="outlined"
            size="small"
            startIcon={<DeleteRoundedIcon />}
            className="!h-9 !rounded-lg !px-3 !text-[13px] !font-bold"
            onClick={() => onDelete(image)}
          >
            Xóa
          </Button>
        </>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <p className="w-32 shrink-0 text-sm font-bold text-slate-700">Đang sử dụng</p>
          <div className="min-w-0 flex-1">
            <UsageLinks usages={image.usages || []} />
          </div>
        </div>
      }
    />
  );
}

export function MediaManager({
  images,
  keyword,
  page,
  pageSize,
  totalPages,
  totalItems,
  isFetching,
  isSubmitting,
  isDeleting,
  onKeywordChange,
  onPageChange,
  onPageSizeChange,
  onCreate,
  onUpdate,
  onDelete,
}: MediaManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<MediaItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<MediaItem | null>(null);
  const [previewImage, setPreviewImage] = useState<MediaItem | null>(null);

  const askDelete = (image: MediaItem) => setDeletingImage(image);

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Thư viện ảnh"
        action={{
          label: 'Thêm ảnh',
          icon: <AddRoundedIcon />,
          onClick: () => setCreateOpen(true),
        }}
      />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xl">
            <CompactSearchField
              label="Từ khóa"
              placeholder="Tìm theo tên ảnh..."
              value={keyword}
              onChange={onKeywordChange}
            />
          </div>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={viewMode}
            aria-label="Chế độ hiển thị thư viện"
            onChange={(_, value: ViewMode | null) => value && setViewMode(value)}
            className="shrink-0 [&_.MuiToggleButton-root]:!h-10 [&_.MuiToggleButton-root]:!px-3"
          >
            <ToggleButton value="grid" aria-label="Hiển thị dạng lưới">
              <GridViewRoundedIcon className="mr-1.5 !text-[18px]" />
              Grid
            </ToggleButton>
            <ToggleButton value="table" aria-label="Hiển thị dạng bảng">
              <TableRowsRoundedIcon className="mr-1.5 !text-[18px]" />
              Table
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {isFetching && <LinearProgress color="primary" />}

        {images.length === 0 && !isFetching ? (
          <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center text-slate-500">
            <ImageRoundedIcon className="!text-6xl text-slate-300" />
            <p className="mt-3 font-bold text-slate-800">Chưa có ảnh phù hợp</p>
            <p className="mt-1 text-sm">Thêm ảnh mới hoặc thay đổi từ khóa tìm kiếm.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div
            className={`grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 ${isFetching ? 'opacity-60' : ''}`}
          >
            {images.map((image) => (
              <article
                key={image.id}
                className="group min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <button
                    type="button"
                    aria-label={`Xem ảnh ${image.originalName || image.fileName}`}
                    title="Xem ảnh"
                    className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    onClick={() => setPreviewImage(image)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMediaPreviewUrl(image.url) || image.previewUrl || ''}
                      alt={image.originalName || image.fileName}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                  </button>
                  <div className="absolute right-2 top-2 rounded-lg bg-white/95 shadow-sm backdrop-blur">
                    <MediaActions image={image} onEdit={setEditingImage} onDelete={askDelete} />
                  </div>
                </div>
                <div className="space-y-2 p-2.5">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-bold text-slate-900"
                      title={image.originalName || image.fileName}
                    >
                      {image.originalName || image.fileName}
                    </p>
                  </div>
                  <UsageLinks usages={image.usages || []} compact />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <AppDataTable
            columns={[
              { key: 'preview', label: 'Ảnh', className: 'w-[76px]' },
              { key: 'name', label: 'Tên ảnh', className: 'w-[24%]' },
              { key: 'usage', label: 'Nguồn', className: 'w-[30%]' },
              { key: 'creator', label: 'Người tải / Ngày tải', className: 'w-[18%]' },
              { key: 'size', label: 'Dung lượng', className: 'w-[110px]' },
              { key: 'actions', label: '', className: 'w-[52px]' },
            ]}
            isLoading={isFetching}
            minWidthClassName="min-w-[920px]"
          >
            {images.map((image) => (
              <tr key={image.id} className="transition hover:bg-slate-50/70">
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    aria-label={`Xem ảnh ${image.originalName || image.fileName}`}
                    title="Xem ảnh"
                    className="block h-11 w-14 cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => setPreviewImage(image)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getMediaPreviewUrl(image.url) || image.previewUrl || ''}
                      alt={image.originalName || image.fileName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <p
                    className="truncate font-bold text-slate-900"
                    title={image.originalName || image.fileName}
                  >
                    {image.originalName || image.fileName}
                  </p>
                  <p
                    className="mt-1 truncate text-[11px] font-medium text-slate-400"
                    title={image.fileName}
                  >
                    {image.fileName}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <UsageLinks usages={image.usages || []} compact />
                </td>
                <td className="px-3 py-2.5">
                  <UserDateTimeCell userName={image.uploader?.name} dateTime={image.createdAt} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-slate-600">
                  {formatFileSize(image.size)}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <MediaActions image={image} onEdit={setEditingImage} onDelete={askDelete} />
                </td>
              </tr>
            ))}
          </AppDataTable>
        )}

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48]}
          pageSizeLabel="Số ảnh"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </section>

      <MediaPreviewDialog
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onEdit={setEditingImage}
        onDelete={askDelete}
      />
      <MediaUploadDialog
        open={createOpen}
        submitting={isSubmitting}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
      />
      <MediaEditDialog
        image={editingImage}
        submitting={isSubmitting}
        onClose={() => setEditingImage(null)}
        onSubmit={onUpdate}
      />
      <ConfirmDialog
        open={Boolean(deletingImage)}
        title="Xóa ảnh khỏi thư viện?"
        description={
          deletingImage?.usageCount
            ? `Ảnh đang được gắn tại ${deletingImage.usageCount} nơi. Nếu tiếp tục, hệ thống sẽ gỡ ảnh khỏi các dữ liệu liên quan rồi xóa hoàn toàn.`
            : `Ảnh “${deletingImage?.originalName || deletingImage?.fileName || ''}” sẽ bị xóa khỏi hệ thống.`
        }
        confirmText={deletingImage?.usageCount ? 'Gỡ và xóa ảnh' : 'Xóa ảnh'}
        loading={isDeleting}
        onClose={() => setDeletingImage(null)}
        onConfirm={() => {
          if (!deletingImage) return;

          void onDelete(deletingImage, Boolean(deletingImage.usageCount))
            .then(() => {
              setDeletingImage(null);
              setPreviewImage(null);
            })
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
