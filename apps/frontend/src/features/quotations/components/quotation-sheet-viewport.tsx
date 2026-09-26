'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DialogActionButton } from '@/components/actions/dialog-action-button';

// One desktop paper size for the preview, clipboard image and PDF on every device.
const SHEET_WIDTH = 1040;

export const QuotationSheetViewport = forwardRef<HTMLElement, { children: ReactNode }>(
  function QuotationSheetViewport({ children }, forwardedRef) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const sheetRef = useRef<HTMLElement | null>(null);
    const [size, setSize] = useState({ viewportWidth: 0, sheetHeight: 0 });
    const [originalSize, setOriginalSize] = useState(false);

    const attachSheet = useCallback(
      (sheet: HTMLElement | null) => {
        sheetRef.current = sheet;
        if (typeof forwardedRef === 'function') forwardedRef(sheet);
        else if (forwardedRef) forwardedRef.current = sheet;
      },
      [forwardedRef],
    );

    const measure = useCallback(() => {
      const viewport = viewportRef.current;
      const sheet = sheetRef.current;
      if (!viewport || !sheet) return;

      // Layout dimensions exclude preview scaling and dialog transition transforms.
      const viewportWidth = viewport.clientWidth;
      const sheetHeight = Math.max(sheet.offsetHeight, sheet.scrollHeight);
      setSize((previous) =>
        previous.viewportWidth === viewportWidth && previous.sheetHeight === sheetHeight
          ? previous
          : { viewportWidth, sheetHeight },
      );
    }, []);

    useEffect(() => {
      measure();
      const viewport = viewportRef.current;
      const sheet = sheetRef.current;
      if (!viewport || !sheet) return;

      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
      }

      const observer = new ResizeObserver(measure);
      observer.observe(viewport);
      observer.observe(sheet);
      return () => observer.disconnect();
    }, [measure]);

    const canZoom = size.viewportWidth > 0 && size.viewportWidth < SHEET_WIDTH;
    const scale = originalSize ? 1 : Math.min(1, (size.viewportWidth || SHEET_WIDTH) / SHEET_WIDTH);

    return (
      <div className="mx-auto w-full min-w-0 max-w-[1040px]">
        {canZoom ? (
          <div className="mb-2 flex justify-end">
            <DialogActionButton onClick={() => setOriginalSize((current) => !current)}>
              {originalSize ? 'Vừa màn hình' : 'Xem 100%'}
            </DialogActionButton>
          </div>
        ) : null}

        <div
          ref={viewportRef}
          role="region"
          aria-label="Bản báo phí theo bố cục máy tính"
          tabIndex={canZoom && originalSize ? 0 : -1}
          className="w-full min-w-0 overflow-x-auto"
        >
          <div
            className="relative overflow-hidden"
            style={{
              width: SHEET_WIDTH * scale,
              height: size.sheetHeight ? Math.ceil(size.sheetHeight * scale) : undefined,
            }}
          >
            {/* Scale only the viewer, never the article used for image/PDF capture. */}
            <div
              className="origin-top-left"
              style={{ width: SHEET_WIDTH, transform: `scale(${scale})` }}
            >
              <article
                ref={attachSheet}
                onLoadCapture={measure}
                className="w-[1040px] max-w-none overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900"
                style={{ WebkitTextSizeAdjust: 'none', textSizeAdjust: 'none' }}
              >
                {children}
              </article>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
