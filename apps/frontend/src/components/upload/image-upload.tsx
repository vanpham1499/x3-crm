'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  TextField,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { getApiErrorMessage } from '@/lib/api-error';
import { clipboardImageFile, formatFileSize, getImageValidationError } from '@/lib/image-file';
import { getMediaPreviewUrl } from '@/lib/media-url';
import api from '@/services/api/client';
import type { MediaItem } from '@/types/media';
import type { PaginatedResponse } from '@/types/pagination';

export type UploadedImage = MediaItem;

const MEDIA_PAGE_SIZE = 12;
type ImageUploadProps = {
  value?: string;
  alt?: string;
  helperText?: string;
  className?: string;
  previewClassName?: string;
  fallbackText?: string;
  shape?: 'circle' | 'card';
  onUploadingChange?: (isUploading: boolean) => void;
  onChange: (url: string, image?: UploadedImage) => void;
};

export function ImageUpload({
  value,
  alt = 'Ảnh upload',
  helperText = 'Hỗ trợ *.jpeg, *.jpg, *.png, *.gif, *.webp, tối đa 3MB',
  className = '',
  previewClassName = '',
  fallbackText,
  shape = 'circle',
  onUploadingChange,
  onChange,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notify = useAppNotification();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [requestKeyword, setRequestKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(MEDIA_PAGE_SIZE);
  const [error, setError] = useState('');
  const [clipboardPreview, setClipboardPreview] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (clipboardPreview?.previewUrl) {
        URL.revokeObjectURL(clipboardPreview.previewUrl);
      }
    };
  }, [clipboardPreview]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRequestKeyword(keyword.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [keyword]);

  const { data: imagesPage, isFetching } = useQuery<PaginatedResponse<MediaItem>>({
    queryKey: ['media', 'images', requestKeyword, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<MediaItem>>('/media', {
          params: {
            scope: 'mine',
            keyword: requestKeyword || undefined,
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const images = imagesPage?.data || [];
  const pagination = imagesPage?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post<MediaItem>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onMutate: () => onUploadingChange?.(true),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['media', 'images'] });
      onChange(response.data.url, response.data);
      notify.success('Upload ảnh thành công');
      setError('');
      setClipboardPreview(null);
      setOpen(false);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Upload ảnh thất bại'));
    },
    onSettled: () => {
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  const uploadImage = (file: File) => {
    setError('');

    const validationError = getImageValidationError(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    uploadMutation.mutate(file);
  };

  const showClipboardPreview = useCallback((file: File) => {
    setError('');

    const validationError = getImageValidationError(file);

    if (validationError) {
      setClipboardPreview(null);
      setError(validationError);
      return;
    }

    setClipboardPreview({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (uploadMutation.isPending) return;

      const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
        item.type.startsWith('image/'),
      );
      const image = imageItem?.getAsFile();

      if (!image) return;

      event.preventDefault();
      showClipboardPreview(clipboardImageFile(image));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, showClipboardPreview, uploadMutation.isPending]);

  const pasteImage = async () => {
    setError('');
    setClipboardPreview(null);

    if (!navigator.clipboard?.read) {
      setError('Trình duyệt chưa cho phép đọc clipboard. Hãy nhấn Ctrl+V khi popup đang mở.');
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));

        if (!imageType) continue;

        const image = await item.getType(imageType);
        showClipboardPreview(clipboardImageFile(image));
        return;
      }

      setError('Clipboard chưa có ảnh. Hãy chụp hoặc sao chép ảnh rồi thử lại.');
    } catch {
      setError('Không thể đọc clipboard. Hãy nhấn Ctrl+V khi popup đang mở.');
    }
  };

  const closeLibrary = () => {
    setClipboardPreview(null);
    setError('');
    setOpen(false);
  };

  const selectedPreviewUrl = getMediaPreviewUrl(value);

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadImage(file);
        }}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative flex items-center justify-center overflow-hidden border border-dashed border-slate-300 bg-slate-50 p-2 transition hover:border-primary hover:bg-primary/5 ${
          shape === 'card' ? 'h-[126px] w-40 rounded-xl' : 'h-32 w-32 rounded-full'
        } ${previewClassName}`}
      >
        {selectedPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selectedPreviewUrl}
            alt={alt}
            className={`h-full w-full object-cover ${shape === 'card' ? 'rounded-lg' : 'rounded-full'}`}
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center bg-primary/10 text-primary ${
              shape === 'card' ? 'rounded-lg' : 'rounded-full'
            }`}
          >
            {fallbackText ? (
              <span className="text-4xl font-black">{fallbackText}</span>
            ) : (
              <AddPhotoAlternateRoundedIcon fontSize="large" />
            )}
          </span>
        )}

        <span
          className={`absolute inset-2 flex items-center justify-center bg-slate-950/55 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 ${
            shape === 'card' ? 'rounded-lg' : 'rounded-full'
          }`}
        >
          Chọn ảnh
        </span>

        {uploadMutation.isPending && (
          <span
            className={`absolute inset-0 flex items-center justify-center bg-white/80 ${
              shape === 'card' ? 'rounded-xl' : 'rounded-full'
            }`}
          >
            <CircularProgress size={28} />
          </span>
        )}
      </button>

      {value && (
        <IconButton
          size="small"
          className="!-mt-7 !ml-24 !bg-white !text-slate-500 shadow-sm hover:!text-red-600"
          onClick={() => onChange('')}
          title="Xóa ảnh"
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      )}

      {helperText && <p className="mt-5 text-xs leading-6 text-slate-500">{helperText}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <Dialog open={open} onClose={closeLibrary} maxWidth="md" fullWidth>
        <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-slate-950">Thư viện ảnh</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outlined"
              startIcon={<ContentPasteRoundedIcon />}
              onClick={() => void pasteImage()}
              disabled={uploadMutation.isPending}
            >
              Dán ảnh (Ctrl+V)
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadRoundedIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              Tải ảnh mới
            </Button>
          </div>
        </DialogTitle>

        <div className="border-t border-slate-100 px-6 py-4">
          {clipboardPreview && (
            <div className="mb-4 grid gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clipboardPreview.previewUrl}
                  alt="Ảnh vừa dán từ clipboard"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="flex min-w-0 flex-col justify-between gap-4 text-left">
                <div>
                  <p className="font-bold text-slate-900">Xem trước ảnh vừa dán</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Ảnh chưa được tải lên. Kiểm tra ảnh rồi nhấn Chọn ảnh để sử dụng.
                  </p>
                  <p className="mt-2 truncate text-xs font-semibold text-slate-500">
                    {clipboardPreview.file.name} · {formatFileSize(clipboardPreview.file.size)}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setClipboardPreview(null)}
                    disabled={uploadMutation.isPending}
                  >
                    Hủy ảnh
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckRoundedIcon />}
                    onClick={() => uploadImage(clipboardPreview.file)}
                    disabled={uploadMutation.isPending}
                  >
                    Chọn ảnh
                  </Button>
                </div>
              </div>
            </div>
          )}

          <TextField
            fullWidth
            size="small"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm ảnh..."
            slotProps={{
              input: {
                startAdornment: (
                  <SearchRoundedIcon className="mr-2 text-slate-400" fontSize="small" />
                ),
              },
            }}
          />
        </div>

        {(isFetching || uploadMutation.isPending) && <LinearProgress color="primary" />}

        <DialogContent dividers>
          {images.length === 0 && !isFetching ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center text-slate-500">
              <ImageRoundedIcon className="mb-3 text-5xl text-slate-300" />
              <p className="font-bold text-slate-700">Chưa có ảnh nào</p>
              <p className="mt-1 text-sm">Tải ảnh mới để dùng cho hồ sơ hoặc các màn khác.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => {
                const active = image.url === value;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => {
                      onChange(image.url, image);
                      closeLibrary();
                    }}
                    className={`group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-primary ${
                      active ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'
                    }`}
                  >
                    <span className="block aspect-square overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getMediaPreviewUrl(image.url) || image.previewUrl || ''}
                        alt={image.originalName || image.fileName}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </span>
                    <span className="block truncate px-3 py-2 text-xs font-semibold text-slate-600">
                      {image.originalName || image.fileName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
        </DialogContent>

        <TablePaginationBar
          page={page}
          totalPages={pagination.lastPage}
          totalItems={pagination.total}
          pageSize={pageSize}
          pageSizeOptions={[12, 24, 48]}
          pageSizeLabel="Số ảnh"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPage(1);
            setPageSize(nextPageSize);
          }}
        />

        <DialogActions className="px-6 py-4">
          <Button onClick={closeLibrary}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
