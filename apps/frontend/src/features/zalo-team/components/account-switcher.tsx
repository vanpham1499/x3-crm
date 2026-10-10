'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from './avatar';
import type { ConversationListResponse } from '../types';
import styles from '../zalo-team.module.css';

export type AccountFilterProps = {
  accounts: ConversationListResponse['accounts'];
  accountId: string;
  onAccountChange: (id: string) => void;
};

function BrandAvatar({ size = 40 }: { size?: number }) {
  // The CRM favicon is the compact symbol from its X3Sales wordmark.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src="/favicon.png" alt="" width={size} height={size} className={styles.brandAvatar} />
  );
}

export function AccountSwitcher({ filter }: { filter?: AccountFilterProps }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const selected = filter?.accounts.find((account) => String(account.id) === filter.accountId);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const choose = (id: string) => {
    filter?.onAccountChange(id);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      ref={root}
      className={styles.accountSwitcher}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className={styles.profile}
        title={selected?.name || 'Tất cả tài khoản'}
        aria-label={filter ? `Lọc tài khoản: ${selected?.name || 'Tất cả tài khoản'}` : 'X3Sales'}
        aria-expanded={filter ? open : undefined}
        aria-controls={open ? panelId : undefined}
        onClick={() => filter && setOpen((value) => !value)}
      >
        {selected ? (
          <Avatar conversation={{ ...selected, color: '#b8c7e3' }} size={40} />
        ) : (
          <BrandAvatar />
        )}
      </button>
      {open && filter && (
        <section id={panelId} className={styles.accountPopover} aria-label="Chọn tài khoản Zalo">
          <h2>Tài khoản Zalo</h2>
          <div className={styles.accountChoices}>
            <button
              className={styles.accountChoice}
              aria-pressed={!selected}
              onClick={() => choose('')}
            >
              <BrandAvatar size={48} />
              <span>Tất cả tài khoản</span>
            </button>
            {filter.accounts.map((account) => (
              <button
                key={account.id}
                className={styles.accountChoice}
                title={account.name}
                aria-pressed={selected?.id === account.id}
                onClick={() => choose(String(account.id))}
              >
                <Avatar conversation={{ ...account, color: '#b8c7e3' }} />
                <span>{account.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
