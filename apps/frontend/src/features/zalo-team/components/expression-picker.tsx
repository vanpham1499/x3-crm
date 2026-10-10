'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { registerEmojiArtwork } from '../emoji-artwork';
import { StickerArtwork } from './sticker-artwork';
import type { EmojiChoice, ExpressionCatalog, StickerChoice } from '../types';
import styles from '../zalo-team.module.css';

export type ExpressionTab = 'sticker' | 'emoji';
const emojiRecent = new Map<number, EmojiChoice[]>();

async function readCatalog(
  accountId: number,
  conversationId: string,
  signal: AbortSignal,
  options: { categoryId?: number; query?: string } = {},
) {
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'expressions', accountId, conversationId, ...options }),
    signal,
  });
  const data = await response.json();
  if (!response.ok || data.error) throw Error(data.error || 'WEB_EXPRESSIONS_UNAVAILABLE');
  if (data.accountId !== accountId || data.conversationId !== conversationId)
    throw Error('WEB_IDENTITY_MISMATCH');
  return data as ExpressionCatalog;
}

/** One native catalog and popup for both composer entry points. No auth in the browser. */
export function ExpressionPicker({
  accountId,
  conversationId,
  tab,
  onTabChange,
  blocked,
  onEmoji,
  onSticker,
  onClose,
  emojiOnly = false,
}: {
  accountId: number;
  conversationId: string;
  tab: ExpressionTab;
  onTabChange: (tab: ExpressionTab) => void;
  blocked: boolean;
  onEmoji: (emoji: EmojiChoice) => boolean;
  onSticker: (sticker: StickerChoice) => void;
  onClose: () => void;
  emojiOnly?: boolean;
}) {
  const [catalog, setCatalog] = useState<ExpressionCatalog>();
  const [pack, setPack] = useState<number | null>(null);
  const [group, setGroup] = useState('0');
  const [query, setQuery] = useState('');
  const [stickers, setStickers] = useState<StickerChoice[]>([]);
  const [recent, setRecent] = useState<EmojiChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const categories = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void readCatalog(accountId, conversationId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalog(data);
        registerEmojiArtwork(accountId, data);
        setRecent(
          [...(emojiRecent.get(accountId) || []), ...data.recentEmoji]
            .filter((e, i, list) => list.findIndex((v) => v.key === e.key) === i)
            .slice(0, 24),
        );
        setStickers(data.stickers);
        if (!data.stickers.length) setPack(data.categories[0]?.id ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(emojiOnly ? 'Chưa tải được Emoji.' : 'Chưa tải được Sticker và Emoji.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accountId, conversationId, retry, emojiOnly]);
  useEffect(() => {
    if (!catalog || emojiOnly) return;
    if (!query.trim() && pack === null) {
      setStickers(catalog.stickers);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setStickers([]);
    const timer = setTimeout(
      () => {
        void readCatalog(
          accountId,
          conversationId,
          controller.signal,
          query.trim() ? { query: query.trim() } : { categoryId: pack! },
        )
          .then((data) => {
            if (!controller.signal.aborted) setStickers(data.stickers);
          })
          .catch(() => {
            if (!controller.signal.aborted) setError('Chưa tải được sticker.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query.trim() ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accountId, conversationId, catalog, pack, query, emojiOnly]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab, pack, group, query]);
  useEffect(() => {
    const pointer = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target) && !target.closest('[data-expression-trigger]'))
        onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);
  const emojiGrid = (items: EmojiChoice[]) => (
    <div className={styles.expressionEmojiGrid}>
      {items.map((emoji) => (
        <button
          key={emoji.key}
          type="button"
          disabled={blocked}
          aria-label={`Chèn ${emoji.text}`}
          title={emoji.key}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!onEmoji(emoji)) return;
            const next = [emoji, ...recent.filter((item) => item.key !== emoji.key)].slice(0, 24);
            setRecent(next);
            emojiRecent.set(accountId, next);
          }}
        >
          <span
            aria-hidden="true"
            className={styles.expressionEmoji}
            style={{
              backgroundImage: `url("${catalog?.sprite}")`,
              backgroundPosition: emoji.position,
            }}
          />
        </button>
      ))}
    </div>
  );
  const selected = catalog?.emojiGroups.find((g) => g.id === group);
  return (
    <div
      ref={root}
      className={styles.expressionPicker}
      role="dialog"
      aria-label={emojiOnly ? 'Emoji' : 'Sticker và Emoji'}
    >
      <div className={styles.expressionTabs} role="tablist" aria-label="Loại biểu cảm">
        {(emojiOnly ? (['emoji'] as const) : (['sticker', 'emoji'] as const)).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => onTabChange(name)}
          >
            {name.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'sticker' && (
        <label className={styles.expressionSearch}>
          <Icon name="search" size={14} />
          <input
            aria-label="Tìm kiếm sticker"
            placeholder="Tìm kiếm sticker"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <div
        ref={scroller}
        className={`${styles.scrollArea} ${styles.expressionContent}`}
        role="tabpanel"
        aria-label={tab === 'sticker' ? 'Danh sách sticker' : 'Danh sách emoji'}
        aria-busy={loading}
      >
        {error && (!catalog || tab === 'sticker') ? (
          <p className={styles.expressionNotice}>
            {error} <button onClick={() => setRetry(retry + 1)}>Thử lại</button>
          </p>
        ) : !catalog || (tab === 'sticker' && loading) ? (
          <p className={styles.expressionNotice}>Đang tải…</p>
        ) : tab === 'sticker' ? (
          <>
            <h3>
              {query.trim()
                ? 'Kết quả tìm kiếm'
                : pack === null
                  ? 'Gần đây'
                  : catalog.categories.find((p) => p.id === pack)?.name}
            </h3>
            <div className={styles.expressionStickerGrid}>
              {stickers.map((sticker) => (
                <button
                  key={`${sticker.categoryId}:${sticker.id}`}
                  type="button"
                  disabled={blocked}
                  title={sticker.name}
                  aria-label={`Gửi sticker ${sticker.name}`}
                  onClick={() => onSticker(sticker)}
                >
                  <StickerArtwork
                    preview={sticker.preview}
                    animation={sticker.animation}
                    size={65}
                    hoverOnly
                  />
                </button>
              ))}
            </div>
            {!stickers.length && (
              <p className={styles.expressionNotice}>
                {query.trim() ? 'Không tìm thấy sticker.' : 'Chưa có sticker gần đây.'}
              </p>
            )}
          </>
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <h3>Gần đây</h3>
                {emojiGrid(recent)}
              </>
            )}
            <h3>{selected?.name}</h3>
            {emojiGrid(selected?.items || [])}
          </>
        )}
      </div>
      <div className={styles.expressionCategoryBar}>
        <button
          type="button"
          aria-label="Nhóm biểu cảm trước"
          onClick={() => categories.current?.scrollBy({ left: -190, behavior: 'smooth' })}
        >
          <Icon name="back" size={16} />
        </button>
        <div
          ref={categories}
          className={styles.expressionCategories}
          role="group"
          aria-label={tab === 'sticker' ? 'Bộ sticker' : 'Nhóm emoji'}
        >
          {tab === 'sticker' ? (
            <>
              <button
                type="button"
                title="Gần đây"
                aria-label="Sticker gần đây"
                aria-pressed={pack === null && !query}
                onClick={() => {
                  setPack(null);
                  setQuery('');
                }}
              >
                <Icon name="emojiRecent" size={22} />
              </button>
              {catalog?.categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  title={category.name}
                  aria-label={`Bộ ${category.name}`}
                  aria-pressed={pack === category.id && !query}
                  onClick={() => {
                    setPack(category.id);
                    setQuery('');
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {category.preview ? (
                    <img src={category.preview} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    category.name.slice(0, 1)
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <button
                  type="button"
                  aria-label="Emoji gần đây"
                  title="Gần đây"
                  onClick={() => {
                    setGroup('0');
                    scroller.current?.scrollTo({ top: 0 });
                  }}
                >
                  <Icon name="emojiRecent" size={22} />
                </button>
              )}
              {catalog?.emojiGroups.map((category, i) => (
                <button
                  key={category.id}
                  type="button"
                  aria-label={`Emoji ${category.name}`}
                  title={category.name}
                  aria-pressed={category.id === group}
                  onClick={() => setGroup(category.id)}
                >
                  <Icon
                    name={
                      (
                        [
                          'emojiZalo',
                          'emojiPeople',
                          'emojiNature',
                          'emojiFood',
                          'emojiActivity',
                          'emojiTravel',
                          'emojiObjects',
                          'emojiSymbols',
                          'emojiFlags',
                        ] as const
                      )[i]
                    }
                    size={22}
                  />
                </button>
              ))}
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="Nhóm biểu cảm tiếp"
          onClick={() => categories.current?.scrollBy({ left: 190, behavior: 'smooth' })}
        >
          <Icon name="next" size={16} />
        </button>
      </div>
    </div>
  );
}
