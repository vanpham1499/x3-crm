'use client';
import { backgroundRead } from '../request';
import { useEffect, useRef, useState } from 'react';
import { ZaloTeamShell } from './workspace-shell';
import { TeamManagementLayout } from './management-layout';
import { Icon } from './icon';
import { Avatar } from './avatar';
import { TeamDialog } from './dialog';
import { ArchiveHistoryDialog } from './archive-history';
import { ArchiveDays } from './archive-days';
import { ArchiveProgress } from './archive-progress';
import { ArchiveFileSummary } from './archive-file-summary';
import { ArchiveFileImport } from './archive-file-import';
import { ArchiveCleanup } from './archive-cleanup';
import { ArchiveServer } from './archive-server';
import {
  archiveRequest,
  archiveBytes,
  archiveDate,
  type ArchiveStatus,
  type ArchiveSource,
} from '../archive';
import styles from '../archive.module.css';
import teamStyles from '../zalo-team.module.css';
import { useAccountAccess } from '../use-account-access';
import { canAccount } from '../account-access';
import { ArchiveButton } from './archive-button';

const archiveTabs = [
  { id: 'sync', label: 'Đồng bộ', icon: 'rotate' },
  { id: 'storage', label: 'Lưu trữ', icon: 'documents' },
  { id: 'backup', label: 'Sao lưu', icon: 'cloud' },
  { id: 'server', label: 'Server', icon: 'settings' },
] as const;

