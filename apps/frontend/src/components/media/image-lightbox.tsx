'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import RotateLeftRoundedIcon from '@mui/icons-material/RotateLeftRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import { Dialog, DialogContent, IconButton, Tooltip } from '@mui/material';
import { getMediaPreviewUrl } from '@/lib/media-url';

export type ImageLightboxItem = {
  src: string;
  alt?: string;
  label?: string;
};

type ImageLightboxProps = {
  open: boolean;
  images: ImageLightboxItem[];
  initialIndex?: number;
  title?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function ImageLightbox({
  open,
  images,
  initialIndex = 0,
  title = 'Xem ảnh',
  actions,
  footer,
  onClose,
}: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    dragState.current = null;
  }, []);

  const showPrevious = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((current) => (current <= 0 ? images.length - 1 : current - 1));
  }, [images.length]);

  const showNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((current) => (current >= images.length - 1 ? 0 : current + 1));
  }, [images.length]);

  const zoomBy = useCallback((amount: number) => {
    setZoom((current) => clampZoom(current + amount));
  }, []);

  useEffect(() => {
    if (!open) return;

    setActiveIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
    resetView();
  }, [images.length, initialIndex, open, resetView]);

  useEffect(() => {
    if (!open) return;
    resetView();
  }, [activeIndex, open, resetView]);

  useEffect(() => {
    if (zoom <= 1) setOffset({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          showPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          showNext();
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomBy(ZOOM_STEP);
          break;
        case '-':
        case '_':
          event.preventDefault();
          zoomBy(-ZOOM_STEP);
          break;
        case '0':
          event.preventDefault();
          resetView();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, resetView, showNext, showPrevious, zoomBy]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setOffset({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const finishDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
    setIsDragging(false);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const activeImage = images[activeIndex];
  if (!activeImage) return null;

  const previewUrl = getMediaPreviewUrl(activeImage.src) || activeImage.src;
  const imageLabel = activeImage.label || activeImage.alt || `Ảnh ${activeIndex + 1}`;
  const iconButtonClassName =
    '!h-10 !w-10 !rounded-lg !text-slate-600 hover:!bg-slate-100 focus-visible:!ring-2 focus-visible:!ring-primary/30';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      aria-labelledby="image-lightbox-title"
      slotProps={{
        paper: {
          className:
            '!m-4 !h-[calc(100dvh-32px)] !max-h-[calc(100dvh-32px)] !max-w-[1440px] !overflow-hidden !rounded-xl',
        },
      }}
    >
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-5">
        <div className="min-w-0">
          <h2 id="image-lightbox-title" className="truncate text-base font-bold text-slate-950">
            {title}
          </h2>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
            {imageLabel}
            {images.length > 1 ? ` · ${activeIndex + 1}/${images.length}` : ''}
          </p>
        </div>

        <div className="flex max-w-full shrink-0 items-center gap-1 overflow-x-auto">
          {actions ? (
            <>
              <div className="flex shrink-0 items-center gap-2 px-1">{actions}</div>
              <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            </>
          ) : null}

          <Tooltip title="Thu nhỏ (-)">
            <span>
              <IconButton
                aria-label="Thu nhỏ ảnh"
                className={iconButtonClassName}
                disabled={zoom <= MIN_ZOOM}
                onClick={() => zoomBy(-ZOOM_STEP)}
              >
                <ZoomOutRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>

          <button
            type="button"
            title="Đặt lại kích thước (0)"
            aria-label={`Mức phóng đại ${Math.round(zoom * 100)}%. Nhấn để đặt lại`}
            className="h-10 min-w-16 rounded-lg px-2 text-xs font-bold tabular-nums text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={resetView}
          >
            {Math.round(zoom * 100)}%
          </button>

          <Tooltip title="Phóng to (+)">
            <span>
              <IconButton
                aria-label="Phóng to ảnh"
                className={iconButtonClassName}
                disabled={zoom >= MAX_ZOOM}
                onClick={() => zoomBy(ZOOM_STEP)}
              >
                <ZoomInRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>

          <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />

          <Tooltip title="Xoay trái">
            <IconButton
              aria-label="Xoay ảnh sang trái"
              className={iconButtonClassName}
              onClick={() => setRotation((current) => current - 90)}
            >
              <RotateLeftRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Xoay phải">
            <IconButton
              aria-label="Xoay ảnh sang phải"
              className={iconButtonClassName}
              onClick={() => setRotation((current) => current + 90)}
            >
              <RotateRightRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Đặt lại (0)">
            <IconButton
              aria-label="Đặt lại ảnh"
              className={iconButtonClassName}
              onClick={resetView}
            >
              <RestartAltRoundedIcon />
            </IconButton>
          </Tooltip>

          <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />

          <Tooltip title="Đóng">
            <IconButton
              aria-label="Đóng trình xem ảnh"
              className={iconButtonClassName}
              onClick={onClose}
            >
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <DialogContent className="relative !flex !min-h-0 !flex-1 !overflow-hidden !bg-slate-950 !p-0">
        <div
          role="region"
          aria-label="Khu vực xem ảnh"
          className={`relative flex h-full w-full touch-none select-none items-center justify-center overflow-hidden ${
            zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
          }`}
          onDoubleClick={() => (zoom === 1 ? zoomBy(1) : resetView())}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
          onWheel={handleWheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={activeImage.alt || imageLabel}
            draggable={false}
            className={`max-h-full max-w-full object-contain will-change-transform motion-reduce:transition-none ${
              isDragging ? '' : 'transition-transform duration-200 ease-out'
            }`}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />

          {images.length > 1 ? (
            <>
              <IconButton
                aria-label="Xem ảnh trước"
                title="Ảnh trước"
                className="!absolute !left-3 !top-1/2 !h-12 !w-12 !-translate-y-1/2 !bg-white/90 !text-slate-800 shadow-lg backdrop-blur hover:!bg-white focus-visible:!ring-2 focus-visible:!ring-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevious();
                }}
              >
                <ChevronLeftRoundedIcon className="!text-3xl" />
              </IconButton>
              <IconButton
                aria-label="Xem ảnh tiếp theo"
                title="Ảnh tiếp theo"
                className="!absolute !right-3 !top-1/2 !h-12 !w-12 !-translate-y-1/2 !bg-white/90 !text-slate-800 shadow-lg backdrop-blur hover:!bg-white focus-visible:!ring-2 focus-visible:!ring-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
              >
                <ChevronRightRoundedIcon className="!text-3xl" />
              </IconButton>
            </>
          ) : null}

          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900/75 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            Cuộn để zoom · Kéo ảnh khi đã phóng to · Nhấp đúp để phóng to/đặt lại
          </p>
        </div>
      </DialogContent>

      {footer ? (
        <footer className="shrink-0 border-t border-slate-200 bg-white p-4">{footer}</footer>
      ) : null}
    </Dialog>
  );
}
