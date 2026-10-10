'use client';
import { backgroundRead } from '../request';
import { useEffect, useRef, useState } from 'react';
import { archiveRequest, archiveDate, type ArchiveStatus } from '../archive';
import { ArchiveButton } from './archive-button';
import { TeamSelect } from './team-select';
import styles from '../archive.module.css';

type Conversation = {
  conversationId: string;
  name: string;
  messages: number;
  oldest: number;
  newest: number;
};
type Issue = { messageId: string; time: number; name: string; reason: string };
type Result = {
  name: string;
  messages: number;
  added: number;
  files: number;
  missing: number;
  complete: boolean;
  issues?: Issue[];
};
type Status = {
  state: string;
  supported: boolean;
  accountName?: string;
  fileName?: string;
  fileBytes?: number;
  accountId?: number;
  error?: string;
  errorCode?: string;
  selected?: string[];
  current?: string;
  phase?: string;
  queueCount?: number;
  uploadedBytes?: number;
  uploadLimit: number | null;
  stopRequested?: boolean;
  picker?: { id: string; state: string; fileName?: string; bytes?: number; error?: string } | null;
  retry?: { attempt: number; seconds: number; nextAt: number; reason: string } | null;
  performance?: { messagesPerSecond: number; bytesPerSecond: number; elapsedSeconds: number };
  summary?: { messages: number; duplicates: number; members: number };
  progress?: {
    scanned?: number;
    members?: number;
    processed?: number;
    files?: number;
    bytes?: number;
  };
  conversations: Conversation[];
  results?: Record<string, Result>;
};
const bytes = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toLocaleString('vi', { maximumFractionDigits: 2 })} GB`
    : n >= 1e6
      ? `${(n / 1e6).toLocaleString('vi', { maximumFractionDigits: 2 })} MB`
      : `${Math.ceil(n / 1000)} KB`;
const reasons: Record<string, string> = {
  FILE_NOT_IN_EXPORT: 'Không tìm thấy bản trong file xuất',
  FILE_ASSET_LIMIT: 'Tệp lớn hơn giới hạn 250 MiB/tệp',
  FILE_MULTIPART_UNSUPPORTED: 'Chưa đối chiếu được từng tệp của album',
  FILE_ASSET_CHECKSUM: 'Mã kiểm tra tệp không khớp',
  FILE_ASSET_SIZE_MISMATCH: 'Kích thước tệp không khớp',
  FILE_PREVIEW_LIMIT: 'Đã lưu bản gốc; ảnh xem trước vượt giới hạn',
  FILE_PREVIEW_FAILED: 'Chưa tạo được ảnh xem trước',
};
const titles: Record<string, string> = {
  idle: 'Chọn file xuất Zalo',
  'needs-unlock': 'Cần mở khóa file',
  'queued-unlock': 'Đang chuẩn bị mở khóa',
  unlocking: 'Đang mở khóa file',
  'queued-index': 'Đang chuẩn bị đọc file',
  indexing: 'Đang đọc danh mục',
  ready: 'Sẵn sàng nhập',
  'queued-import': 'Đang chuẩn bị nhập',
  importing: 'Đang nhập dữ liệu',
  paused: 'Đã dừng',
  complete: 'Đã nhập xong lựa chọn',
};
const phases: Record<string, string> = {
  unlocking: 'Mở khóa file',
  indexing: 'Đọc danh mục tệp',
  reading: 'Đọc danh sách tin nhắn',
  extracting: 'Lấy tin nhắn và tệp từ file',
  uploading: 'Lưu lên kho Zalo Team',
  preparing: 'Chuẩn bị kho nhận dữ liệu',
  waiting: 'Đang chờ để tự tiếp tục',
};

export function ArchiveFileImport({
  accounts,
  onRefresh,
}: {
  accounts: ArchiveStatus['accounts'];
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [accountId, setAccountId] = useState(accounts[0]?.id || 0);
  const [selected, setSelected] = useState<string[]>([]),
    [uploadLimit, setUploadLimit] = useState<number | null>(null),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const initialized = useRef(false),
    polling = useRef(false);
  async function refresh() {
    if (polling.current) return;
    polling.current = true;
    try {
      const s = await archiveRequest<Status>({ kind: 'file-status' });
      setStatus(s);
      setError('');
      if (!initialized.current) {
        initialized.current = true;
        if (s.accountId) setAccountId(s.accountId);
        if (s.selected) setSelected(s.selected);
        setUploadLimit(s.uploadLimit ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa đọc được trạng thái.');
    } finally {
      polling.current = false;
    }
  }
  const activeImport =
    !!status &&
    (status.state.startsWith('queued-') ||
      ['unlocking', 'indexing', 'importing'].includes(status.state) ||
      status.picker?.state === 'opening');
  useEffect(() => {
    const stop = backgroundRead(refresh, activeImport ? 5000 : 60000);
    return () => stop();
  }, [activeImport]);
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      setStatus(await archiveRequest<Status>(body));
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setBusy(false);
    }
  }
  const running =
    !!status &&
    [
      'queued-index',
      'queued-unlock',
      'queued-import',
      'indexing',
      'unlocking',
      'importing',
    ].includes(status.state);
  const picking = status?.picker?.state === 'pending';
  const picked = status?.picker?.state === 'selected' ? status.picker : null;
  const list = (status?.conversations || []).filter((c) =>
    c.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  const results = Object.values(status?.results || {});
  const processed = results.reduce((n, r) => n + r.messages, 0);
  const total = (status?.conversations || [])
    .filter((c) => status?.selected?.includes(c.conversationId))
    .reduce((n, c) => n + c.messages, 0);
  return (
    <section className={styles.card}>
      <h2>Nhập từ file</h2>
      <p className={styles.hint}>
        Chọn file .zl.zip đã xuất từ Zalo PC, rồi chọn hội thoại cần nhập.
      </p>
      <div className={styles.fileImportForm}>
        <label>
          Tài khoản
          <TeamSelect
            aria-label="Tài khoản trong file xuất"
            value={accountId}
            disabled={running || busy || picking}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </TeamSelect>
        </label>
        <div className={styles.fileImportSource}>
          <span>File xuất Zalo</span>
          <div className={styles.fileImportPicker}>
            <ArchiveButton
              disabled={running || busy || picking || !accountId || !status?.supported}
              onClick={() => void act({ kind: 'file-pick', accountId })}
            >
              {picking ? 'Đang chọn file…' : 'Chọn file từ máy tính'}
            </ArchiveButton>
            <span className={styles.fileImportPicked} role="status">
              {picking
                ? 'Chọn file trong cửa sổ vừa mở.'
                : picked
                  ? `${picked.fileName} · ${bytes(picked.bytes || 0)}`
                  : 'Chưa chọn file'}
            </span>
          </div>
        </div>
        <ArchiveButton
          className={styles.primary}
          disabled={running || busy || picking || !picked || !accountId || !status?.supported}
          onClick={() => {
            setSelected([]);
            void act({ kind: 'file-open', accountId, selectionId: picked?.id });
          }}
        >
          Đọc file
        </ArchiveButton>
      </div>
      {status?.picker?.error && (
        <p role="alert" className={styles.error}>
          {status.picker.error}
        </p>
      )}
      {status?.supported === false && (
        <p className={styles.notice}>
          Chọn file cần bộ nhập chạy trên Windows. Mở Zalo Team qua localhost trên máy đó.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {status && status.state !== 'idle' && (
        <div className={styles.pcProgress} aria-live="polite">
          <strong>{titles[status.state] || 'Đang xử lý'}</strong>
          <p className={styles.hint}>
            {status.fileName} · {bytes(status.fileBytes || 0)} · {status.accountName}
          </p>
          {status.current && <p>{status.current}</p>}
          {running && (
            <p>
              {phases[status.phase || ''] || 'Đang chuẩn bị…'}
              {status.progress?.scanned
                ? ` · ${status.progress.scanned.toLocaleString('vi')} tin đã đọc`
                : ''}
              {status.progress?.processed
                ? ` · ${status.progress.processed} tin trong đợt này`
                : ''}
            </p>
          )}
          {!!status.uploadedBytes && (
            <p className={styles.hint}>
              Đã truyền {bytes(status.uploadedBytes)} lên Zalo Team
              {status.uploadLimit ? ` · Giới hạn ${bytes(status.uploadLimit)}` : ''}
            </p>
          )}
          {running && status.retry && (
            <p role="status" className={styles.hint}>
              {status.retry.reason === 'PC_ARCHIVE_BUSY'
                ? 'Kho đang bận với tác vụ khác.'
                : 'Kết nối với VPS đang gián đoạn.'}{' '}
              Tự thử lại sau {Math.max(0, Math.ceil((status.retry.nextAt - Date.now()) / 1000))}{' '}
              giây · Lần {status.retry.attempt}. Đã giữ phần chuẩn bị xong.
            </p>
          )}
          {running && status.performance && (
            <p className={styles.hint}>
              Trung bình lượt này: {status.performance.messagesPerSecond.toLocaleString('vi')}{' '}
              tin/giây · {bytes(status.performance.bytesPerSecond)}/giây
            </p>
          )}
          {total > 0 && (
            <p>
              Đã đối chiếu {processed.toLocaleString('vi')} / {total.toLocaleString('vi')} tin ·{' '}
              {results.filter((r) => r.complete).length} / {status.selected?.length} hội thoại
            </p>
          )}
          {status.error && (
            <p
              role={status.errorCode === 'FILE_STOPPED' ? 'status' : 'alert'}
              className={status.errorCode === 'FILE_STOPPED' ? styles.hint : styles.error}
            >
              {status.error}
            </p>
          )}
          {status.state === 'needs-unlock' && (
            <>
              <p className={styles.hint}>
                File được Zalo mã hóa. Mở đúng tài khoản trên Zalo PC; thao tác dưới đây khởi động
                lại PC một lần để lấy khóa. Sau đó nhập từ file, không cần giữ PC kết nối.
              </p>
              <ArchiveButton
                className={styles.primary}
                disabled={busy}
                onClick={() => void act({ kind: 'file-unlock', confirm: true })}
              >
                Mở khóa bằng Zalo PC
              </ArchiveButton>
            </>
          )}
          <div className={styles.actions}>
            {running && (
              <ArchiveButton
                disabled={busy || status.stopRequested}
                onClick={() => void act({ kind: 'file-stop' })}
              >
                {status.stopRequested ? 'Đang dừng…' : 'Dừng nhập'}
              </ArchiveButton>
            )}
            {status.state === 'paused' && (
              <>
                <ArchiveButton
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void act({ kind: 'file-start', resume: true, uploadLimit })}
                >
                  Tiếp tục
                </ArchiveButton>
                {['FILE_KEY_MISMATCH', 'FILE_KEY_UNAVAILABLE', 'FILE_ACCOUNT_MISMATCH'].includes(
                  status.errorCode || '',
                ) && (
                  <ArchiveButton
                    disabled={busy}
                    onClick={() => void act({ kind: 'file-unlock', confirm: true })}
                  >
                    Mở khóa lại bằng PC
                  </ArchiveButton>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {!!status?.conversations.length && (
        <>
          <div className={styles.fileImportToolbar}>
            <div>
              <strong>{status.conversations.length.toLocaleString('vi')} hội thoại</strong>
              <p className={styles.hint}>
                {status.summary?.messages.toLocaleString('vi')} tin · Đã loại{' '}
                {status.summary?.duplicates.toLocaleString('vi')} dòng trùng trong file
              </p>
            </div>
            <input
              aria-label="Tìm hội thoại trong file"
              placeholder="Tìm hội thoại"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.pcSelection}>
            <label className={styles.fileImportLimit}>
              Giới hạn tải lên{' '}
              <TeamSelect
                aria-label="Giới hạn tải lên"
                disabled={running || busy}
                value={uploadLimit ?? ''}
                onChange={(e) => setUploadLimit(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Không giới hạn</option>
                <option value="10000000000">10 GB</option>
                <option value="20000000000">20 GB</option>
                <option value="50000000000">50 GB</option>
              </TeamSelect>
            </label>
            <ArchiveButton
              disabled={running || busy}
              onClick={() => setSelected(list.map((c) => c.conversationId))}
            >
              Chọn {query ? 'kết quả tìm' : 'tất cả'}
            </ArchiveButton>
            <ArchiveButton
              disabled={running || busy || !selected.length}
              onClick={() => setSelected([])}
            >
              Bỏ chọn
            </ArchiveButton>
            <span>Đã chọn {selected.length} hội thoại</span>
          </div>
          <div className={styles.pcConversations}>
            {list.map((c) => (
              <label key={c.conversationId}>
                <input
                  type="checkbox"
                  checked={selected.includes(c.conversationId)}
                  disabled={running || busy}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, c.conversationId]
                        : old.filter((id) => id !== c.conversationId),
                    )
                  }
                />
                <span className={styles.fileImportName}>
                  <strong>{c.name}</strong>
                  <small>
                    {c.messages.toLocaleString('vi')} tin · {archiveDate(c.oldest)} →{' '}
                    {archiveDate(c.newest)}
                  </small>
                </span>
              </label>
            ))}
            {!list.length && <p className={styles.hint}>Không có hội thoại phù hợp.</p>}
          </div>
          <div className={styles.actions}>
            <ArchiveButton
              className={styles.primary}
              disabled={running || busy || !selected.length}
              onClick={() => void act({ kind: 'file-start', conversations: selected, uploadLimit })}
            >
              Nhập {selected.length || ''} hội thoại đã chọn
            </ArchiveButton>
            <span className={styles.hint}>Nhập lại sẽ đối chiếu tin và tệp đã lưu.</span>
          </div>
        </>
      )}
      {!!results.length && (
        <details className={styles.fileImportResults} open={status?.state === 'complete'}>
          <summary>
            Kết quả · {results.filter((r) => r.complete).length} / {results.length} hội thoại đã xử
            lý
          </summary>
          <div className={styles.pcResults}>
            {results.map((r, i) => (
              <div key={i}>
                <strong>{r.name}</strong>
                <p>
                  {r.messages.toLocaleString('vi')} tin đã đối chiếu ·{' '}
                  {r.added.toLocaleString('vi')} tin mới · {r.files.toLocaleString('vi')} tệp gồm
                  ảnh xem trước
                </p>
                {!!r.missing && (
                  <details>
                    <summary>{r.missing} mục chưa lưu đủ</summary>
                    <ul>
                      {(r.issues || []).map((issue, j) => (
                        <li key={j}>
                          <strong>{issue.name}</strong> · {archiveDate(issue.time)}
                          <br />
                          {reasons[issue.reason] || 'Chưa đọc được bản tệp hợp lệ'} · Mã tin{' '}
                          {issue.messageId}
                        </li>
                      ))}
                    </ul>
                    {r.missing > (r.issues?.length || 0) && (
                      <p className={styles.hint}>
                        Hiển thị tối đa 100 mục; tra cứu thêm tại tab Lưu trữ.
                      </p>
                    )}
                  </details>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
