'use client';
import { ListPagination } from './list-pagination';
import { TeamDatePicker } from './team-date-picker';
import { backgroundRead } from '../request';
import { useEffect, useState } from 'react';
import {
  archiveRequest,
  archiveBytes,
  type ArchiveDay,
  type ArchiveSource,
  type ArchiveStatus,
} from '../archive';
import { TeamSelect } from './team-select';
import { ArchiveHistoryDialog } from './archive-history';
import styles from '../archive.module.css';
import { ArchiveButton } from './archive-button';
import { ArchiveDayFiles } from './archive-day-files';

type DayResponse = {
  pagination?: { offset: number; limit: number; total: number };
  days: ArchiveDay[];
  sources: (ArchiveSource & { messages: number })[];
};
const dayLabel = (date: string) => date.split('-').reverse().join('/');
export function ArchiveDays({ data }: { data: ArchiveStatus }) {
  const [account, setAccount] = useState('');
  const [filter, setFilter] = useState('');
  const [days, setDays] = useState<ArchiveDay[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<DayResponse['sources']>([]);
  const [history, setHistory] = useState<ArchiveSource | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const limit = 14;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [retrying, setRetrying] = useState('');
  const [notice, setNotice] = useState('');
  const [filesDate, setFilesDate] = useState('');
  async function retry(date: string) {
    setRetrying(date);
    setNotice('');
    setError('');
    try {
      await archiveRequest({
        kind: 'retry-files',
        date,
        ...(account ? { accountId: Number(account) } : {}),
      });
      setNotice('Đã yêu cầu kiểm tra lại tệp ngày ' + dayLabel(date) + '.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setRetrying('');
    }
  }
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setDays([]);
    setSelected('');
    setFilesDate('');
    setHistory(null);
    setError('');

    async function refresh() {
      try {
        const r = await archiveRequest<DayResponse>(
          {
            kind: 'days',
            limit,
            offset: page * limit,
            includeSources: false,
            ...(filter ? { date: filter } : {}),
            ...(account ? { accountId: Number(account) } : {}),
          },
          abort.signal,
        );
        if (!abort.signal.aborted) {
          const filtered = r.days.filter((d) => !filter || d.date === filter);
          const lastPage = Math.max(
            0,
            Math.ceil((r.pagination?.total ?? filtered.length) / limit) - 1,
          );
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setDays(r.pagination ? r.days : filtered.slice(page * limit, (page + 1) * limit));
          setTotal(r.pagination?.total ?? filtered.length);
          setError('');
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Chưa tải được thống kê.');
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    const stop = backgroundRead(refresh, 30000);
    return () => {
      abort.abort();
      stop();
    };
  }, [account, filter, page]);
  useEffect(() => {
    const abort = new AbortController();
    setDetail([]);
    if (!selected) return;
    setDetailLoading(true);
    archiveRequest<DayResponse>(
      { kind: 'days', date: selected, ...(account ? { accountId: Number(account) } : {}) },
      abort.signal,
    )
      .then((r) => {
        if (!abort.signal.aborted) setDetail(r.sources);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setDetailLoading(false);
      });
    return () => abort.abort();
  }, [selected, account, data.settings.last_sync]);
  const visible = days.filter((d) => !filter || d.date === filter);
  return (
    <section className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>Lưu trữ theo ngày</h2>
        </div>
        <span className={styles.pill}>{loading ? 'Đang tải…' : `${total} ngày`}</span>
      </div>
      <div className={styles.dayFilters}>
        <label>
          Tài khoản
          <TeamSelect
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setPage(0);
            }}
            aria-label="Tài khoản lưu trữ"
          >
            <option value="">Tất cả tài khoản</option>
            {Array.from(new Map(data.sources.map((s) => [s.account_id, s.account_name]))).map(
              ([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ),
            )}
          </TeamSelect>
        </label>
        <div>
          <TeamDatePicker
            label="Ngày tin nhắn"
            compact
            labelPlacement="above"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(0);
              setSelected('');
            }}
          />
        </div>
        {filter && (
          <ArchiveButton
            onClick={() => {
              setFilter('');
              setPage(0);
            }}
          >
            Xem tất cả ngày
          </ArchiveButton>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tổng hợp dữ liệu…</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.dayTable}>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Hội thoại</th>
                  <th>Tin nhắn</th>
                  <th>Tệp gốc đã lưu</th>
                  <th>Dung lượng</th>
                  <th>Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map((d) => (
                  <tr key={d.date} data-selected={selected === d.date || undefined}>
                    <td>
                      <ArchiveButton
                        className={styles.dayLink}
                        aria-expanded={selected === d.date}
                        onClick={() => setSelected(selected === d.date ? '' : d.date)}
                      >
                        {dayLabel(d.date)}
                      </ArchiveButton>
                    </td>
                    <td>{d.conversations.toLocaleString('vi')}</td>
                    <td>{d.messages.toLocaleString('vi')}</td>
                    <td>
                      <strong>
                        {d.ready.toLocaleString('vi')} / {d.files.toLocaleString('vi')}
                      </strong>
                      <progress
                        max={d.files || 1}
                        value={d.ready}
                        aria-label={'Tệp đã lưu ngày ' + dayLabel(d.date)}
                      />
                    </td>
                    <td>
                      {archiveBytes(d.bytes)}
                      <small>{d.blobs} tệp vật lý, gồm ảnh xem trước</small>
                    </td>
                    <td>
                      {d.failed ? (
                        <ArchiveButton
                          className={styles.dayFileCount}
                          aria-haspopup="dialog"
                          aria-label={`Xem ${d.failed} tệp chưa lấy được ngày ${dayLabel(d.date)}`}
                          onClick={() => setFilesDate(d.date)}
                        >
                          {d.failed} tệp chưa lấy được
                        </ArchiveButton>
                      ) : (
                        <span className={styles.pill}>
                          {d.pending
                            ? `${d.pending} tệp chờ`
                            : d.dismissed
                              ? `${d.dismissed} mục đã dọn`
                              : d.files
                                ? 'Đã lưu tệp ghi nhận'
                                : 'Chưa ghi nhận tệp gốc'}
                        </span>
                      )}
                      {!!d.dismissed && (d.failed > 0 || d.pending > 0) && (
                        <small>{d.dismissed} mục đã dọn</small>
                      )}
                      {d.failed > 0 && (
                        <ArchiveButton
                          className={styles.retryDay}
                          disabled={!!retrying}
                          onClick={() => void retry(d.date)}
                        >
                          {retrying === d.date ? 'Đang xếp lại…' : 'Thử lại'}
                        </ArchiveButton>
                      )}
                      <small>
                        {d.unscanned
                          ? `${d.unscanned} hội thoại chưa quét tới ngày này`
                          : 'Đã quét tới ngày này'}
                        {d.gaps ? ` · ${d.gaps} hội thoại đang bù lịch sử` : ''}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className={styles.empty}>Chưa ghi nhận tin nhắn trong phạm vi đã chọn.</p>
          )}
          <ListPagination page={page} limit={limit} total={total} onPage={setPage} busy={loading} />
        </>
      )}
      {selected && (
        <section className={styles.dayDetail}>
          <div className={styles.sectionHeading}>
            <h3>Hội thoại ngày {dayLabel(selected)}</h3>
            <ArchiveButton onClick={() => setSelected('')}>Thu gọn</ArchiveButton>
          </div>
          {detailLoading ? (
            <p role="status">Đang tải hội thoại…</p>
          ) : (
            detail.map((s) => (
              <ArchiveButton key={s.id} className={styles.source} onClick={() => setHistory(s)}>
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.account_name}</small>
                </span>
                <span>{s.messages.toLocaleString('vi')} tin · Xem bản lưu</span>
              </ArchiveButton>
            ))
          )}
        </section>
      )}
      {filesDate && (
        <ArchiveDayFiles
          date={filesDate}
          accountId={account ? Number(account) : undefined}
          onClose={() => setFilesDate('')}
        />
      )}
      {history && (
        <ArchiveHistoryDialog
          source={history.id}
          name={history.name + ' · ' + history.account_name}
          date={selected}
          onClose={() => setHistory(null)}
        />
      )}
    </section>
  );
}
