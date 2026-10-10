'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon, IconButton } from './icon';
import { imageSources } from '../media-source';
import { MediaThumbnail } from './info-media';
import { messageClock, messageDay } from '../message-presentation';
import type { InfoMedia } from '../types';
import styles from '../zalo-team.module.css';

// Shared by the message timeline and the conversation media library.
export function MediaViewer({
  items,
  initialId,
  onClose,
}: {
  items: InfoMedia[];
  initialId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selectedId, setSelectedId] = useState(initialId);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );
  const item = items[index];
  const source = item && imageSources(item, true).find((url) => !failed.includes(url));
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setFailed([]);
    setNotice('');
  }, [item?.id]);
  const move = (step: number) => {
    if (items[index + step]) setSelectedId(items[index + step].id);
  };
  if (!item) return null;
  return (
    <dialog
      ref={dialog}
      className={styles.mediaViewer}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).tagName === 'VIDEO') return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          move(-1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          move(1);
        }
      }}
    >
      <header className={styles.viewerHeader}>
        <span id={titleId}>{item.name || (item.kind === 'video' ? 'Video' : 'Ảnh')}</span>
        <small>
          {index + 1} / {items.length}
        </small>
        <IconButton icon="close" label="Đóng trình xem ảnh" onClick={onClose} />
      </header>
      <div className={styles.viewerBody}>
        <div
          className={styles.viewerStage}
          data-zoomed={zoom > 1}
          onWheel={(event) => {
            if (item.kind !== 'video')
              setZoom((value) =>
                Math.max(1, Math.min(4, value + (event.deltaY < 0 ? 0.25 : -0.25))),
              );
          }}
          onPointerDown={(event) => {
            if (
              zoom <= 1 ||
              item.kind === 'video' ||
              (event.target as HTMLElement).tagName === 'BUTTON'
            )
              return;
            drag.current = {
              x: event.clientX,
              y: event.clientY,
              originX: offset.x,
              originY: offset.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (d)
              setOffset({ x: d.originX + event.clientX - d.x, y: d.originY + event.clientY - d.y });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {item.kind === 'video' ? (
            item.url && !failed.includes(item.url) ? (
              <video
                key={item.id}
                src={item.url}
                poster={item.preview}
                controls
                preload="metadata"
                onError={() => setFailed((old) => [...old, item.url!])}
              />
            ) : (
              <p>Không tải được video từ Zalo.</p>
            )
          ) : source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt={item.name || 'Ảnh trong hội thoại'}
              draggable={false}
              referrerPolicy="no-referrer"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
              }}
              onDoubleClick={() => {
                setZoom(zoom === 1 ? 2 : 1);
                setOffset({ x: 0, y: 0 });
              }}
              onError={() => setFailed((old) => [...old, source])}
            />
          ) : (
            <p>Ảnh không còn khả dụng trong phiên Zalo này.</p>
          )}
        </div>
        <button
          className={`${styles.viewerNav} ${styles.viewerPrevious}`}
          aria-label="Ảnh trước"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <Icon name="back" />
        </button>
        <button
          className={`${styles.viewerNav} ${styles.viewerNext}`}
          aria-label="Ảnh tiếp theo"
          disabled={index === items.length - 1}
          onClick={() => move(1)}
        >
          <Icon name="next" />
        </button>
        {items.length > 1 && (
          <div className={styles.viewerThumbnails} aria-label="Ảnh trong hội thoại">
            {items.map((entry) => (
              <button
                key={entry.id}
                data-selected={entry.id === item.id}
                aria-label={`Xem ${entry.kind === 'video' ? 'video' : 'ảnh'} ${items.indexOf(entry) + 1}`}
                aria-pressed={entry.id === item.id}
                onClick={() => setSelectedId(entry.id)}
              >
                <MediaThumbnail item={entry} />
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className={styles.viewerFooter}>
        <div>
          {item.sender?.name && <strong>{item.sender.name}</strong>}
          {item.time > 0 && (
            <small>
              {messageClock(item.time)} {messageDay(item.time)}
            </small>
          )}
        </div>
        <div className={styles.viewerTools}>
          {item.kind !== 'video' && (
            <>
              <button
                aria-label="Thu nhỏ"
                title="Thu nhỏ"
                disabled={zoom === 1}
                onClick={() => {
                  setZoom(Math.max(1, zoom - 0.25));
                  setOffset({ x: 0, y: 0 });
                }}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <IconButton
                icon="zoomIn"
                label="Phóng to"
                onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              />
              <IconButton
                icon="zoomReset"
                label="Vừa màn hình"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setOffset({ x: 0, y: 0 });
                }}
              />
              <IconButton
                icon="rotate"
                label="Xoay ảnh"
                onClick={() => setRotation((r) => r + 90)}
              />
            </>
          )}
          {(item.url || item.archiveUrl) && (
            <a
              href={item.url && !failed.includes(item.url) ? item.url : item.archiveUrl || source}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở bản gốc"
              aria-label="Mở bản gốc"
            >
              <Icon name="download" />
            </a>
          )}
          <button
            aria-label="Toàn màn hình"
            title="Toàn màn hình"
            onClick={() => {
              const action = document.fullscreenElement
                ? document.exitFullscreen()
                : dialog.current?.requestFullscreen();
              action?.catch(() => setNotice('Trình duyệt không cho phép toàn màn hình.'));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zalo-team/fullscreen.svg" alt="" width={24} height={24} />
          </button>
        </div>
        <span role="status">
          {notice ||
            (source && source === item.preview && item.url && failed.includes(item.url)
              ? 'Đang hiển thị ảnh xem trước'
              : '')}
        </span>
      </footer>
    </dialog>
  );
}
