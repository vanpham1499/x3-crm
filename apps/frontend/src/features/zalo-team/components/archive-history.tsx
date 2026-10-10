'use client';
import { useEffect, useRef, useState } from 'react';
import { archiveRequest, type ArchiveHistory } from '../archive';
import type { ChatMessage } from '../types';
import { TeamDialog } from './dialog';
import { SearchInput } from './primitives';
import { MessageItem } from './message-item';
import { MediaViewer } from './media-viewer';
import styles from '../archive.module.css';
import { ArchiveButton } from './archive-button';

export function ArchiveHistoryDialog({
  source,
  accountId,
  conversationId,
  name,
  date,
  onClose,
}: {
  source?: string;
  accountId?: number;
  conversationId?: string;
  name: string;
  date?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<ArchiveHistory['cursor']>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  async function load(before?: ArchiveHistory['cursor']) {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setLoading(true);
    setError('');
    if (!before) {
      setMessages([]);
      setCursor(null);
    }
    try {
      const r = await archiveRequest<ArchiveHistory>(
        {
          kind: 'history',
          source,
          accountId,
          conversationId,
          query,
          date,
          ...(before ? { before } : {}),
        },
        abort.signal,
      );
      if (abort.signal.aborted) return;
      setMessages((old) => (before ? [...r.messages, ...old] : r.messages));
      setCursor(r.cursor);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : 'Chưa đọc được lịch sử.');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [source, accountId, conversationId, date]);
  const media = messages.flatMap((m) =>
    m.attachments
      .filter((a) => ['image', 'video', 'sticker'].includes(a.kind))
      .map((a, i) => ({ ...a, id: m.id + ':' + i, messageId: m.id, time: m.time })),
  );
  return (
    <TeamDialog
      title={'Lịch sử đã lưu · ' + name + (date ? ' · ' + date.split('-').reverse().join('/') : '')}
      onClose={onClose}
      className={styles.historyDialog}
    >
      <div className={styles.history}>
        <form
          className={styles.search}
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <SearchInput
            label="Tìm trong dữ liệu đã lưu"
            value={query}
            onValueChange={setQuery}
            placeholder="Tìm trong dữ liệu đã lưu"
          />
          <ArchiveButton type="submit">Tìm</ArchiveButton>
        </form>
        <p className={styles.hint}>Lịch sử đã lưu · Chỉ đọc</p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.timeline}>
          {cursor && (
            <ArchiveButton disabled={loading} onClick={() => void load(cursor)}>
              Tải tin cũ hơn
            </ArchiveButton>
          )}
          {loading && <p role="status">Đang đọc dữ liệu…</p>}
          {!loading && !messages.length && !error && <p>Chưa có tin nhắn phù hợp trong kho lưu.</p>}
          {messages.map((m, i) => (
            <MessageItem
              key={m.id}
              message={m}
              conversation={{ id: source || '', name, preview: '', time: '', color: '' }}
              first={i === 0 || messages[i - 1].sender.id !== m.sender.id}
              last
              latest={false}
              onPreview={setPreview}
            />
          ))}
        </div>
      </div>
      {preview && (
        <MediaViewer
          items={media}
          initialId={media.find((a) => a.url === preview || a.preview === preview)?.id || ''}
          onClose={() => setPreview(null)}
        />
      )}
    </TeamDialog>
  );
}
