'use client';
import { useEffect, useState } from 'react';
import { archiveRequest } from '../archive';
import { ArchiveButton } from './archive-button';
import styles from '../server.module.css';

type Capacity = { total: number; used: number; available: number; percent: number };
type Sample = { at: number; cpu: number | null; ram: number; disk: number };
type Metrics = {
  sampledAt: number;
  stale: boolean;
  servicesAvailable: boolean;
  host: {
    name: string;
    address: string;
    cores: number;
    cpuPercent: number | null;
    uptime: number;
    load: number[];
    memory: Capacity & { swapTotal: number; swapUsed: number };
    disk: Capacity & { reserved?: number };
  };
  services: {
    name: string;
    state: string;
    memoryUsed?: number;
    memoryLimit?: number;
    cpuPercent?: number;
  }[];
  storage: { sampledAt: number; items: Record<string, number | null> };
  history: Sample[];
  drive?: {
    enabled: boolean;
    excludedTestAccounts?: number;
    worker?: { at: number; error: string | null } | null;
    evictionEnabled?: boolean;
    cacheLimit?: number;
    objects?: number;
    verified?: number;
    verifiedBytes?: number;
    pending?: number;
    failed?: number;
    lastVerified?: string | null;
  };
};
const percent = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
const bytes = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n >= 1024 ** 3
      ? `${(n / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GiB`
      : `${(n / 1024 ** 2).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MiB`;
