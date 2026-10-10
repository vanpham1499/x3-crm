import type { MessageAttachment } from './types';

const archivePrefix = '/api/zalo-team/archive/assets/';
const recentWindow = 15 * 24 * 60 * 60 * 1000;

/** Only fresh Web image URLs take precedence; backup status remains independent. */
export function mergeStoredMedia<T extends MessageAttachment>(
  live: T,
  saved: MessageAttachment,
  time: number,
  fromWeb = true,
  now = Date.now(),
): T {
  const archiveUrl = saved.url?.startsWith(archivePrefix) ? saved.url : saved.archiveUrl;
  const archivePreview = saved.preview?.startsWith(archivePrefix)
    ? saved.preview
    : saved.archivePreview;
  const recentImage =
    fromWeb && live.kind === 'image' && time > 0 && time <= now && now - time <= recentWindow;
  const webUrl = recentImage && /^https:\/\//.test(live.url || '') ? live.url : undefined;
  const webPreview =
    recentImage && /^https:\/\//.test(live.preview || '') ? live.preview : undefined;
  return {
    ...live,
    archiveState: saved.archiveState,
    archiveError: saved.archiveError,
    ...(recentImage && (webUrl || webPreview)
      ? { url: webUrl, preview: webPreview, archiveUrl, archivePreview }
      : {
          ...(archiveUrl ? { url: archiveUrl } : {}),
          ...(archivePreview ? { preview: archivePreview } : {}),
        }),
  };
}

export function imageSources(item: MessageAttachment, original = false): string[] {
  return [
    ...new Set(
      (original
        ? [item.url, item.preview, item.archiveUrl, item.archivePreview]
        : [item.preview, item.url, item.archivePreview, item.archiveUrl]
      ).filter((url): url is string => !!url),
    ),
  ];
}
