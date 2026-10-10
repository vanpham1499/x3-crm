'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { readConversationInfo } from '../info-api';
import { searchExcerpt, mergeSearchPages } from '../message-search';
import { archiveRequest } from '../archive';
import { TeamSelect } from './team-select';
import type { Conversation } from '../types';
import type { SearchHit, SearchPage } from '../message-search';
import styles from '../zalo-team.module.css';

export function ConversationSearch({
  conversation,
  onClose,
  onSelect,
}: {
  conversation: Conversation;
  onClose: () => void;
  onSelect: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [sender, setSender] = useState('all');
  const [days, setDays] = useState('0');
  const hasSearch = Boolean(query.trim() || sender !== 'all' || days !== '0');
  const [page, setPage] = useState<SearchPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string; avatarSrc?: string }[]>([]);
  useEffect(() => {
    if (!conversation.group) return;
    const controller = new AbortController();
    void (async () => {
      let cursor: string | null | undefined;
      do {
        const data = await readConversationInfo(conversation, controller.signal, 'members', cursor);
        if (controller.signal.aborted) return;
        setMembers((old) => [
          ...new Map(
            [...old, ...data.metadata.members.filter((m) => !m.self)].map((m) => [m.id, m]),
          ).values(),
        ]);
        const next = data.metadata.memberCursor;
        if (next === cursor) break;
        cursor = next;
      } while (cursor);
    })().catch(() => {});
    return () => controller.abort();
  }, [conversation.accountId, conversation.conversationId]);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = async (before?: SearchPage['cursor']) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    try {
      const storedSearch = () =>
        archiveRequest<SearchPage>(
          {
            kind: 'search-messages',
            accountId: conversation.accountId,
            conversationId: conversation.conversationId,
            query: query.trim(),
            sender,
            days: Number(days),
            ...(before ? { before } : {}),
          },
          controller.signal,
        );
      const readLive = async () => {
        const response = await teamFetch('/api/zalo-team/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
          body: JSON.stringify({
            action: 'message-search',
            accountId: conversation.accountId,
            conversationId: conversation.conversationId,
            search: {
              query: query.trim(),
              sender,
              days: Number(days),
              ...(before ? { before } : {}),
            },
          }),
        });
        const result: SearchPage & { error?: string } = await response.json();
        if (!response.ok) throw Error(result.error);
        return result;
      };
      const result =
        conversation.hasArchive || conversation.archiveOnly
          ? await Promise.all([
              storedSearch(),
              conversation.archiveOnly
                ? Promise.resolve(null)
                : readLive().catch((error) => {
                    if (error instanceof Error && error.message === 'WEB_IDENTITY_MISMATCH')
                      throw error;
                    return null;
                  }),
            ]).then(([stored, live]) => mergeSearchPages(stored, live))
          : await readLive();
      if (
        result.accountId !== conversation.accountId ||
        result.conversationId !== conversation.conversationId ||
        !Array.isArray(result.items)
      )
        throw Error('WEB_IDENTITY_MISMATCH');
      if (!controller.signal.aborted)
        setPage((old) => ({
          ...result,
          items:
            before && old
              ? [
                  ...new Map(
                    [...old.items, ...result.items].map((item) => [item.id, item]),
                  ).values(),
                ]
              : result.items,
        }));
    } catch {
      if (!controller.signal.aborted) setError('Chưa tìm được tin nhắn. Vui lòng thử lại.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    abort.current?.abort();
    setPage(null);
    setError('');
    setSelected('');
    setBusy(hasSearch);
    const timer = hasSearch ? setTimeout(() => void request(), 350) : undefined;
    return () => {
      clearTimeout(timer);
      abort.current?.abort();
    };
  }, [
    query,
    sender,
    days,
    retry,
    conversation.accountId,
    conversation.conversationId,
    conversation.hasArchive,
  ]);
  return (
    <aside
      className={`${styles.info} ${styles.messageSearch}`}
      aria-label="Tìm kiếm trong trò chuyện"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.searchPanelHeader}>
        <strong>Tìm kiếm trong trò chuyện</strong>
        <button
          type="button"
          className={styles.searchPanelClose}
          aria-label="Đóng tìm kiếm"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </header>
      <div className={styles.searchPanelControls}>
        <div className={styles.searchPanelInput}>
          <Icon name="search" size={18} />
          <input
            ref={input}
            aria-label="Tìm tin nhắn trong cuộc trò chuyện"
            placeholder="Nhập từ khóa để tìm kiếm"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className={styles.searchPanelClear}
              aria-label="Xóa từ khóa tìm tin nhắn"
              onClick={() => {
                setQuery('');
                input.current?.focus();
              }}
            >
              Xóa
            </button>
          )}
        </div>
        <div className={styles.searchPanelFilters}>
          <span>Lọc theo:</span>
          <TeamSelect
            aria-label="Người gửi"
            appearance="chip"
            leadingIcon={<Icon name="member" size={14} />}
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            options={[
              { value: 'all', label: 'Người gửi' },
              { value: 'me', label: 'Bạn' },
              {
                value: 'others',
                label: conversation.group ? 'Thành viên khác' : conversation.name,
              },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <TeamSelect
            aria-label="Ngày gửi"
            appearance="chip"
            leadingIcon={
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 3.5h10v10H3zM5 1.5v4m6-4v4M3 6.5h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            }
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: '0', label: 'Ngày gửi' },
              { value: '7', label: '7 ngày qua' },
              { value: '30', label: '30 ngày qua' },
              { value: '90', label: '90 ngày qua' },
            ]}
          />
        </div>
      </div>
      <div className={styles.searchPanelResults} aria-busy={busy}>
        <p className={styles.searchPanelStatus} role="status">
          {!hasSearch
            ? 'Nhập từ khóa để tìm tin nhắn và file trong trò chuyện.'
            : busy && !page
              ? 'Đang tìm kiếm…'
              : page
                ? `Tin nhắn (${page.items.length}${page.cursor ? '+' : ''})`
                : ''}
        </p>
        {page?.items.map((hit) => (
          <button
            key={hit.id}
            className={styles.searchResult}
            aria-pressed={selected === hit.id}
            onClick={() => {
              setSelected(hit.id);
              onSelect(hit);
            }}
          >
            <span className={styles.searchResultAvatar}>
              <Avatar
                size={40}
                conversation={{
                  name: hit.sender.name,
                  color: '#d8e3f0',
                  avatarSrc:
                    hit.sender.name === 'Bạn'
                      ? conversation.accountAvatarSrc
                      : conversation.group
                        ? members.find((m) => m.id === hit.sender.id)?.avatarSrc
                        : conversation.avatarSrc,
                }}
              />
            </span>
            <span className={styles.searchResultSender}>{hit.sender.name}</span>
            <time
              className={styles.searchResultTime}
              title={new Date(hit.time).toLocaleString('vi-VN')}
            >
              {resultTime(hit.time)}
            </time>
            <span className={styles.searchResultText}>
              {hit.kind === 'file' && <Icon name="documents" size={16} />}
              <span>
                <SearchExcerpt text={hit.text} query={query} />
              </span>
            </span>
          </button>
        ))}
        {error ? (
          <p className={styles.searchPanelStatus} role="alert">
            {error}{' '}
            <button
              onClick={() => (page?.cursor ? void request(page.cursor) : setRetry((n) => n + 1))}
            >
              Thử lại
            </button>
          </p>
        ) : (
          page?.cursor && (
            <button
              className={styles.searchLoadMore}
              disabled={busy}
              onClick={() => void request(page.cursor)}
            >
              {busy ? 'Đang tải…' : 'Xem thêm kết quả'}
            </button>
          )
        )}
        {page && !page.items.length && (
          <p className={styles.searchPanelStatus}>
            Không có kết quả phù hợp. Thử từ khóa hoặc bộ lọc khác.
          </p>
        )}
        {page && (
          <p className={styles.searchPanelFootnote}>Tìm trong lịch sử hiện có của Zalo Web.</p>
        )}
      </div>
    </aside>
  );
}

function SearchExcerpt({ text, query }: { text: string; query: string }) {
  const part = searchExcerpt(text, query);
  return (
    <>
      {part.before}
      {part.match && <mark>{part.match}</mark>}
      {part.after}
    </>
  );
}

function resultTime(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return minutes + ' phút';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' giờ';
  return new Date(time).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    ...(new Date(time).getFullYear() !== new Date().getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  });
}
