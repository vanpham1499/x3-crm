'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icon';
import type { IconName } from './icon';
import styles from '../zalo-team.module.css';

export function SearchInput({
  label,
  value,
  onValueChange,
  placeholder = 'Tìm kiếm',
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.searchField}>
      <span className={styles.searchGlyph}>
        <Icon name="search" size={14} />
      </span>
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className={styles.searchClear}
          aria-label={`Xóa ${label.toLocaleLowerCase('vi')}`}
          onClick={() => onValueChange('')}
        >
          ×
        </button>
      )}
    </label>
  );
}

export function ScrollArea({
  children,
  className = '',
  compact = false,
  label,
  scrollRef,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  scrollRef?: import('react').Ref<HTMLDivElement>;
  label: string;
}) {
  return (
    <div
      ref={scrollRef}
      className={`${styles.scrollArea} ${className}`}
      data-compact={compact}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <div className={styles.scrollContent}>{children}</div>
    </div>
  );
}

// A section owns exactly one separator; nested content never adds another.
export function PanelSection({
  title,
  children,
  defaultOpen = false,
  headerSize = 'compact',
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  headerSize?: 'compact' | 'standard';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={styles.infoSection} data-open={open} data-header-size={headerSize}>
      <h2 className={styles.sectionHeading}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {title}
          <Icon name="disclosure" size={16} />
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

export function PanelAction({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.panelAction}
      aria-disabled={!onClick}
      title={onClick ? label : `${label} · Chỉ xem giao diện`}
      onClick={onClick}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}

export function PanelEmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.panelEmpty}>{children}</p>;
}
