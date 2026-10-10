'use client';
import { useId, useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Icon } from './icon';
import styles from '../campaigns.module.css';

export type CampaignAction =
  'view' | 'edit' | 'copy' | 'delete' | 'requeue' | 'pause' | 'resume' | 'start' | 'cancel';
type MenuCampaign = {
  name: string;
  state: string;
  counts: Record<string, number>;
  canEdit?: boolean;
  canCopy?: boolean;
};

export function CampaignMenu({
  campaign,
  busy,
  load,
  onAction,
  detail = false,
}: {
  campaign: MenuCampaign;
  busy: boolean;
  load?: () => Promise<MenuCampaign>;
  onAction: (action: CampaignAction) => void;
  detail?: boolean;
}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [resolved, setResolved] = useState<MenuCampaign>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const c = resolved || campaign;
  const pending = !!(c.counts.unknown || c.counts.preparing || c.counts.sending);
  async function read() {
    if (!load) return;
    setLoading(true);
    setError(false);
    try {
      setResolved(await load());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  const items: {
    action: CampaignAction;
    label: string;
    icon: Parameters<typeof Icon>[0]['name'];
    disabled?: boolean;
    danger?: boolean;
  }[] = [
    ...(!detail
      ? [{ action: 'view' as const, label: 'Xem chi tiết', icon: 'documents' as const }]
      : []),
    ...(c.canEdit
      ? [{ action: 'edit' as const, label: 'Chỉnh sửa bản nháp', icon: 'edit' as const }]
      : []),
    ...(c.canCopy
      ? [{ action: 'copy' as const, label: 'Sao chép chiến dịch', icon: 'copy' as const }]
      : []),
    ...(!detail && c.state === 'draft'
      ? [{ action: 'start' as const, label: 'Xem trước và gửi', icon: 'share' as const }]
      : []),
    ...(!detail && c.state === 'running'
      ? [{ action: 'pause' as const, label: 'Tạm dừng', icon: 'timer' as const }]
      : []),
    ...(!detail && c.state === 'paused' && !!c.counts.queued
      ? [
          {
            action: 'resume' as const,
            label: 'Tiếp tục gửi',
            icon: 'share' as const,
            disabled: pending,
          },
        ]
      : []),
    ...(!detail &&
    ['paused', 'completed', 'cancelled'].includes(c.state) &&
    !!(c.counts.skipped || c.counts.failed || c.counts.cancelled)
      ? [
          {
            action: 'requeue' as const,
            label: 'Gửi tiếp phần chưa gửi',
            icon: 'redo' as const,
            disabled: pending,
          },
        ]
      : []),
    ...(['draft', 'running', 'paused'].includes(c.state)
      ? [{ action: 'cancel' as const, label: 'Hủy phần chưa gửi', icon: 'close' as const }]
      : []),
    {
      action: 'delete',
      label: 'Xóa chiến dịch',
      icon: 'trashLine',
      danger: true,
      disabled: c.state === 'running' || pending,
    },
  ];
  return (
    <>
      <button
        className={styles.moreButton}
        aria-label={`Thao tác chiến dịch ${campaign.name}`}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        aria-controls={anchor ? id : undefined}
        disabled={busy}
        onClick={(event) => {
          setAnchor(event.currentTarget);
          setResolved(undefined);
          void read();
        }}
      >
        <Icon name="more" size={22} />
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
              width: 248,
              maxWidth: 'calc(100vw - 24px)',
              borderRadius: '8px',
              border: '1px solid #e4e8ee',
              boxShadow: '0 8px 28px #081c3624',
              mt: 0.5,
            },
          },
          list: { 'aria-label': `Thao tác ${campaign.name}`, sx: { py: 0.5 } },
        }}
      >
        {loading ? (
          <MenuItem disabled>Đang tải thao tác…</MenuItem>
        ) : error ? (
          <MenuItem onClick={() => void read()}>Chưa tải được. Thử lại</MenuItem>
        ) : (
          items.map((item) => (
            <MenuItem
              key={item.action}
              disabled={busy || item.disabled}
              onClick={() => {
                setAnchor(null);
                onAction(item.action);
              }}
              sx={{
                fontFamily: "'ZaloTeamSegoe', 'Segoe UI', sans-serif",
                fontSize: 14,
                gap: 1.5,
                minHeight: 42,
                color: item.danger ? '#c52b37' : '#081c36',
                ...(item.danger ? { borderTop: '1px solid #edf0f4', mt: 0.5 } : {}),
              }}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
