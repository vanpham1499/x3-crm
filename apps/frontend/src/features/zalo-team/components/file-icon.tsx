import styles from '../zalo-team.module.css';

function artworkKind(extension: string) {
  if (/^(xlsx?|csv|ods)$/.test(extension)) return 'excel';
  if (/^(docx?|odt|rtf)$/.test(extension)) return 'word';
  if (/^(pptx?|odp)$/.test(extension)) return 'powerpoint';
  if (extension === 'pdf' || extension === 'txt') return extension;
  if (/^(zip|rar|7z|gz|tar)$/.test(extension)) return 'zip';
  if (/^(png|jpe?g|gif|webp|heic|bmp|svg|avif|tiff?|ico)$/.test(extension)) return 'photo';
  if (/^(mp4|mov|avi|webm|mkv|mpg|mpeg)$/.test(extension)) return 'video';
  if (/^(mp3|wav|m4a|ogg|aac|flac|opus|wma|aiff)$/.test(extension)) return 'music';
  return 'file-empty';
}

// One full-bleed SVG family for both timeline and library; never raster-scaled.
export function FileIcon({ name, compact = false }: { name: string; compact?: boolean }) {
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const kind = artworkKind(extension);
  return (
    <span
      className={styles.fileTypeIcon}
      data-compact={compact}
      data-file-type={extension || 'file'}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/zalo-team/files/web/icon-${kind}.svg`} alt="" />
      {kind === 'file-empty' && extension && <b>{extension.slice(0, 4).toUpperCase()}</b>}
    </span>
  );
}
