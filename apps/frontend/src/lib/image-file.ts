export const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function clipboardImageFile(blob: Blob) {
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1] || 'png';

  return new File([blob], `clipboard-${Date.now()}.${extension}`, { type: blob.type });
}

export function getImageValidationError(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Ảnh phải có định dạng JPG, PNG, GIF hoặc WEBP.';
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return 'Ảnh không được vượt quá 3MB.';
  }

  return '';
}

export function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024)).toLocaleString('vi-VN')} KB`;
}
