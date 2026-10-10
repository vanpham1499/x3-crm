'use client';
import { useSharedTags } from './shared-tags';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation } from '../types';
import type { ConversationSetting } from '../conversation-settings';
import { ConversationSettingsProvider, useSharedSettings } from './conversation-settings-controls';
import { ConversationPrivacy } from './conversation-privacy';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

type Props = {
  conversation: Conversation;
  anchor: HTMLButtonElement;
  onClose: () => void;
  onChanged: () => void;
  onAddToGroup?: () => void;
  archived?: boolean;
  onArchive?: () => Promise<void>;
};

export function ConversationListMenu(props: Props) {
  return (
    <ConversationSettingsProvider conversation={props.conversation}>
      <ListMenu {...props} />
    </ConversationSettingsProvider>
  );
}

function ListMenu({
  conversation,
  anchor,
  onClose,
  onChanged,
  onAddToGroup,
  archived,
  onArchive,
}: Props) {
  const tags = useSharedTags();
  const { state, busy: saving, error, pinned, muted, act, ready } = useSharedSettings();
  const [waiting, setWaiting] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const busy = saving || waiting || dialogOpen;
  const [muteOpen, setMuteOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, subLeft: false });
  const menu = useRef<HTMLDivElement>(null);
  const root = anchor.closest<HTMLElement>(`.${styles.workspace}`);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect();
    const height = menu.current?.offsetHeight || 280;
    const left = Math.max(8, Math.min(box.left, window.innerWidth - 208));
    setPosition({
      left,
      top: Math.max(8, Math.min(box.bottom + 4, window.innerHeight - height - 8)),
      subLeft: left + 404 > window.innerWidth,
    });
    menu.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, [anchor]);
  useEffect(() => {
    if (dialogOpen) return;
    const dismiss = (event: Event) => {
      if (
        busy ||
        menu.current?.contains(event.target as Node) ||
        anchor.contains(event.target as Node)
      )
        return;
      closeRef.current();
    };
    const resize = () => {
      if (!busy) closeRef.current();
    };
    const initialTop = anchor.getBoundingClientRect().top;
    const scroll = (event: Event) => {
      if (event.target instanceof Element && !event.target.contains(anchor)) return;
      if (Math.abs(anchor.getBoundingClientRect().top - initialTop) > 1) dismiss(event);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [anchor, busy, dialogOpen]);
  const run = async (setting: ConversationSetting) => {
    if (pending.current || busy) return;
    pending.current = true;
    setWaiting(true);
    try {
      await ready();
      if (!mounted.current) return;
      if (await act(setting)) {
        onChanged();
        onClose();
      }
    } catch {
      /* The settings provider displays read errors. Do not submit on a failed read. */
    } finally {
      pending.current = false;
      if (mounted.current) setWaiting(false);
    }
  };
  if (!root) return null;
  return createPortal(
    <ConversationPrivacy
      conversation={conversation}
      onChanged={onChanged}
      onDismiss={onClose}
      renderActions={({ open, state: privacy, modal, busy: privacyBusy, error: privacyError }) =>
        !modal && (
          <div
            ref={menu}
            role="menu"
            aria-label={`Thao tác hội thoại ${conversation.name} · ${conversation.accountName}`}
            className={styles.conversationListMenu}
            style={{ left: position.left, top: position.top }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                if (muteOpen) {
                  setMuteOpen(false);
                  menu.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
                } else if (!busy) {
                  onClose();
                  anchor.focus();
                }
              }
              if (event.key === 'Tab' && !busy) onClose();
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const scope = (event.target as HTMLElement).closest('[role="menu"]')!;
                const buttons = Array.from(
                  scope.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
                ).filter((b) => b.closest('[role="menu"]') === scope);
                const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              }
            }}
          >
            {(onAddToGroup || conversation.group) && (
              <div className={styles.menuAccountLabel}>{conversation.accountName}</div>
            )}
            {onArchive && (
              <>
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={async () => {
                    if (pending.current) return;
                    pending.current = true;
                    setWaiting(true);
                    setArchiveError('');
                    try {
                      await onArchive();
                      onClose();
                    } catch (e) {
                      if (mounted.current)
                        setArchiveError(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.');
                    } finally {
                      pending.current = false;
                      if (mounted.current) setWaiting(false);
                    }
                  }}
                >
                  {archived ? 'Đưa lại danh sách chính' : 'Lưu trữ hội thoại'}
                </button>
                {archiveError && <p role="alert">{archiveError}</p>}
                <hr />
              </>
            )}
            {!onAddToGroup && (
              <>
                <button
                  role="menuitem"
                  disabled={busy}
                  onClick={() => run({ kind: 'pin', pinned: !pinned })}
                >
                  {pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
                </button>
                <hr />
              </>
            )}
            <button
              role="menuitem"
              onClick={() => {
                tags.pick(conversation);
                onClose();
              }}
            >
              Phân loại
            </button>
            {state?.canMarkUnread && (
              <button
                role="menuitem"
                disabled={busy}
                onClick={() => run({ kind: 'unread', unread: !state.unread })}
              >
                {state.unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
              </button>
            )}
            {onAddToGroup && (
              <button role="menuitem" disabled={busy} onClick={onAddToGroup}>
                Thêm vào nhóm
              </button>
            )}
            <div
              className={styles.conversationMuteMenu}
              onMouseEnter={() => !muted && setMuteOpen(true)}
              onMouseLeave={() => setMuteOpen(false)}
            >
              <button
                role="menuitem"
                disabled={busy}
                aria-haspopup={muted ? undefined : 'menu'}
                aria-expanded={muted ? undefined : muteOpen}
                onClick={() => (muted ? run({ kind: 'mute', mode: 0 }) : setMuteOpen(!muteOpen))}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' && !muted) {
                    event.preventDefault();
                    setMuteOpen(true);
                    requestAnimationFrame(() =>
                      menu.current
                        ?.querySelector<HTMLButtonElement>(
                          '[aria-label="Thời gian tắt thông báo"] button',
                        )
                        ?.focus(),
                    );
                  }
                }}
              >
                {muted ? 'Bật thông báo' : 'Tắt thông báo'}
                {!muted && <Icon name="next" size={16} />}
              </button>
              {muteOpen && !muted && (
                <div
                  role="menu"
                  aria-label="Thời gian tắt thông báo"
                  className={styles.conversationMuteSubmenu}
                  data-left={position.subLeft}
                >
                  {['Trong 1 giờ', 'Trong 4 giờ', 'Cho đến 8:00 AM', 'Cho đến khi tôi bật lại'].map(
                    (label, index) => (
                      <button
                        key={label}
                        role="menuitem"
                        disabled={busy}
                        onClick={() => run({ kind: 'mute', mode: index + 1 })}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            <button
              role="menuitem"
              disabled={busy || privacyBusy || privacy?.canHide === false}
              onClick={() => {
                setDialogOpen(true);
                void open('hide').then((opened) => {
                  if (!opened && mounted.current) setDialogOpen(false);
                });
              }}
            >
              Ẩn trò chuyện
            </button>
            <hr />
            <button
              role="menuitem"
              className={styles.conversationMenuDanger}
              disabled={busy || privacyBusy}
              onClick={() => {
                setDialogOpen(true);
                void open('clear-history').then((opened) => {
                  if (!opened && mounted.current) setDialogOpen(false);
                });
              }}
            >
              Xóa hội thoại
            </button>
            <hr />
            <button
              role="menuitem"
              disabled={busy || privacyBusy || privacy?.canReport === false}
              onClick={() => {
                setDialogOpen(true);
                void open('report').then((opened) => {
                  if (!opened && mounted.current) setDialogOpen(false);
                });
              }}
            >
              Báo xấu
            </button>
            {(waiting || privacyBusy) && <p role="status">Đang chuẩn bị thao tác…</p>}
            {error && <p role="alert">{error}</p>}
            {privacyError && <p role="alert">{privacyError}</p>}
          </div>
        )
      }
    />,
    root,
  );
}