export function ArchivePage() {
  const access = useAccountAccess();
  const canSync = !!access && (access.admin || Object.values(access.accounts).some((a) => a.sync));
  const [tab, setTab] = useState<'sync' | 'storage' | 'backup' | 'server'>('sync');
  const currentTab = useRef(tab);
  currentTab.current = tab;
  const activeTab = archiveTabs.find((item) => item.id === tab)!;
  const [canMonitorServer, setCanMonitorServer] = useState(false);
  const [serverRefresh, setServerRefresh] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [tab]);
  const [syncSource, setSyncSource] = useState<'web' | 'pc'>('web');
  const [data, setData] = useState<ArchiveStatus | null>(null);
  const [draft, setDraft] = useState<ArchiveStatus['settings'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<ArchiveSource | null>(null);
  const [restore, setRestore] = useState<string | null>(null);
  const [backupLimit, setBackupLimit] = useState(3);
  async function refresh(initial = false, signal?: AbortSignal) {
    try {
      const r = await archiveRequest<ArchiveStatus>(
        { kind: 'status', view: tab === 'server' ? 'sync' : tab },
        signal,
      );
      if (signal?.aborted || tab !== currentTab.current) return;
      setData(r);
      setCanMonitorServer(!!r.canMonitorServer);
      setDraft((old) => (initial || !old ? r.settings : old));
      setError('');
    } catch (e) {
      if (signal?.aborted || tab !== currentTab.current) return;
      setError(e instanceof Error ? e.message : 'Chưa tải được dữ liệu.');
    }
  }
  useEffect(() => {
    if (tab === 'server') return;
    const abort = new AbortController();
    setData(null);
    const stop = backgroundRead(() => refresh(false, abort.signal), 30000);
    return () => {
      abort.abort();
      stop();
    };
  }, [tab]);
  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await archiveRequest(body);
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ZaloTeamShell activePage="archive" label="Đồng bộ & sao lưu">
      <TeamManagementLayout
        title="Đồng bộ & sao lưu"
        navigationLabel="Quản lý dữ liệu"
        navigation={
          <>
            {archiveTabs
              .filter(
                ({ id }) =>
                  (id !== 'backup' || access?.admin) && (id !== 'server' || canMonitorServer),
              )
              .map(({ id, label, icon }) => (
                <button
                  key={id}
                  className={teamStyles.directoryTab}
                  aria-pressed={tab === id}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => setTab(id)}
                >
                  <span className={styles.tabIcon}>
                    <Icon name={icon} size={id === 'sync' ? 20 : 24} />
                  </span>
                  {label}
                </button>
              ))}
          </>
        }
      >
        <section className={styles.page} aria-label={activeTab.label}>
          <header className={teamStyles.directoryHeader}>
            <span className={styles.tabIcon}>
              <Icon name={activeTab.icon} size={tab === 'sync' ? 20 : 24} />
            </span>
            <h1>{activeTab.label}</h1>
            <button
              disabled={busy}
              aria-label={`Tải lại ${activeTab.label.toLocaleLowerCase('vi')}`}
              onClick={() => (tab === 'server' ? setServerRefresh((n) => n + 1) : void refresh())}
            >
              Tải lại
            </button>
          </header>
          <div className={styles.body} ref={bodyRef}>
            {error && tab !== 'server' && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            )}
            {tab === 'server' ? (
              <ArchiveServer refreshKey={serverRefresh} />
            ) : !data || !draft ? (
              <p>Đang tải kho lưu trữ…</p>
            ) : (
              <>
                {tab === 'sync' && (
                  <>
                    <div className={styles.sourceTabs} aria-label="Nguồn đồng bộ">
                      <ArchiveButton
                        aria-pressed={syncSource === 'web'}
                        onClick={() => setSyncSource('web')}
                      >
                        Zalo Web
                      </ArchiveButton>
                      <ArchiveButton
                        disabled={!access?.admin}
                        aria-pressed={syncSource === 'pc'}
                        onClick={() => setSyncSource('pc')}
                      >
                        Nhập từ file
                      </ArchiveButton>
                    </div>
                    {syncSource === 'pc' ? (
                      <>
                        <ArchiveFileImport
                          accounts={data.accounts}
                          onRefresh={() => void refresh()}
                        />
                      </>
                    ) : (
                      <>
                        <ArchiveProgress data={data} />
                        <details className={`${styles.card} ${styles.settingsPanel}`}>
                          <summary>Thiết lập đồng bộ Web</summary>
                          <label className={styles.check}>
                            <input
                              type="checkbox"
                              disabled={!canSync}
                              checked={draft.enabled}
                              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                            />
                            Bật đồng bộ nền
                          </label>
                          <label className={styles.check}>
                            <input
                              type="checkbox"
                              disabled={!access?.admin}
                              checked={draft.media}
                              onChange={(e) => setDraft({ ...draft, media: e.target.checked })}
                            />
                            Tự tải tệp đính kèm
                          </label>
                          <h3>Tài khoản đồng bộ</h3>
                          {!data.accounts.length && (
                            <p>Chưa đọc được tài khoản. Kiểm tra trang Liên kết tài khoản.</p>
                          )}
                          <div className={styles.syncAccounts}>
                            {data.accounts.map((a) => (
                              <label className={styles.account} key={a.id}>
                                <input
                                  type="checkbox"
                                  disabled={!access || !canAccount(access, a.id, 'sync')}
                                  checked={draft.accounts.includes(a.id)}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      accounts: e.target.checked
                                        ? [...draft.accounts, a.id]
                                        : draft.accounts.filter((id) => id !== a.id),
                                    })
                                  }
                                />
                                <Avatar
                                  conversation={{
                                    name: a.name,
                                    avatarSrc: a.avatarSrc,
                                    color: '#dae7f5',
                                  }}
                                  size={32}
                                />
                                <span>
                                  {a.name}
                                  <small>
                                    {a.status === 'connected' ? 'Đang kết nối' : 'Chưa kết nối'}
                                  </small>
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className={styles.actions}>
                            <ArchiveButton
                              className={styles.primary}
                              disabled={busy || !canSync}
                              onClick={() =>
                                void act(
                                  {
                                    kind: 'configure',
                                    enabled: draft.enabled,
                                    media: draft.media,
                                    daily_backup: draft.daily_backup,
                                    accounts: draft.accounts.filter(
                                      (id) => !!access && canAccount(access, id, 'sync'),
                                    ),
                                  },
                                  'Đã lưu thiết lập đồng bộ.',
                                )
                              }
                            >
                              Lưu thiết lập
                            </ArchiveButton>
                            <ArchiveButton
                              disabled={busy || !canSync || !data.settings.enabled}
                              onClick={() =>
                                void act(
                                  { kind: 'sync' },
                                  'Đã yêu cầu đồng bộ. Tiến trình nền sẽ cập nhật kết quả tại đây.',
                                )
                              }
                            >
                              Đồng bộ ngay
                            </ArchiveButton>
                          </div>
                        </details>
                      </>
                    )}
                  </>
                )}
                {tab === 'storage' && (
                  <>
                    <div className={styles.metrics}>
                      <section>
                        <strong>{data.stats.messages.toLocaleString('vi')}</strong>
                        <span>Tin nhắn</span>
                      </section>
                      <section>
                        <strong>{archiveBytes(data.stats.bytes)}</strong>
                        <span>Dung lượng đã lưu</span>
                      </section>
                      <section>
                        <strong>{data.stats.savedMessages.toLocaleString('vi')}</strong>
                        <span>Tin tránh lưu trùng</span>
                      </section>
                      <section>
                        <strong>{archiveBytes(data.stats.savedBytes)}</strong>
                        <span>Dung lượng tiết kiệm</span>
                      </section>
                    </div>
                    <div className={styles.storageToolbar}>
                      <span>Dữ liệu đã lưu</span>
                      <div className={styles.actions}>
                        {access?.admin && (
                          <ArchiveCleanup
                            dismissed={data.fileSummary?.dismissed}
                            onRefresh={() => refresh()}
                          />
                        )}
                      </div>
                    </div>
                    <ArchiveDays data={data} />
                  </>
                )}
                {tab === 'backup' && (
                  <>
                    <section className={styles.card}>
                      <h2>Bản sao lưu</h2>
                      <p className={styles.hint}>
                        {data.storageLocation === 'vps'
                          ? 'Lưu trên VPS Zalo · Chưa có bản dự phòng độc lập'
                          : 'Lưu trên máy này · Chưa có bản dự phòng ngoài máy'}
                      </p>
                      <div className={styles.backupToolbar}>
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            checked={draft.daily_backup}
                            onChange={(e) => setDraft({ ...draft, daily_backup: e.target.checked })}
                          />
                          Tự động sao lưu mỗi ngày
                        </label>
                        <div className={styles.actions}>
                          <ArchiveButton
                            disabled={busy}
                            onClick={() =>
                              void act(
                                {
                                  kind: 'configure',
                                  enabled: draft.enabled,
                                  media: draft.media,
                                  daily_backup: draft.daily_backup,
                                  accounts: draft.accounts,
                                },
                                'Đã lưu lịch sao lưu.',
                              )
                            }
                          >
                            Lưu lịch
                          </ArchiveButton>
                          <ArchiveButton
                            className={styles.primary}
                            disabled={busy}
                            onClick={() =>
                              void act(
                                { kind: 'backup' },
                                'Đã xếp lịch sao lưu. Theo dõi kết quả bên dưới.',
                              )
                            }
                          >
                            Sao lưu ngay
                          </ArchiveButton>
                        </div>
                      </div>
                      <h3 className={styles.listHeading}>
                        Các bản sao lưu ({data.backups.length})
                      </h3>
                      <div className={styles.backupList}>
                        {data.backups.slice(0, backupLimit).map((b) => (
                          <div className={styles.source} key={b.id}>
                            <span>
                              <strong>{archiveDate(b.created_at)}</strong>
                              <small>
                                {
                                  (
                                    {
                                      ready: 'Đã tạo',
                                      pending: 'Đang chờ',
                                      running: 'Đang sao lưu',
                                      failed: 'Chưa hoàn tất',
                                    } as Record<string, string>
                                  )[b.state]
                                }{' '}
                                · Tin nhắn {archiveBytes(b.bytes)}
                              </small>
                              <small>
                                {b.verified_at
                                  ? 'Đã xác minh: ' + archiveDate(b.verified_at)
                                  : b.error}
                              </small>
                            </span>
                            {b.state === 'ready' && (
                              <div className={styles.actions}>
                                <ArchiveButton
                                  disabled={busy}
                                  onClick={() =>
                                    void act(
                                      { kind: 'verify', backupId: b.id },
                                      'Bản sao lưu đọc được; mã kiểm tra nội dung khớp.',
                                    )
                                  }
                                >
                                  Kiểm tra
                                </ArchiveButton>
                                <ArchiveButton disabled={busy} onClick={() => setRestore(b.id)}>
                                  Khôi phục
                                </ArchiveButton>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {data.backups.length > backupLimit && (
                        <ArchiveButton onClick={() => setBackupLimit((n) => n + 5)}>
                          Xem thêm ({data.backups.length - backupLimit})
                        </ArchiveButton>
                      )}
                      {!data.backups.length && <p className={styles.empty}>Chưa có bản sao lưu.</p>}
                    </section>
                  </>
                )}
              </>
            )}
          </div>
          {history && (
            <ArchiveHistoryDialog
              source={history.id}
              name={history.name + ' · ' + history.account_name}
              onClose={() => setHistory(null)}
            />
          )}
          {restore && (
            <TeamDialog
              title="Khôi phục dữ liệu đã lưu"
              onClose={() => setRestore(null)}
              className={styles.confirmDialog}
            >
              <p>
                Khôi phục tin nhắn và file còn thiếu từ bản sao lưu này? Tin hiện có và trạng thái
                đã xóa sẽ được giữ nguyên.
              </p>
              <div className={styles.actions}>
                <ArchiveButton onClick={() => setRestore(null)}>Hủy</ArchiveButton>
                <ArchiveButton
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => {
                    const id = restore;
                    setRestore(null);
                    void act(
                      { kind: 'restore', backupId: id, confirm: true },
                      'Đã bổ sung dữ liệu còn thiếu từ bản sao lưu.',
                    );
                  }}
                >
                  Khôi phục
                </ArchiveButton>
              </div>
            </TeamDialog>
          )}
        </section>
      </TeamManagementLayout>
    </ZaloTeamShell>
  );
}
