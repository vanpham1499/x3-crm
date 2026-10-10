'use client';
import { useAccountAccess } from '../use-account-access';
import { useState } from 'react';
import { archiveDate, archiveRequest } from '../archive';
import { ArchiveButton } from './archive-button';
import { TeamDialog } from './dialog';
import styles from '../archive.module.css';

type Preview = {
  token: string;
  total: number;
  mode: 'cleanup' | 'restore';
  items: { id: string; name: string; role: string; time: number; source: string }[];
};
export function ArchiveCleanup({
  dismissed = 0,
  onRefresh,
}: {
  dismissed?: number;
  onRefresh?: () => Promise<void>;
}) {
  const access = useAccountAccess();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function open(mode: Preview['mode']) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await archiveRequest<Preview>({ kind: 'cleanup-preview', mode });
      setPreview(result);
      setSelected(result.items.map((i) => i.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa đọc được danh sách.');
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await archiveRequest<{ changed: number; skipped: number }>({
        kind: 'cleanup-apply',
        token: preview.token,
        assetIds: selected,
        confirm: true,
      });
      setNotice(
        `${preview.mode === 'restore' ? 'Đã đưa về hàng đợi' : 'Đã dọn'} ${result.changed} mục.${result.skipped ? ` ${result.skipped} mục đã thay đổi, được giữ lại.` : ''}`,
      );
      setPreview(null);
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setBusy(false);
    }
  }
  if (!access?.admin) return null;
  return (
    <>
      <ArchiveButton disabled={busy} onClick={() => void open('cleanup')}>
        Dọn dẹp
      </ArchiveButton>
      {!!dismissed && (
        <ArchiveButton disabled={busy} onClick={() => void open('restore')}>
          Đã dọn ({dismissed})
        </ArchiveButton>
      )}
      {notice && (
        <p role="status" className={styles.inlineNotice}>
          {notice}
        </p>
      )}
      {error && !preview && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {preview && (
        <TeamDialog
          title={preview.mode === 'restore' ? 'Các mục đã dọn' : 'Dọn mục không còn nguồn'}
          onClose={() => {
            if (!busy) setPreview(null);
          }}
          className={styles.cleanupDialog}
        >
          <div className={styles.cleanupBody}>
            <p className={styles.hint}>
              {preview.mode === 'restore'
                ? 'Đưa các mục đã chọn về hàng đợi để kiểm tra lại nguồn PC.'
                : 'Chỉ dọn mục hết nguồn tải và đã kiểm tra đủ tài khoản PC. Giữ tin nhắn, tệp đã lưu và có thể hoàn tác.'}
            </p>
            {preview.mode === 'cleanup' && (
              <p className={styles.hint}>
                Kết quả kiểm tra áp dụng cho nguồn PC đã đọc, không khẳng định tệp đã mất trên mọi
                thiết bị.
              </p>
            )}
            {!!preview.items.length && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={selected.length === preview.items.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? preview.items.map((i) => i.id) : [])
                  }
                />
                Chọn tất cả · {selected.length}/{preview.items.length}
              </label>
            )}
            <div className={styles.cleanupList}>
              {preview.items.map((item) => (
                <label key={item.id} className={styles.cleanupItem}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked ? [...old, item.id] : old.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.role} · {archiveDate(item.time)}
                    </small>
                    <small>{item.source}</small>
                  </span>
                </label>
              ))}
              {!preview.items.length && (
                <p className={styles.empty}>
                  {preview.mode === 'restore'
                    ? 'Chưa có mục đã dọn.'
                    : 'Chưa có mục đủ điều kiện. Các mục chờ kiểm tra PC hoặc lỗi kết nối được giữ lại.'}
                </p>
              )}
            </div>
            {preview.total > preview.items.length && (
              <p className={styles.hint}>
                Hiển thị {preview.items.length}/{preview.total} mục. Có thể dọn lượt tiếp theo sau
                khi hoàn tất.
              </p>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </div>
          <div className={styles.dialogFooter}>
            <ArchiveButton disabled={busy} onClick={() => setPreview(null)}>
              Đóng
            </ArchiveButton>
            <ArchiveButton
              className={styles.primary}
              disabled={busy || !selected.length}
              onClick={() => void apply()}
            >
              {busy
                ? 'Đang xử lý…'
                : preview.mode === 'restore'
                  ? `Đưa về hàng đợi (${selected.length})`
                  : `Dọn ${selected.length} mục`}
            </ArchiveButton>
          </div>
        </TeamDialog>
      )}
    </>
  );
}
