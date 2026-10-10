'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { MessageAttachment } from '../types';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

export function documentKind(name: string) {
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.(txt|md)$/i.test(name)) return 'text';
  return null;
}

// Stop reading once the preview budget is reached, even if the CDN ignores Range.
async function readFile(url: string, limit: number, signal: AbortSignal, partial = false) {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok || !response.body) throw new Error('Không tải được tệp từ Zalo');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const remaining = limit - length;
      if (value.length > remaining && !partial) throw new Error('Tệp quá lớn để xem trước');
      const chunk = value.subarray(0, remaining);
      chunks.push(chunk);
      length += chunk.length;
      if (partial && length >= limit) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function useVisible(once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin: '100px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once]);
  return { ref, visible };
}

function TextPreview({
  url,
  expanded = false,
  markdown = false,
}: {
  url: string;
  expanded?: boolean;
  markdown?: boolean;
}) {
  const { ref, visible } = useVisible();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [tokens, setTokens] = useState<{ text: string; style: string }[]>([]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    setLoaded(false);
    setText('');
    setError('');
    setTokens([]);
    // Native 4VTe reads the first 1024 bytes for the collapsed text preview.
    readFile(url, expanded ? 1024 * 1024 : 1024, controller.signal, !expanded)
      .then(async (bytes) => {
        if (!active) return;
        const content = new TextDecoder('utf-8').decode(bytes);
        setText(content);
        if (markdown) {
          const cm = await import('codemirror');
          await import('codemirror/addon/runmode/runmode');
          await import('codemirror/mode/markdown/markdown');
          const highlighted: { text: string; style: string }[] = [];
          cm.default.runMode(content, 'markdown', (text, style) =>
            highlighted.push({ text, style: style || '' }),
          );
          if (!active) return;
          setTokens(highlighted);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (active) setError('Không tải được bản xem trước. Bạn có thể tải tệp gốc.');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [url, visible, expanded, markdown]);
  return (
    <div
      ref={ref}
      className={expanded ? styles.documentText : styles.textFilePreview}
      data-preview-ready={loaded}
    >
      {error ? (
        <span className={styles.filePreviewStatus}>{error}</span>
      ) : loaded ? (
        <pre>
          {tokens.length
            ? tokens.map((token, i) => (
                <span key={i} data-token={token.style}>
                  {token.text}
                </span>
              ))
            : text}
        </pre>
      ) : (
        <span className={styles.filePreviewStatus}>Đang tải xem trước…</span>
      )}
    </div>
  );
}

function PdfPreview({ url, expanded = false }: { url: string; expanded?: boolean }) {
  const { ref, visible } = useVisible();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    let active = true;
    let task: { destroy: () => Promise<void> } | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    setPdf(null);
    setError('');
    setReady(false);
    setPage(1);
    (async () => {
      const engine = await import('pdfjs-dist');
      if (!active) return;
      engine.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      const data = await readFile(url, 25 * 1024 * 1024, controller.signal);
      if (!active) return;
      const loading = engine.getDocument({ data, useSystemFonts: true });
      task = loading;
      const document = await loading.promise;
      if (active) setPdf(document);
    })()
      .catch(() => {
        if (active) setError('Không tải được bản xem trước PDF. Bạn có thể tải tệp gốc.');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      void task?.destroy();
    };
  }, [url, visible]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let render: { cancel: () => void } | undefined;
    setReady(false);
    (async () => {
      const source = await pdf.getPage(page);
      if (!active || !canvas.current) return;
      const natural = source.getViewport({ scale: 1 });
      const width = Math.max(100, ref.current?.clientWidth || 374);
      const scale = Math.min((width - (expanded ? 32 : 0)) / natural.width, 2);
      const viewport = source.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const target = canvas.current;
      target.width = Math.ceil(viewport.width * ratio);
      target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      const rendering = source.render({
        canvas: target,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      render = rendering;
      await rendering.promise;
      if (active) {
        setReady(true);
        // A collapsed card keeps only its canvas, not a worker/document per PDF.
        if (!expanded) {
          await pdf.loadingTask.destroy();
          if (active) setPdf(null);
        }
      }
    })().catch((reason) => {
      if (active && reason?.name !== 'RenderingCancelledException')
        setError('Không đọc được trang PDF này.');
    });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, expanded, ref]);
  return (
    <div
      ref={ref}
      className={expanded ? styles.documentPdf : styles.pdfFilePreview}
      data-preview-ready={ready}
    >
      {error ? (
        <span className={styles.filePreviewStatus}>{error}</span>
      ) : (
        <>
          {!ready && <span className={styles.filePreviewStatus}>Đang tải xem trước…</span>}
          <canvas
            ref={canvas}
            aria-label={`Trang ${page} của tài liệu PDF`}
            style={{ visibility: ready ? 'visible' : 'hidden' }}
          />
          {expanded && pdf && (
            <div className={styles.pdfPagination}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Trang trước
              </button>
              <span>
                {page} / {pdf.numPages}
              </span>
              <button disabled={page >= pdf.numPages} onClick={() => setPage(page + 1)}>
                Trang sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FileDocumentPreview({
  item,
  expanded = false,
}: {
  item: MessageAttachment;
  expanded?: boolean;
}) {
  if (!item.url) return null;
  return documentKind(item.name) === 'pdf' ? (
    <PdfPreview url={item.url} expanded={expanded} />
  ) : (
    <TextPreview url={item.url} expanded={expanded} markdown={/\.md$/i.test(item.name)} />
  );
}

export function FileDocumentDialog({
  item,
  onClose,
}: {
  item: MessageAttachment;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.documentDialog}
      aria-label={`Xem tệp ${item.name}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <strong title={item.name}>{item.name}</strong>
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          Tải về
        </a>
        <button onClick={onClose} aria-label="Đóng xem tệp">
          <Icon name="close" size={20} />
        </button>
      </header>
      <FileDocumentPreview item={item} expanded />
    </dialog>
  );
}

export function FileVideo({ item }: { item: MessageAttachment }) {
  const { ref, visible } = useVisible(false);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState('');
  const [duration, setDuration] = useState(0);
  const [source, setSource] = useState('');
  useEffect(() => {
    if (!visible || !item.url) {
      setSource('');
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let active = true;
    let objectUrl = '';
    setFailed('');
    setSource('');
    setStarted(false);
    setPlaying(false);
    // Native file-video resolves the downloaded file before handing it to the player.
    // Fetch without Referer, then give the player a typed local object URL.
    readFile(item.url, 25 * 1024 * 1024, controller.signal)
      .then((bytes) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: /\.webm$/i.test(item.name) ? 'video/webm' : 'video/mp4' }),
        );
        setSource(objectUrl);
      })
      .catch((error) => {
        if (active) setFailed(error.message);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, item.url, item.name]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.current?.pause();
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return (
    <div ref={ref} className={styles.fileVideoPreview}>
      <video
        ref={video}
        src={source || undefined}
        poster={item.preview}
        crossOrigin="anonymous"
        playsInline
        preload={visible ? 'metadata' : 'none'}
        controls={started}
        aria-label={`Video ${item.name}`}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setFailed('');
        }}
        onPlay={(event) => {
          document.querySelectorAll('video').forEach((other) => {
            if (other !== event.currentTarget) other.pause();
          });
          setPlaying(true);
          setStarted(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setStarted(false);
        }}
        onError={(event) => setFailed(event.currentTarget.error?.message || 'MEDIA_ERROR')}
      />
      {!source && !failed && <span className={styles.filePreviewStatus}>Đang tải video…</span>}
      {source && !playing && !failed && (
        <button
          className={styles.fileVideoPlay}
          aria-label={`Phát video ${item.name}`}
          onClick={() => {
            void video.current?.play().catch((error) => {
              if (error.name !== 'AbortError') setFailed(error.message);
            });
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M8 4v16l13-8z" fill="currentColor" />
          </svg>
        </button>
      )}
      {!started && duration > 0 && (
        <span className={styles.fileVideoDuration}>
          {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
        </span>
      )}
      {failed && (
        <span className={styles.filePreviewStatus} title={failed}>
          Không phát được video. Bạn có thể tải tệp gốc.
        </span>
      )}
    </div>
  );
}
