import { archiveDate, type ArchiveStatus } from '../archive';
import styles from '../archive.module.css';
import { ArchiveFileSummary } from './archive-file-summary';

export function ArchiveProgress({ data }: { data: ArchiveStatus }) {
  const selected = data.sources.filter((s) => data.settings.accounts.includes(s.account_id));
  const complete = selected.filter((s) => s.history_done && !s.catchup_cursor && !s.error).length;
  const stale =
    !data.settings.heartbeat || Date.now() - new Date(data.settings.heartbeat).getTime() > 180000;
  const phase = data.settings.enabled
    ? stale
      ? 'offline'
      : data.progress?.phase || 'waiting'
    : 'paused';
  const titles: Record<string, string> = {
    catalog: 'Đang đọc danh sách hội thoại',
    messages: 'Đang lưu tin nhắn',
    files: 'Đang tải tệp về server',
    waiting: 'Đang chờ lượt đồng bộ tiếp theo',
    paused: 'Đã tạm dừng đồng bộ',
    error: 'Cần kiểm tra kết nối',
    offline: 'Bộ đồng bộ chưa báo hoạt động',
  };

  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <h2>Tiến trình đồng bộ</h2>
        <span className={['offline', 'error'].includes(phase) ? styles.warning : styles.pill}>
          {titles[phase]}
        </span>
      </div>
      {phase === 'messages' && (
        <p className={styles.currentSource}>
          {data.progress?.source}
          <span> · {data.progress?.account}</span>
        </p>
      )}
      {phase === 'files' && data.progress?.file && (
        <p className={styles.currentSource}>
          {data.progress.file}
          <span> · Tin ngày {archiveDate(data.progress.time || null)}</span>
        </p>
      )}
      <div className={styles.historyProgress}>
        <div>
          <div className={styles.sectionHeading}>
            <strong>Lịch sử hội thoại</strong>
            <span>
              {complete} / {selected.length} đã quét
            </span>
          </div>
          <progress max={selected.length || 1} value={complete} />
          <small>
            {selected.filter((s) => !!s.catchup_cursor).length} đang bù lịch sử ·{' '}
            {selected.filter((s) => !!s.error).length} nguồn lỗi
          </small>
        </div>
      </div>
      <ArchiveFileSummary data={data} />
      <p className={styles.hint}>Cập nhật: {archiveDate(data.settings.last_sync)}</p>
      {data.settings.error && <p className={styles.error}>{data.settings.error}</p>}
      {phase === 'offline' && (
        <p className={styles.error}>
          Tiến trình nền chưa chạy hoặc đã mất kết nối. Nút Đồng bộ ngay chỉ xếp yêu cầu; cần tiến
          trình nền hoạt động để xử lý.
        </p>
      )}
    </section>
  );
}