const time = (n: number) =>
  new Date(n * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const tone = (n: number | null) =>
  n == null ? 'unknown' : n >= 90 ? 'high' : n >= 80 ? 'warn' : 'normal';
const status = (n: number | null) =>
  n == null ? 'Chưa có số liệu' : n >= 90 ? 'Gần đầy tải' : n >= 80 ? 'Cần theo dõi' : 'Còn dư địa';

function Chart({
  history,
  field,
  label,
}: {
  history: Sample[];
  field: 'cpu' | 'ram' | 'disk';
  label: string;
}) {
  const samples = history.filter((s) => s[field] != null);
  const start = history[0]?.at ?? 0;
  const span = Math.max(1, (history.at(-1)?.at ?? start) - start);
  const points = samples
    .map(
      (s) =>
        `${((s.at - start) / span) * 600},${95 - Math.min(100, Math.max(0, s[field]!)) * 0.85}`,
    )
    .join(' ');
  return (
    <svg
      viewBox="0 0 600 105"
      className={styles.chart}
      role="img"
      aria-label={`${label}: lịch sử các mẫu đã ghi, thang 0 đến 100%`}
    >
      <path d="M0 10H600 M0 52.5H600 M0 95H600" stroke="#e7edf5" fill="none" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {samples.length === 1 && (
        <circle cx="0" cy={95 - samples[0][field]! * 0.85} r="3" fill="currentColor" />
      )}
    </svg>
  );
}

export function ArchiveServer({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let pending = false;
    async function read() {
      if (pending || document.hidden) return;
      pending = true;
      setLoading(true);
      try {
        const result = await archiveRequest<Metrics>({ kind: 'server-status' });
        if (active) {
          setData(result);
          setError('');
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Chưa kết nối được server.');
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void read();
    const timer = setInterval(() => void read(), 30000);
    const visible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refreshKey, retry]);

  if (!data)
    return (
      <section className={styles.panel} aria-live="polite">
        <p>{error || 'Đang lấy số liệu VPS…'}</p>
        {error && (
          <ArchiveButton disabled={loading} onClick={() => setRetry((n) => n + 1)}>
            Thử lại
          </ArchiveButton>
        )}
      </section>
    );
  const stale = !!error || data.stale || Date.now() / 1000 - data.sampledAt > 90;
  const { host, history } = data;
  const cards = [
    {
      label: 'CPU',
      value: host.cpuPercent,
      detail: `${host.cores} vCPU`,
      sub: 'Mức sử dụng toàn máy chủ',
      field: 'cpu' as const,
    },
    {
      label: 'RAM',
      value: host.memory.percent,
      detail: `${bytes(host.memory.used)} / ${bytes(host.memory.total)}`,
      sub: `Còn dùng được ${bytes(host.memory.available)}`,
      field: 'ram' as const,
    },
    {
      label: 'Ổ đĩa',
      value: host.disk.percent,
      detail: `${bytes(host.disk.used)} / ${bytes(host.disk.total)}`,
      sub: `Còn trống ${bytes(host.disk.available)}`,
      field: 'disk' as const,
    },
  ];
  return (
    <div className={styles.server}>
      <div className={styles.heading}>
        <div>
          <h2>
            {host.name} <span>{host.address}</span>
          </h2>
          <p>
            {host.cores} vCPU · {bytes(host.memory.total)} RAM · {bytes(host.disk.total)} ổ đĩa
          </p>
        </div>
        <div className={styles.updated}>
          <strong data-tone={stale ? 'warn' : 'normal'}>
            {stale ? 'Số liệu chưa cập nhật' : 'Đang theo dõi'}
          </strong>
          <span>{time(data.sampledAt)} · Mỗi 30 giây</span>
        </div>
      </div>
      {stale && (
        <div className={styles.warning} role="alert">
          {error || 'Chưa có số liệu mới.'} Đang hiển thị lần đo gần nhất.{' '}
          <ArchiveButton disabled={loading} onClick={() => setRetry((n) => n + 1)}>
            Thử lại
          </ArchiveButton>
        </div>
      )}
      <section className={styles.metric}>
        <div className={styles.metricTitle}>
          <h3>Kho Google Drive</h3>
          <span data-tone={data.drive?.enabled ? 'normal' : 'warn'}>
            {data.drive?.enabled ? 'Đã cấu hình' : 'Chưa kết nối'}
          </span>
        </div>
        {data.drive?.enabled ? (
          <>
            {(!data.drive.worker ||
              data.drive.worker.error ||
              Date.now() / 1000 - data.drive.worker.at > 180) && (
              <p role="status">
                {data.drive.worker?.error
                  ? 'Kết nối Drive cần kiểm tra. Tệp trên VPS vẫn được giữ nguyên.'
                  : 'Đang chờ bộ chuyển tệp gửi trạng thái.'}
              </p>
            )}
            <p>
              {bytes(data.drive.verifiedBytes)} đã kiểm chứng · {data.drive.verified ?? 0} tệp
            </p>
            <p>
              {data.drive.pending ?? 0} đang chuyển · {data.drive.failed ?? 0} cần thử lại
            </p>
            {!!data.drive.excludedTestAccounts && (
              <p className={styles.footnote}>
                Bỏ qua {data.drive.excludedTestAccounts} tài khoản thử nghiệm.
              </p>
            )}
            {!!data.drive.failed && (
              <ArchiveButton
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await archiveRequest({ kind: 'drive-retry' });
                    setRetry((n) => n + 1);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Chưa yêu cầu thử lại được.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Thử chuyển lại
              </ArchiveButton>
            )}
          </>
        ) : (
          <p className={styles.footnote}>
            Chưa kết nối Drive. Dữ liệu đang lưu trên VPS.
          </p>
        )}
      </section>
      <div className={styles.cards}>
        {cards.map((c) => (
          <section className={styles.metric} key={c.field}>
            <div className={styles.metricTitle}>
              <h3>{c.label}</h3>
              <span data-tone={stale ? 'unknown' : tone(c.value)}>
                {stale ? 'Mẫu cũ' : status(c.value)}
              </span>
            </div>
            <strong className={styles.value}>{percent(c.value)}</strong>
            <div
              className={styles.track}
              role="meter"
              aria-label={`${c.label} đã sử dụng`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={c.value ?? undefined}
            >
              <i style={{ width: `${c.value ?? 0}%` }} data-tone={tone(c.value)} />
            </div>
            <p className={styles.detail}>{c.detail}</p>
            <p>{c.sub}</p>
          </section>
        ))}
      </div>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <h3>Lịch sử tài nguyên</h3>
          <span>Tối đa 24 giờ · {history.length} mẫu</span>
        </div>
        <div className={styles.charts}>
          {cards.map((c) => {
            const values = history.map((s) => s[c.field]).filter((v): v is number => v != null);
            return (
              <div key={c.field}>
                <div className={styles.sectionHeading}>
                  <strong>{c.label}</strong>
                  <span>Đỉnh {percent(values.length ? Math.max(...values) : null)}</span>
                </div>
                <Chart history={history} field={c.field} label={c.label} />
              </div>
            );
          })}
        </div>
        <p className={styles.footnote}>
          {history.length > 0
            ? `${time(history[0].at)} → ${time(history[history.length - 1].at)}`
            : 'Đang ghi mẫu đầu tiên.'}{' '}
          · Từ khi bật giám sát.
        </p>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <h3>Dịch vụ Zalo</h3>
          {!data.servicesAvailable ? (
            <p role="status">Chưa đọc được số liệu dịch vụ Docker.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>Trạng thái</th>
                    <th>RAM / giới hạn</th>
                    <th>CPU¹</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>
                        <span data-tone={s.state === 'running' ? 'normal' : 'warn'}>
                          {s.state === 'running'
                            ? 'Đang chạy'
                            : s.state === 'exited'
                              ? 'Đã dừng'
                              : s.state === 'restarting'
                                ? 'Khởi động lại'
                                : s.state === 'missing'
                                  ? 'Chưa cài'
                                  : s.state}
                        </span>
                      </td>
                      <td>
                        {bytes(s.memoryUsed)} / {bytes(s.memoryLimit)}
                      </td>
                      <td>{percent(s.cpuPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.footnote}>
            ¹ CPU: 100% = 1 vCPU. RAM dịch vụ không tính cache.
          </p>
        </section>
        <section className={styles.panel}>
          <h3>Dung lượng dữ liệu</h3>
          <dl className={styles.sizes}>
            {[
              ['archive', 'Kho tin nhắn & tệp'],
              ['backups', 'Bản sao lưu'],
              ['database', 'Cơ sở dữ liệu'],
              ['profiles', 'Phiên Zalo Web'],
              ['docker', 'Docker & bộ nhớ đệm'],
              ['migration', 'Gói chuyển dữ liệu tạm'],
              ['system', 'Hệ điều hành & phần còn lại'],
            ].map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{bytes(data.storage.items[key])}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.footnote}>
            Cập nhật {time(data.storage.sampledAt)} · Mỗi 5 phút.
          </p>
          <div className={styles.extra}>
            <span>Swap</span>
            <strong>
              {host.memory.swapTotal
                ? `${bytes(host.memory.swapUsed)} / ${bytes(host.memory.swapTotal)}`
                : 'Chưa cấu hình'}
            </strong>
          </div>
        </section>
      </div>
    </div>
  );
}
