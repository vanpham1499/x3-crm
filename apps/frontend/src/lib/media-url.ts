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
  const mediaPath = value?.trim();

  if (!mediaPath) return '';
  if (
    /^https?:\/\//i.test(mediaPath) ||
    mediaPath.startsWith('data:') ||
    mediaPath.startsWith('blob:')
  ) {
    return mediaPath;
  }

  if (mediaPath.startsWith('/')) {
    return `${getMediaOrigin()}${mediaPath}`;
  }

  if (mediaPath.startsWith('uploads/') || mediaPath.startsWith('storage/')) {
    return `${getMediaOrigin()}/${mediaPath}`;
  }

  return mediaPath;
}
