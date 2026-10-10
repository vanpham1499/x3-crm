'use client';
import { useEffect, useRef, useState } from 'react';
import { archiveDate, archiveRequest } from '../archive';
import { TeamDialog } from './dialog';
import { ArchiveButton } from './archive-button';
import { ArchiveHistoryDialog } from './archive-history';
import styles from '../archive.module.css';

type Origin = {
  id: string;
  name: string;
  accountId: number;
  accountName: string;
  senderName: string;
  messageId: string;
};
type FileIssue = {
  id: string;
  name: string;
  kind: string;
  time: number;
  error: string;
  retryAt: string | null;
  sources: Origin[];
};
type FileResponse = { total: number; items: FileIssue[]; nextOffset: number | null };
export function ArchiveDayFiles({
  date,
  accountId,
  onClose,
}: {
  date: string;
  accountId?: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Origin | null>(null);
  const request = useRef<AbortController | null>(null);
  const retryOffset = useRef(0);
  async function load(offset = 0) {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    retryOffset.current = offset;
    setLoading(true);
    setError('');
    try {
      const result = await archiveRequest<FileResponse>(
        { kind: 'day-file-issues', date, accountId, offset },
        abort.signal,
      );
      if (!abort.signal.aborted)
        setData((old) => ({
          ...result,
          items: offset
            ? Array.from(
                new Map(
                  [...(old?.items || []), ...result.items].map((item) => [item.id, item]),
                ).values(),
              )
            : result.items,
        }));
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : 'Chưa tải được danh sách tệp.');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    setData(null);
    setHistory(null);
    void load();
    return () => request.current?.abort();
  }, [date, accountId]);
  return (
    <TeamDialog
      title={'Tệp chưa lấy được · ' + date.split('-').reverse().join('/')}
      onClose={onClose}
      className={styles.dayFilesDialog}
    >
      <div className={styles.dayFilesBody}>
        <div className={styles.dayFilesToolbar}>
          <span>{data ? `${data.total.toLocaleString('vi')} tệp gốc` : 'Đang tải danh sách…'}</span>
          <ArchiveButton disabled={loading} onClick={() => void load()}>
            Tải lại
          </ArchiveButton>
        </div>
        {error && (
          <div className={styles.dayFilesError} role="alert">
            <p>{error}</p>
            <ArchiveButton disabled={loading} onClick={() => void load(retryOffset.current)}>
              Thử lại
            </ArchiveButton>
          </div>
        )}
        {!loading && !error && data?.total === 0 && (
          <p className={styles.empty}>
            Không còn tệp chưa lấy được trong ngày và tài khoản đã chọn.
          </p>
        )}
        <ul className={styles.dayFilesList}>
          {data?.items.map((file) => (
            <li key={file.id}>
              <div className={styles.dayFileHeading}>
                <strong>{file.name}</strong>
                <time>{archiveDate(file.time)}</time>
              </div>
              {file.sources.map((source) => (
                <div className={styles.dayFileOrigin} key={source.id}>
                  <dl>
                    <div>
                      <dt>Hội thoại</dt>
                      <dd>{source.name}</dd>
                    </div>
                    <div>
                      <dt>Người gửi</dt>
                      <dd>{source.senderName}</dd>
                    </div>
                    <div>
                      <dt>Tài khoản Zalo</dt>
                      <dd>{source.accountName}</dd>
                    </div>
                  </dl>
                  <ArchiveButton onClick={() => setHistory(source)}>
                    Xem hội thoại trong ngày
                  </ArchiveButton>
                </div>
              ))}
              <p className={styles.dayFileReason}>
                <strong>Lý do:</strong> {file.error}
              </p>
              {file.retryAt && (
                <p className={styles.hint}>Tự thử lại: {archiveDate(file.retryAt)}</p>
              )}
            </li>
          ))}
        </ul>
        {loading && (
          <p role="status" className={styles.hint}>
            Đang tải tệp…
          </p>
        )}
        {data?.nextOffset != null && !error && (
          <ArchiveButton disabled={loading} onClick={() => void load(data.nextOffset!)}>
            Xem thêm tệp
          </ArchiveButton>
        )}
      </div>
      {history && (
        <ArchiveHistoryDialog
          source={history.id}
          name={history.name + ' · ' + history.accountName}
          date={date}
          onClose={() => setHistory(null)}
        />
      )}
    </TeamDialog>
  );
}
