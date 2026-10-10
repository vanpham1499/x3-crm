'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TeamDatePicker } from './team-date-picker';
import { Icon } from './icon';
import { Avatar } from './avatar';
import { useQuery } from '@tanstack/react-query';
import { directoryRequest } from '../directory';
import { CampaignPreview, useCampaignEmoji } from './campaign-preview';
import { CampaignProgress, CampaignStatus } from './campaign-progress';
import { CampaignMenu } from './campaign-menu';
import styles from '../campaigns.module.css';

type Recipient = {
  id: string;
  peer: string;
  name: string;
  suppressed: boolean;
  parts: { kind: string; text?: string; name?: string; assetId?: string }[];
  deliveries: { id: string; state: string; issue?: string }[];
};
type ReviewCampaign = {
  id: string;
  name: string;
  state: string;
  accountName: string;
  accountId: number;
  recipients: number;
  interval: number;
  startHour: number;
  endHour: number;
  counts: Record<string, number>;
  issue?: string;
  scheduledAt?: string;
  rows?: Recipient[];
  canEdit?: boolean;
  canCopy?: boolean;
};
export function CampaignReview({
  campaign: c,
  labels,
  busy,
  workerReady,
  schedule,
  onSchedule,
  page,
  onPage,
  onConfirm,
  onTransition,
  onRetry,
  onSuppress,
  onEdit,
  onCopy,
  onDelete,
  onRequeue,
  onBack,
}: {
  campaign: ReviewCampaign;
  labels: Record<string, string>;
  busy: boolean;
  workerReady: boolean;
  schedule: string;
  onSchedule: (value: string) => void;
  page: number;
  onPage: (page: number) => void;
  onConfirm: () => void;
  onTransition: (kind: 'pause' | 'resume' | 'cancel') => void;
  onRetry: (id: string) => void;
  onSuppress: (recipient: Recipient) => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onRequeue: () => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [validDate, setValidDate] = useState(true);
  const row = c.rows?.find((r) => r.id === selected) || c.rows?.[0];
  useCampaignEmoji(c.accountId);
  const kind = c.rows?.[0]?.peer.startsWith('g') ? 'groups' : 'friends';
  const directory = useQuery({
    queryKey: ['directory-avatars', c.accountId, kind, 0],
    queryFn: ({ signal }) => directoryRequest(c.accountId, { kind }, signal),
    staleTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const profiles = new Map(directory.data?.items?.map((p) => [p.id, p]));
  const unresolved = !!(c.counts.unknown || c.counts.preparing || c.counts.sending);
  return (
    <div className={styles.review}>
      <div className={styles.reviewNavigation}>
        <button onClick={onBack}>‹ Danh sách chiến dịch</button>
        <CampaignMenu
          campaign={c}
          busy={busy}
          detail
          onAction={(action) => {
            if (action === 'edit') onEdit();
            else if (action === 'copy') onCopy();
            else if (action === 'delete') onDelete();
            else if (action === 'cancel') onTransition('cancel');
          }}
        />
      </div>
      <section className={styles.reviewSummary} aria-label="Thông tin chiến dịch">
        <div className={styles.reviewTitle}>
          <div>
            <h2>{c.name}</h2>
            <span className={styles.muted}>
              {c.accountName} · {c.recipients} người/nhóm · {c.interval} giây/phần tin
            </span>
          </div>
          <CampaignStatus campaign={c} labels={labels} />
        </div>
        <div className={styles.reviewControls}>
          <div className={styles.reviewTiming}>
            <span className={styles.muted}>
              Khung gửi {c.startHour}:00–{c.endHour}:00 · Giờ Việt Nam
            </span>
            {c.state === 'draft' ? (
              <details className={styles.scheduleDetails} open={schedule ? true : undefined}>
                <summary>{schedule ? 'Đã chọn lịch gửi' : 'Hẹn giờ gửi'}</summary>
                <TeamDatePicker
                  withTime
                  label="Ngày, giờ gửi (Việt Nam)"
                  value={schedule}
                  onChange={onSchedule}
                  disabled={busy}
                  onValidityChange={setValidDate}
                />
                <small className={styles.muted}>Bỏ trống để gửi trong khung giờ cho phép.</small>
              </details>
            ) : (
              c.scheduledAt && (
                <span className={styles.muted}>
                  Lịch:{' '}
                  {new Date(c.scheduledAt).toLocaleString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                </span>
              )
            )}
          </div>
          <div className={styles.reviewActions}>
            {c.state === 'draft' && (
              <button
                className={styles.primary}
                disabled={busy || !workerReady || !validDate}
                onClick={onConfirm}
              >
                Xác nhận gửi
              </button>
            )}
            {c.state === 'running' && (
              <button disabled={busy} onClick={() => onTransition('pause')}>
                Tạm dừng
              </button>
            )}
            {c.state === 'paused' && (
              <button
                className={styles.primary}
                disabled={busy || !workerReady || unresolved || !c.counts.queued}
                onClick={onConfirm}
              >
                Tiếp tục
              </button>
            )}
            {['paused', 'completed', 'cancelled'].includes(c.state) &&
              !!(c.counts.skipped || c.counts.failed || c.counts.cancelled) && (
                <button disabled={busy || unresolved} onClick={onRequeue}>
                  Gửi tiếp phần chưa gửi
                </button>
              )}
          </div>
        </div>
        <CampaignProgress counts={c.counts} />
        {c.issue && <p className={styles.notice}>{c.issue}</p>}
        {c.rows?.some((r) => r.deliveries.some((d) => d.issue?.includes('24 giờ'))) && (
          <p className={styles.notice}>
            Lượt này bị chặn bởi quy tắc 24 giờ trước đây của Team. Quy tắc đã được bỏ. Bấm “Gửi
            tiếp phần chưa gửi” để chuẩn bị lại, rồi xác nhận gửi.
          </p>
        )}
      </section>
      <section className={styles.reviewWorkspace} aria-label="Người nhận và nội dung">
        <aside className={styles.reviewRecipients}>
          <h3>
            Người nhận <span>({c.recipients})</span>
          </h3>
          <div className={styles.reviewRecipientList}>
            {c.rows?.map((r) => (
              <button
                key={r.id}
                className={styles.reviewRecipient}
                aria-pressed={row?.id === r.id}
                onClick={() => setSelected(r.id)}
              >
                <Avatar
                  conversation={{
                    ...profiles.get(r.peer),
                    name: r.name,
                    group: r.peer.startsWith('g'),
                    color: '#e5efff',
                  }}
                  size={36}
                />
                <span>
                  <strong>{r.name}</strong>
                  <small>
                    {r.suppressed
                      ? 'Đã ngừng nhận'
                      : r.deliveries.some((d) => ['failed', 'unknown'].includes(d.state))
                        ? 'Có phần cần kiểm tra'
                        : c.state === 'draft'
                          ? `Chờ gửi · ${r.parts.length} phần tin`
                          : `${r.deliveries.filter((d) => d.state === 'sent').length}/${r.parts.length} phần đã gửi`}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {c.recipients > 50 && (
            <div className={styles.reviewPagination}>
              <button disabled={page === 0} onClick={() => onPage(page - 1)}>
                Trước
              </button>
              <span>
                {page + 1}/{Math.ceil(c.recipients / 50)}
              </span>
              <button disabled={(page + 1) * 50 >= c.recipients} onClick={() => onPage(page + 1)}>
                Sau
              </button>
            </div>
          )}
        </aside>
        <div className={styles.reviewContent}>
          {row ? (
            <>
              <header className={styles.reviewContentHeader}>
                <div>
                  <strong>{row.name}</strong>
                  <small>Nội dung gửi cho người nhận này</small>
                </div>
                <Link
                  href={`/zalo-team?directoryAccount=${c.accountId}&directoryPeer=${encodeURIComponent(row.peer)}`}
                >
                  Mở hội thoại
                </Link>
              </header>
              <div className={styles.reviewMessages}>
                {row.parts.map((part, i) => (
                  <div key={i} className={styles.reviewPart}>
                    <div className={styles.reviewBubble}>
                      <CampaignPreview campaignId={c.id} accountId={c.accountId} part={part} />
                    </div>
                    <small className={styles.muted}>
                      {labels[row.deliveries[i]?.state] || 'Chờ gửi'}
                    </small>
                    {row.deliveries[i]?.issue &&
                      !row.deliveries[i]?.issue?.includes('24 giờ') &&
                      row.deliveries[i]?.issue !== row.deliveries[i - 1]?.issue && (
                        <p role="status" className={styles.notice}>
                          {row.deliveries[i].issue}
                        </p>
                      )}
                    {['unknown', 'failed'].includes(row.deliveries[i]?.state) && (
                      <button
                        disabled={busy || c.state === 'running'}
                        onClick={() => onRetry(row.deliveries[i].id)}
                      >
                        {row.deliveries[i].state === 'unknown'
                          ? 'Kiểm tra kết quả'
                          : 'Thử lại phần chưa gửi'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <footer className={styles.reviewRecipientOptions}>
                <details>
                  <summary>Tùy chọn người nhận</summary>
                  <button disabled={busy} onClick={() => onSuppress(row)}>
                    {row.suppressed ? 'Cho phép nhận lại' : 'Không nhận chiến dịch'}
                  </button>
                </details>
              </footer>
            </>
          ) : (
            <p className={styles.muted}>Chưa có người nhận.</p>
          )}
        </div>
      </section>
    </div>
  );
}
