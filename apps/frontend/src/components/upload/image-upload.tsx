'use client';

import { useRef, useState } from 'react';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import { getMediaPreviewUrl } from '@/lib/media-url';
import api from '@/services/api/client';
import type { MediaItem } from '@/types/media';

export type UploadedImage = MediaItem;

type ImageUploadProps = {
  value?: string;
  alt?: string;
  helperText?: string;
  className?: string;
  previewClassName?: string;
  fallbackText?: string;
  onChange: (url: string, image?: UploadedImage) => void;
};

export function ImageUpload({
  value,
  alt = 'Ảnh upload',
  helperText = 'Hỗ trợ *.jpeg, *.jpg, *.png, *.gif, *.webp, tối đa 3MB',
  className = '',
  previewClassName = '',
  fallbackText,
  onChange,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notify = useAppNotification();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');

  const { data: images = [], isFetching } = useQuery<MediaItem[]>({
    queryKey: ['media', 'images', keyword],
    queryFn: () =>
      api
        .get('/media', {
          params: {
            scope: 'mine',
            keyword: keyword || undefined,
          },
        })
        .then((response) => response.data),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      return api.post<MediaItem>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['media', 'images'] });
      onChange(response.data.url, response.data);
      notify.success('Upload ảnh thành công');
      setError('');
      setOpen(false);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Upload ảnh thất bại'));
    },
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  const uploadImage = (file: File) => {
    setError('');
    uploadMutation.mutate(file);
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
        className={`group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-slate-50 p-2 transition hover:border-primary hover:bg-primary/5 ${previewClassName}`}
      >
        {selectedPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selectedPreviewUrl} alt={alt} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary">
            {fallbackText ? (
              <span className="text-4xl font-black">{fallbackText}</span>
            ) : (
              <AddPhotoAlternateRoundedIcon fontSize="large" />
            )}
          </span>
        )}

        <span className="absolute inset-2 flex items-center justify-center rounded-full bg-slate-950/55 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
          Chọn ảnh
        </span>

        {uploadMutation.isPending && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/80">
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

      <p className="mt-5 text-xs leading-6 text-slate-500">{helperText}</p>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-bold text-slate-950">Thư viện ảnh</span>
          <Button
            variant="contained"
            startIcon={<CloudUploadRoundedIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            Tải ảnh mới
          </Button>
        </DialogTitle>

        <div className="border-t border-slate-100 px-6 py-4">
          <TextField
            fullWidth
            size="small"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm ảnh..."
            slotProps={{
              input: {
                startAdornment: <SearchRoundedIcon className="mr-2 text-slate-400" fontSize="small" />,
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
                      setError('');
                      setOpen(false);
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

        <DialogActions className="px-6 py-4">
          <Button onClick={() => setOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
