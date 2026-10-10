'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

function Thumbnail({
  file,
  index,
  blocked,
  onRemove,
}: {
  file: File;
  index: number;
  blocked: boolean;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return (
    <div className={styles.clipboardImage}>
      {url && <img src={url} alt={`Ảnh dán ${index + 1}`} />}
      <button
        type="button"
        disabled={blocked}
        aria-label={`Xóa ảnh dán ${index + 1}`}
        onClick={onRemove}
      >
        <Icon name="trashLine" size={16} />
      </button>
    </div>
  );
}

export function ClipboardImageTray({
  files,
  blocked,
  onRemove,
  onClear,
  onAdd,
}: {
  files: File[];
  blocked: boolean;
  onRemove: (index: number) => void;
  onClear: () => void;
  onAdd: () => void;
}) {
  if (!files.length) return null;
  return (
    <section className={styles.clipboardTray} aria-label="Ảnh dán chờ gửi">
      <div className={styles.clipboardTrayHeader}>
        <strong>{files.length} ảnh</strong>
        <button type="button" disabled={blocked} onClick={onClear}>
          Xóa tất cả
        </button>
      </div>
      <div className={styles.clipboardImages}>
        {files.map((file, index) => (
          <Thumbnail
            key={index}
            file={file}
            index={index}
            blocked={blocked}
            onRemove={() => onRemove(index)}
          />
        ))}
        <button
          type="button"
          className={styles.clipboardAdd}
          disabled={blocked}
          aria-label="Thêm ảnh vào khay"
          onClick={onAdd}
        >
          +
        </button>
      </div>
    </section>
  );
}
