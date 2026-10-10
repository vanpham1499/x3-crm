import styles from '../campaigns.module.css';

export function campaignStatus(
  c: { state: string; counts: Record<string, number> },
  labels: Record<string, string>,
) {
  if (c.state !== 'completed') return labels[c.state] || c.state;
  const values = Object.entries(c.counts);
  if (!(c.counts.sent > 0)) return 'Kết thúc · chưa gửi';
  return values.some(([state, n]) => state !== 'sent' && n > 0)
    ? 'Kết thúc · gửi một phần'
    : 'Đã gửi xong';
}

export function CampaignStatus({
  campaign,
  labels,
}: {
  campaign: { state: string; counts: Record<string, number> };
  labels: Record<string, string>;
}) {
  const tone =
    campaign.state === 'completed' &&
    Object.entries(campaign.counts).some(([state, n]) => state !== 'sent' && n > 0)
      ? 'skipped'
      : campaign.state;
  return (
    <span className={styles.stateBadge} data-state={tone}>
      <span aria-hidden="true" />
      {campaignStatus(campaign, labels)}
    </span>
  );
}

export function CampaignProgress({
  counts,
  compact = false,
}: {
  counts: Record<string, number>;
  compact?: boolean;
}) {
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value), 0);
  const sent = Number(counts.sent || 0);
  const done = ['sent', 'skipped', 'failed', 'cancelled', 'unknown'].reduce(
    (sum, state) => sum + Number(counts[state] || 0),
    0,
  );
  const percent = total ? Math.round((sent / total) * 100) : 0;
  return (
    <div className={styles.progressBlock} data-compact={compact || undefined}>
      <div>
        <strong>
          {percent}%{!compact && ' đã gửi'}
        </strong>
        <span>
          {sent}/{total} phần tin
        </span>
      </div>
      <progress aria-label="Tỷ lệ phần tin đã gửi" max={total || 1} value={sent} />
      {!compact && (
        <small>
          {done}/{total} phần đã xử lý{counts.skipped ? ` · ${counts.skipped} bỏ qua` : ''}
          {counts.unknown ? ` · ${counts.unknown} chưa xác nhận` : ''}
          {counts.failed ? ` · ${counts.failed} lỗi` : ''}
        </small>
      )}
    </div>
  );
}
