'use client';
import { useId, useState } from 'react';
import Popover from '@mui/material/Popover';
import { Icon } from './icon';
import { TeamSelect } from './team-select';
import { workStates, type WorkSummaries } from '../workspace';
import { emptyWorkFilter, type WorkFilter } from '../workspace-filter';
import styles from './workspace-panel.module.css';

export function WorkspaceFilters({
  value,
  onChange,
  onOpen,
  data,
  loading,
  error,
  onRetry,
}: {
  value: WorkFilter;
  onChange: (v: WorkFilter) => void;
  onOpen: (open: boolean) => void;
  data?: WorkSummaries;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const id = useId();
  const close = () => {
    setAnchor(null);
    onOpen(false);
  };
  const people = new Map<number, string>();
  for (const item of data?.items || [])
    if (item.assigneeId) people.set(item.assigneeId, item.assigneeName || 'Nhân sự');
  const active = value.person !== 'all' || value.state !== 'all';
  return (
    <>
      <button
        type="button"
        className={styles.filterTrigger}
        aria-label="Tùy chọn danh sách"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-controls={anchor ? id : undefined}
        data-active={active || undefined}
        title={active ? 'Đang lọc phân công' : 'Phân công'}
        onClick={(e) => {
          setAnchor(e.currentTarget);
          onOpen(true);
        }}
      >
        <Icon name="listMore" size={16} />
      </button>
      <Popover
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: 300,
              maxWidth: 'calc(100vw - 24px)',
              border: '1px solid #dce2ea',
              borderRadius: '6px',
              boxShadow: '0 6px 20px #081b3a24',
              fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif",
              color: '#092342',
            },
          },
        }}
      >
        <section id={id} role="dialog" className={styles.filters} aria-label="Phân công hội thoại">
          <div className={styles.heading}>
            <strong className={styles.filterTitle}>Phân công</strong>
            <button
              className={styles.filterClose}
              onClick={close}
              aria-label="Đóng bộ lọc phân công"
            >
              ×
            </button>
          </div>
          <div className={styles.quickFilters}>
            <button
              aria-pressed={value.person === 'mine'}
              onClick={() =>
                onChange({ ...value, person: value.person === 'mine' ? 'all' : 'mine' })
              }
            >
              Của tôi
            </button>
            <button
              aria-pressed={value.person === 'unassigned'}
              onClick={() =>
                onChange({ ...value, person: value.person === 'unassigned' ? 'all' : 'unassigned' })
              }
            >
              Chưa phân công
            </button>
            {active && <button onClick={() => onChange(emptyWorkFilter)}>Bỏ lọc</button>}
          </div>
          {loading && (
            <span className={styles.muted} role="status">
              Đang tải công việc…
            </span>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error} <button onClick={onRetry}>Thử lại</button>
            </p>
          )}
          <details>
            <summary>
              Trạng thái & nhân sự
              {value.state !== 'all'
                ? ` · ${workStates[value.state as keyof typeof workStates]}`
                : ''}
            </summary>
            <div className={styles.filterFields}>
              <TeamSelect
                aria-label="Lọc người phụ trách"
                value={value.person}
                onChange={(e) => onChange({ ...value, person: e.target.value })}
                options={[
                  { value: 'all', label: 'Tất cả người phụ trách' },
                  { value: 'mine', label: 'Của tôi' },
                  { value: 'unassigned', label: 'Chưa phân công' },
                  ...(data?.canManage
                    ? Array.from(people, ([id, label]) => ({ value: String(id), label }))
                    : []),
                ]}
              />
              <TeamSelect
                aria-label="Lọc trạng thái công việc"
                value={value.state}
                onChange={(e) => onChange({ ...value, state: e.target.value })}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  ...Object.entries(workStates).map(([value, label]) => ({ value, label })),
                ]}
              />
              <div className={styles.actions}>
                <button disabled={loading} onClick={onRetry}>
                  Tải lại công việc
                </button>
              </div>
            </div>
          </details>
        </section>
      </Popover>
    </>
  );
}
