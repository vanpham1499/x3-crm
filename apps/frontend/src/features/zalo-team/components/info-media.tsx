'use client';
import { useState } from 'react';
import { imageSources } from '../media-source';
import { Icon } from './icon';
import { FileIcon } from './file-icon';
import { fileSize, messageDay } from '../message-presentation';
import type { InfoMedia, InfoMediaSection } from '../types';
import styles from '../zalo-team.module.css';

export function MediaThumbnail({ item }: { item: InfoMedia }) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = (item.kind === 'image' ? imageSources(item) : [item.preview]).find(
    (url) => url && !failed.includes(url),
  );
  return source ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={source}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed((old) => [...old, source])}
    />
  ) : (
    <span className={styles.mediaUnavailable}>
      <Icon name={item.kind === 'video' ? 'video' : 'photo'} />
      <small>Không khả dụng</small>
    </span>
  );
}

function MediaRow({ item }: { item: InfoMedia }) {
  const fileName = item.name || 'Tệp đính kèm';
  const extensionAt = fileName.lastIndexOf('.');
  let domain = '';
  try {
    if (item.url) domain = new URL(item.url).hostname.replace(/^www\./, '');
  } catch {
    /* No display domain. */
  }
  return (
    <div className={styles.infoResourceRow} data-kind={item.kind}>
      <a
        className={styles.infoResourceMain}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!item.url}
        title={item.name || item.url}
      >
        <span className={styles.infoResourceThumb}>
          {item.kind === 'link' ? (
            <Icon name="link" size={16} />
          ) : (
            <FileIcon name={item.name} compact />
          )}
        </span>
        <span className={styles.infoResourceText}>
          <strong>
            {item.kind === 'link' ? (
              item.url || item.name
            ) : (
              <>
                <span>{extensionAt > 0 ? fileName.slice(0, extensionAt) : fileName}</span>
                {extensionAt > 0 && <span>{fileName.slice(extensionAt)}</span>}
              </>
            )}
          </strong>
          <span>
            <small>{item.kind === 'link' ? domain : fileSize(item.size) || 'Tệp đính kèm'}</small>
            <time>{item.time > 0 ? messageDay(item.time) : ''}</time>
          </span>
          {!item.url && <small>Tệp chưa có trong phiên này</small>}
        </span>
      </a>
      {item.url && (
        <div className={styles.infoResourceTools}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.kind === 'link' ? 'Mở liên kết' : 'Mở bản gốc'}
            aria-label={item.kind === 'link' ? 'Mở liên kết' : `Mở ${item.name || 'bản gốc'}`}
          >
            <Icon name={item.kind === 'link' ? 'openLink' : 'sidebarDownload'} size={16} />
          </a>
        </div>
      )}
    </div>
  );
}

export function InfoMediaItems({
  section,
  items,
  onPreview,
  library = false,
}: {
  section: InfoMediaSection;
  items: InfoMedia[];
  onPreview: (item: InfoMedia) => void;
  library?: boolean;
}) {
  const groups = library
    ? Array.from(
        items.reduce((map, item) => {
          const day = item.time > 0 ? messageDay(item.time) : 'Không có ngày';
          map.set(day, [...(map.get(day) || []), item]);
          return map;
        }, new Map<string, InfoMedia[]>()),
      )
    : [['', items] as const];
  return (
    <>
      {groups.map(([day, entries]) => (
        <section key={day} className={styles.mediaDayGroup}>
          {day && <h3>{day}</h3>}
          <div
            className={section === 'images' ? styles.infoMediaGrid : styles.infoMediaRows}
            data-library={library}
          >
            {entries.map((item) =>
              section === 'images' ? (
                <button
                  type="button"
                  key={item.id}
                  className={styles.infoMediaTile}
                  aria-label={item.kind === 'video' ? 'Xem video' : 'Xem ảnh lớn'}
                  onClick={() => onPreview(item)}
                >
                  <MediaThumbnail item={item} />
                  {item.kind === 'video' && <span className={styles.infoVideoMark}>▶</span>}
                </button>
              ) : (
                <MediaRow key={item.id} item={item} />
              ),
            )}
          </div>
        </section>
      ))}
    </>
  );
}
