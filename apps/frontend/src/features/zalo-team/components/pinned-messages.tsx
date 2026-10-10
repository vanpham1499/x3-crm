'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { TopicIcon } from './topic-create';
import { PollIcon } from './poll-card';
import type { MessagePage } from '../types';
import styles from '../zalo-team.module.css';

type Pin = NonNullable<MessagePage['pins']>[number];

/** Native topic-board layout: 50px rows, a 32px list heading and a chat-only backdrop. */
export function PinnedMessages({ pins, onJump }: { pins: Pin[]; onJump: (id: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState<{ pin: Pin; left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    setMenu(null);
    setNotice('');
    expandRef.current?.focus();
  }
  useEffect(() => {
    if (open) collapseRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open && !menu) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (menu) setMenu(null);
        else close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (menu && !menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, menu]);
  if (!pins.length) return null;
  function jump(pin: Pin) {
    if (onJump(pin.id)) close();
    else setNotice('Tin nhắn ghim nằm ngoài phần lịch sử đang tải.');
  }
  function row(pin: Pin, preview = false) {
    return (
      <div className={styles.pinRow}>
        <button
          className={styles.pinContent}
          onClick={() => jump(pin)}
          aria-label={`Xem tin nhắn ghim: ${pin.text}`}
        >
          {pin.poll ? (
            <PollIcon />
          ) : pin.topic ? (
            <TopicIcon kind="note" />
          ) : (
            <Icon name="messageLine" size={20} />
          )}
          <span className={styles.pinText}>
            <strong>{pin.poll ? 'Bình chọn' : pin.topic ? 'Ghi chú' : 'Tin nhắn'}</strong>
            <span>
              {pin.sender && <span className={styles.pinSender}>{pin.sender}: </span>}
              {pin.text}
            </span>
          </span>
        </button>
        {preview && pins.length > 1 && (
          <button
            ref={expandRef}
            className={styles.pinExpand}
            aria-label="Danh sách ghim"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            +{pins.length - 1} ghim <Icon name="chevronDown" size={16} />
          </button>
        )}
        <button
          className={styles.pinMore}
          title="Thêm"
          aria-label={`Thao tác tin ghim: ${pin.text}`}
          aria-haspopup="menu"
          onClick={(event) => {
            const r = event.currentTarget.getBoundingClientRect();
            setMenu({
              pin,
              left: Math.max(8, Math.min(r.right - 180, window.innerWidth - 188)),
              top: r.bottom + 4,
            });
          }}
        >
          <Icon name="moreLine" size={16} />
        </button>
      </div>
    );
  }
  return (
    <>
      <section className={styles.pinnedMessages} aria-label="Tin nhắn đã ghim">
        {row(pins[0], true)}
        {!open && notice && (
          <p className={styles.pinNotice} role="status">
            {notice}
          </p>
        )}
      </section>
      {open && (
        <div className={styles.pinsOverlay}>
          <button
            className={styles.pinsBackdrop}
            tabIndex={-1}
            aria-label="Đóng danh sách ghim"
            onClick={close}
          />
          <section className={styles.pinsBoard} aria-label="Danh sách ghim">
            <header className={styles.pinsHeading}>
              <strong>Danh sách ghim ({pins.length})</strong>
              <button ref={collapseRef} onClick={close}>
                Thu gọn <Icon name="chevronUp" size={16} />
              </button>
            </header>
            <div className={`${styles.scrollArea} ${styles.pinsList}`}>
              {pins.map((pin, index) => (
                <div key={`${pin.id}:${index}`}>{row(pin)}</div>
              ))}
            </div>
            {notice && (
              <p className={styles.pinNotice} role="status">
                {notice}
              </p>
            )}
          </section>
        </div>
      )}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          className={`${styles.messageMenu} ${styles.pinMenu}`}
          style={{ left: menu.left, top: menu.top }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setMenu(null);
              void navigator.clipboard
                .writeText(menu.pin.text)
                .catch(() => setNotice('Không thể truy cập clipboard.'));
            }}
          >
            Copy
          </button>
        </div>
      )}
    </>
  );
}
