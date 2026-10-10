'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation } from '../types';
import type { LinkedGroup } from '../group-links';
import { Avatar } from './avatar';
import styles from '../zalo-team.module.css';
export function GroupAccountPicker({
  sources,
  link,
  anchor,
  mode,
  onChoose,
  onClose,
  onManage,
}: {
  sources: Conversation[];
  link: LinkedGroup;
  anchor: HTMLElement;
  mode: 'chat' | 'menu';
  onChoose: (source: Conversation, remember: boolean) => void;
  onClose: () => void;
  onManage: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [remember, setRemember] = useState(!!link.preferredAccountId),
    [position, setPosition] = useState({ left: 0, top: 0 });
  const root = anchor.closest<HTMLElement>(`.${styles.workspace}`);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(r.right + 4, window.innerWidth - 304)),
      top: Math.max(
        8,
        Math.min(r.top, window.innerHeight - (ref.current?.offsetHeight || 280) - 8),
      ),
    });
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [anchor, sources.length]);
  useEffect(() => {
    const outside = (e: Event) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, onClose]);
  if (!root) return null;
  return createPortal(
    <div
      ref={ref}
      className={styles.groupAccountPicker}
      style={position}
      role="dialog"
      aria-label="Chọn tài khoản truy cập nhóm"
    >
      <strong>{mode === 'menu' ? 'Thao tác bằng' : 'Mở trò chuyện bằng'}</strong>
      {link.preferredAccountId && !sources.some((s) => s.accountId === link.preferredAccountId) && (
        <p>Tài khoản đã ghi nhớ chưa sẵn sàng. Chọn tài khoản khác để tiếp tục.</p>
      )}
      {sources.map((source) => (
        <button
          key={source.id}
          className={styles.groupAccountChoice}
          onClick={() => onChoose(source, remember)}
          aria-label={`Dùng tài khoản ${source.accountName}`}
        >
          <Avatar
            conversation={{
              name: source.accountName || '',
              avatarSrc: source.accountAvatarSrc,
              color: '#e5efff',
            }}
            size={32}
          />
          <span>{source.accountName}</span>
          {(source.unread || source.unreadMarked) && <small>● Chưa đọc</small>}
        </button>
      ))}
      {mode === 'chat' && (
        <label className={styles.groupRemember}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Ghi nhớ lựa chọn cho nhóm này
        </label>
      )}
      {link.automatic ? (
        <small>Đã tự động gom cùng nhóm Zalo</small>
      ) : (
        <button className={styles.groupManageLink} onClick={onManage}>
          Quản lý liên kết nhóm
        </button>
      )}
    </div>,
    root,
  );
}
