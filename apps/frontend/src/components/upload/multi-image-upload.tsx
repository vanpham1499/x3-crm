'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { IconButton } from '@mui/material';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ImageUpload } from '@/components/upload/image-upload';
import { getMediaPreviewUrl } from '@/lib/media-url';

type MultiImageUploadProps = {
  value: string[];
  onChange: (value: string[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  maxFiles?: number;
  disabled?: boolean;
  imageLabel?: string;
  captionLabel?: string;
  collectionLabel?: string;
  helperText?: string;
};

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLocaleLowerCase('vi-VN')}${value.slice(1)}` : value;
}

export function MultiImageUpload({
  value,
  onChange,
  onUploadingChange,
  maxFiles = 3,
  disabled = false,
  imageLabel = 'Ảnh CCCD',
  captionLabel = 'Ảnh',
  collectionLabel = 'hồ sơ CCCD',
  helperText,
}: MultiImageUploadProps) {
  const notify = useAppNotification();

  const addImage = (imageUrl: string) => {
    if (!imageUrl) return;

    if (value.includes(imageUrl)) {
      notify.error(`Ảnh này đã có trong ${collectionLabel}`);
      return;
    }

    if (value.length >= maxFiles) {
      notify.error(`Chỉ được chọn tối đa ${maxFiles} ${lowerFirst(imageLabel)}`);
      return;
    }

    onChange([...value, imageUrl]);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {value.map((imageUrl, index) => (
          <div
            key={`${imageUrl}-${index}`}
            className="group relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          >
            <a
              href={getMediaPreviewUrl(imageUrl) || imageUrl}
              target="_blank"
              rel="noreferrer"
              title={`Mở ${lowerFirst(imageLabel)} ${index + 1}`}
              className="block aspect-[1.586/1] overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getMediaPreviewUrl(imageUrl) || imageUrl}
                alt={`${imageLabel} ${index + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </a>

            {!disabled && (
              <IconButton
                type="button"
                size="small"
                title="Xóa ảnh khỏi hồ sơ"
                className="!absolute !right-1 !top-1 !bg-white/95 !text-slate-500 shadow hover:!text-rose-600"
                onClick={() => onChange(value.filter((_, imageIndex) => imageIndex !== index))}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            )}

            <span className="block truncate border-t border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600">
              {captionLabel} {index + 1}
            </span>
          </div>
        ))}

        {!disabled && value.length < maxFiles && (
          <ImageUpload
            value=""
            shape="card"
            helperText=""
            alt={`Chọn ${lowerFirst(imageLabel)}`}
            className="!w-full min-w-0"
            previewClassName="!w-full"
            onUploadingChange={onUploadingChange}
            onChange={(imageUrl) => addImage(imageUrl)}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {helperText ||
          `Chọn lại ảnh trong thư viện hoặc tải ảnh mới. Tối đa ${maxFiles} ${lowerFirst(imageLabel)}.`}
      </p>
    </div>
  );
}
