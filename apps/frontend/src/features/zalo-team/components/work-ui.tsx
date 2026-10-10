'use client';
import { useId, useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Icon } from './icon';
import { taskStates, workStates } from '../workspace';
import styles from './work-collaboration.module.css';

export function WorkStatus({ value }: { value: string }) {
  const label =
    { ...workStates, ...taskStates }[value as keyof (typeof workStates & typeof taskStates)] ||
    value;
  return (
    <span className={styles.status} data-status={value}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
export function WorkPerson({ name }: { name?: string | null }) {
  return (
    <span className={styles.person}>
      <span className={styles.personAvatar} aria-hidden="true">
        {name
          ? name
              .trim()
              .split(/\s+/)
              .slice(-2)
              .map((v) => v[0])
              .join('')
          : '—'}
      </span>
      <span>{name || 'Chưa phân công'}</span>
    </span>
  );
}
export function WorkMenu({
  label,
  items,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
  items: { label: string; onClick?: () => void; href?: string; danger?: boolean }[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={styles.moreButton}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        aria-controls={anchor ? id : undefined}
        disabled={disabled}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Icon name="more" size={20} />
      </button>
      <Menu
        id={id}
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 196,
              maxWidth: 'calc(100vw - 24px)',
              border: '1px solid #e4e8ee',
              borderRadius: '6px',
              boxShadow: '0 8px 28px #081c3624',
            },
          },
          list: { 'aria-label': label, sx: { py: 0.5 } },
        }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.label}
            component={item.href ? 'a' : 'li'}
            {...(item.href ? { href: item.href } : {})}
            disabled={disabled}
            onClick={() => {
              setAnchor(null);
              item.onClick?.();
            }}
            sx={{
              fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif",
              fontSize: 13,
              minHeight: 40,
              color: item.danger ? '#b42332' : '#092342',
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
export function WorkEmpty({ label }: { label: string }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name="documents" size={24} />
      </span>
      <span>{label}</span>
    </div>
  );
}
export function formatTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
