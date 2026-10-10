'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { filterMembers, mentionQuery, type Mention, type MentionMember } from '../mentions';
import styles from '../zalo-team.module.css';
import { Icon } from './icon';

const cache = new Map<string, { time: number; members: MentionMember[] }>();
export function useMentionPicker({
  accountId,
  conversationId,
  value,
  mentions,
  caret,
  blocked,
  onSelect,
}: {
  accountId?: number;
  conversationId?: string;
  value: string;
  mentions: Mention[];
  caret: { start: number; end: number } | null;
  blocked: boolean;
  onSelect: (member: MentionMember, range: { pos: number; len: number }) => boolean;
}) {
  const key = `${accountId}:${conversationId}`;
  const id = useId();
  const signature = `${key}:${value}:${caret?.start}:${caret?.end}`;
  const [dismissed, setDismissed] = useState('');
  const range =
    !blocked && accountId && conversationId?.startsWith('g') && caret && caret.start === caret.end
      ? mentionQuery(value, caret.start, mentions)
      : null;
  const active = !!range && dismissed !== signature;
  const [catalog, setCatalog] = useState<{ key: string; members: MentionMember[] }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setDismissed(''), [signature]);
  useEffect(() => {
    if (!active) return;
    const saved = cache.get(key);
    if (saved && Date.now() - saved.time < 30000) {
      setCatalog({ key, members: saved.members });
      setError('');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void teamFetch('/api/zalo-team/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mentions', accountId, conversationId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          data.error ||
          data.accountId !== accountId ||
          data.conversationId !== conversationId ||
          !Array.isArray(data.members)
        )
          throw Error();
        if (controller.signal.aborted) return;
        cache.set(key, { time: Date.now(), members: data.members });
        if (cache.size > 100) cache.delete(cache.keys().next().value!);
        setCatalog({ key, members: data.members });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Chưa tải được thành viên.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, key, accountId, conversationId, retry]);
  const rows =
    range && catalog?.key === key ? filterMembers(catalog.members, range.query, mentions) : [];
  useEffect(() => setIndex(0), [signature, catalog]);
  const current = Math.min(index, Math.max(0, rows.length - 1));
  useEffect(() => {
    root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  const select = (member: MentionMember) => {
    if (range && onSelect(member, range)) setDismissed(signature);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDismissed(signature);
      return true;
    }
    if (
      !event.shiftKey &&
      ['ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key) &&
      (rows.length || loading || error)
    ) {
      event.preventDefault();
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (rows[current] && !loading && !error) select(rows[current]);
      } else if (rows.length)
        setIndex((current + (event.key === 'ArrowUp' ? -1 : 1) + rows.length) % rows.length);
      return true;
    }
    return false;
  };
  const popup = active ? (
    <div ref={root} className={styles.mentionPopup} onMouseDown={(e) => e.preventDefault()}>
      {hint && (
        <div className={styles.mentionHint}>
          <span aria-hidden="true" className={styles.mentionBulb}>
            <Icon name="lightbulb" size={24} />
          </span>
          <span>Dùng ↑ ↓ để chọn và Enter để nhắc tên.</span>
          <button type="button" aria-label="Ẩn hướng dẫn nhắc tên" onClick={() => setHint(false)}>
            ×
          </button>
        </div>
      )}
      <div className={styles.mentionList} role="listbox" aria-label="Nhắc thành viên" id={id}>
        {loading ? (
          <div className={styles.mentionNotice}>Đang tải thành viên…</div>
        ) : error ? (
          <div className={styles.mentionNotice}>
            {error}{' '}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Thử lại
            </button>
          </div>
        ) : !rows.length ? (
          <div className={styles.mentionNotice}>Không tìm thấy thành viên</div>
        ) : (
          rows.map((m, i) => (
            <button
              type="button"
              key={m.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === current}
              className={styles.mentionRow}
              onMouseEnter={() => setIndex(i)}
              onClick={() => select(m)}
            >
              {m.all ? (
                <img src="/zalo-team/mention.svg" alt="" />
              ) : m.avatarSrc ? (
                <img src={m.avatarSrc} alt="" />
              ) : (
                <span className={styles.mentionAvatar}>{m.name.slice(0, 1)}</span>
              )}
              <span className={styles.mentionName}>{m.all ? 'Báo cho cả nhóm' : m.name}</span>
              {m.all && <span className={styles.mentionCommand}>· @All</span>}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;
  return {
    popup,
    keyDown,
    listId: active ? id : undefined,
    activeId: active && rows[current] ? `${id}-${current}` : undefined,
  };
}
