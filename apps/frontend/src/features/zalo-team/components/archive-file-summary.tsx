'use client';
import { useAccountAccess } from '../use-account-access';
import { useEffect, useState } from 'react';
import { archiveDate, archiveRequest, type ArchiveStatus } from '../archive';
import { ArchiveButton } from './archive-button';
import { ArchiveCleanup } from './archive-cleanup';
import styles from '../archive.module.css';
const labels: Record<string, [string, string]> = {
  pc_missing: ['Chưa có bản tệp đọc được', 'Có thể bổ sung bằng file xuất Zalo chứa tệp này.'],
  source_unavailable: [
    'Liên kết cũ đã hết hiệu lực (404/410)',
    'Có thể bổ sung bằng file xuất Zalo chứa tệp này.',
  ],
  refresh_required: ['Nguồn yêu cầu liên kết mới', 'Thử lại nguồn Web hoặc nhập từ file xuất mới.'],
  network: [
    'Kết nối hoặc máy chủ nguồn gián đoạn',
    'Có thể thử tải lại. Nếu tiếp tục lỗi, kiểm tra kết nối.',
  ],
  other: ['Cần kiểm tra thêm', 'Xem thông báo cụ thể của tệp bên dưới.'],
};
export function ArchiveFileSummary({
  data,
  onRefresh,
}: {
  data: ArchiveStatus;
  onRefresh?: () => Promise<void>;
}) {
  const access = useAccountAccess();
  const canSync =
    !!access &&
    (access.admin || Object.keys(access.accounts).some((id) => access.accounts[id].sync));
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [fresh, setFresh] = useState<ArchiveStatus | null>(null);
  const [baseline, setBaseline] = useState(data);
  if (baseline !== data) {
    setBaseline(data);
    setFresh(null);
  }
  const current = fresh || data,
    s = current.fileSummary;
  const [expanded, setExpanded] = useState(false);
  const [issueData, setIssueData] = useState<{
    basis: ArchiveStatus;
    items: ArchiveStatus['fileIssues'];
  } | null>(null);
  const [issueError, setIssueError] = useState('');
  const [issueRetry, setIssueRetry] = useState(0);
  useEffect(() => {
    if (!expanded || current.issuesLoaded !== false) return;
    const abort = new AbortController();
    setIssueError('');
    archiveRequest<ArchiveStatus>(
      { kind: 'status', view: 'sync', includeIssues: true },
      abort.signal,
    )
      .then((result) => {
        if (!abort.signal.aborted) setIssueData({ basis: current, items: result.fileIssues });
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setIssueError(e instanceof Error ? e.message : 'Chưa tải được chi tiết tệp.');
      });
    return () => abort.abort();
  }, [expanded, current, issueRetry]);
  const issues =
    current.issuesLoaded !== false
      ? current.fileIssues
      : issueData?.basis === current
        ? issueData.items
        : [];
  const online =
    !!current.settings.heartbeat &&
    Date.now() - new Date(current.settings.heartbeat).getTime() < 180000;
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await archiveRequest<ArchiveStatus & { retryQueued?: number }>({
        ...body,
        ...(body.kind === 'retry-files' ? { requestId: crypto.randomUUID() } : {}),
      });
      setFresh(result);
      setNotice(
        body.kind === 'configure'
          ? 'Đã bật tải tệp nền.'
          : `Đã yêu cầu kiểm tra ${result.retryQueued || 0} mục từ nguồn Web.`,
      );
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa yêu cầu được.');
    } finally {
      setBusy(false);
    }
  }
  if (!s) return null;
  return (
    <section aria-label="Tình trạng tệp đính kèm">
      <div className={styles.sectionHeading}>
        <h2>Tệp đính kèm</h2>
        <span className={styles.pill}>{s.ready.toLocaleString('vi')} đã lưu</span>
      </div>
      <div className={styles.fileStates}>
        <div>
          <strong>{s.pending.toLocaleString('vi')}</strong>
          <span>Đang chờ</span>
        </div>
        <div>
          <strong>{s.retrying.toLocaleString('vi')}</strong>
          <span>Chờ thử lại</span>
        </div>
        <div>
          <strong>{s.needsAttention.toLocaleString('vi')}</strong>
          <span>Cần kiểm tra nguồn</span>
        </div>
      </div>
      <div className={styles.actions}>
        {!current.settings.media && (
          <ArchiveButton
            disabled={busy || !access?.admin}
            onClick={() => void run({ kind: 'configure', ...current.settings, media: true })}
          >
            Bật tải tệp
          </ArchiveButton>
        )}
        <ArchiveButton
          disabled={busy || !canSync || !s.retrying || !current.settings.media}
          onClick={() => void run({ kind: 'retry-files', retryMode: 'scheduled' })}
        >
          Thử lại ngay
        </ArchiveButton>
        <ArchiveButton
          disabled={busy || !canSync || !(s.pending + s.failed) || !current.settings.media}
          onClick={() => void run({ kind: 'retry-files', retryMode: 'all' })}
        >
          Kiểm tra lại nguồn
        </ArchiveButton>
        <ArchiveCleanup
          dismissed={s.dismissed}
          onRefresh={async () => {
            setFresh(null);
            await onRefresh?.();
          }}
        />
      </div>
      {!online && current.settings.enabled && (
        <p className={styles.error}>Bộ tải tệp chưa hoạt động. Hàng đợi được giữ lại.</p>
      )}
      {!!s.nextRetryAt && (
        <p className={styles.hint}>Tự thử lại từ {archiveDate(s.nextRetryAt)}.</p>
      )}
      {(s.failed > 0 || s.pending > 0) && (
        <details
          className={styles.mediaNotice}
          onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
          <summary>Chi tiết {s.pending + s.failed} mục chưa lưu</summary>
          <div className={styles.reasonChips}>
            {Object.entries(s.groups).map(([key, count]) => (
              <span key={key}>
                {(labels[key] || labels.other)[0]}: {count}
              </span>
            ))}
          </div>
          <p className={styles.hint}>
            Tệp không còn ở nguồn Web có thể được bổ sung từ file xuất Zalo. Chỉ tệp đã lưu thành
            công mới được tính là đã lưu.
          </p>
          {expanded &&
            current.issuesLoaded === false &&
            issueData?.basis !== current &&
            !issueError && <p role="status">Đang tải chi tiết tệp…</p>}
          {issueError && (
            <p role="alert">
              {issueError} <button onClick={() => setIssueRetry((n) => n + 1)}>Thử lại</button>
            </p>
          )}
          {issues.map((f) => (
            <div className={styles.issueRow} key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <p>{f.sources?.map((a) => `${a.name} · ${a.account_name}`).join(' / ')}</p>
                <small>
                  {f.role === 'preview' ? 'Ảnh xem trước' : 'Tệp gốc'} · {archiveDate(f.time)}
                </small>
                <p>{f.originalSaved ? 'Bản gốc đã lưu; chỉ còn thiếu ảnh xem trước.' : f.error}</p>
                <small>
                  {f.autoRetry && f.retryAt ? ` · Thử lại: ${archiveDate(f.retryAt)}` : ''}
                </small>
              </div>
              <div className={styles.actions}>
                <ArchiveButton
                  disabled={busy || !current.settings.media}
                  onClick={() => void run({ kind: 'retry-files', assetId: f.id })}
                >
                  Thử lại
                </ArchiveButton>
              </div>
            </div>
          ))}
          <small>Hiển thị tối đa 20 mục lỗi gần nhất. Số mục gồm tệp gốc và ảnh xem trước.</small>
        </details>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
