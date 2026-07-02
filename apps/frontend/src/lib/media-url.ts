const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL;

function getMediaOrigin() {
  if (!MEDIA_URL && typeof window !== 'undefined') {
    return window.location.origin;
  }

  try {
    return new URL(MEDIA_URL || API_URL).origin;
  } catch {
    return '';
  }
}

export function getMediaPreviewUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value.startsWith('/uploads/')) {
    return `${getMediaOrigin()}${value}`;
  }

  return value;
}
