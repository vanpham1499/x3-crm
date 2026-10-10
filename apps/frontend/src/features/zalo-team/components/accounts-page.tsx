'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { TeamSelect } from './team-select';
import { AccountPermissions, type AccessDirectory } from './account-permissions';
import { accessRequest } from '../use-account-access';

import { useEffect, useRef, useState } from 'react';
import { ZaloTeamShell } from './workspace-shell';
import { TeamManagementLayout } from './management-layout';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { SearchInput } from './primitives';
import { TeamDialog } from './dialog';
import type { AccountStatus, LinkedAccount, WebSnapshot } from '../account-types';
import styles from '../zalo-team.module.css';
import layout from '../management-layout.module.css';

const statusLabels: Record<AccountStatus, string> = {
  connected: 'Đang kết nối',
  offline: 'Mất kết nối',
  expired: 'Cần đăng nhập lại',
  connecting: 'Đang kết nối lại',
};
const errorLabels: Record<string, string> = {
  WEB_ACCESS_DENIED: 'Bạn không còn quyền thao tác với tài khoản này. Hãy tải lại danh sách.',
  CRM_LOGIN_REQUIRED: 'Bạn cần đăng nhập CRM để liên kết tài khoản Zalo.',
  CRM_UNAVAILABLE: 'Chưa kết nối được CRM. Hãy kiểm tra backend rồi thử lại.',
  WEB_NOT_PREPARED: 'Môi trường Zalo Web chưa được chuẩn bị trên máy này.',
  WEB_START_TIMEOUT: 'Zalo Web chưa khởi động xong. Hãy thử lại.',
  WEB_START_FAILED: 'Không mở được Zalo Web trên máy này.',
  WEB_UNAVAILABLE: 'Bộ kết nối Zalo Web chưa chạy. Hãy khởi động dịch vụ Docker Zalo Team.',
  WEB_OWNED_BY_ANOTHER_USER: 'Phiên thử nghiệm này đã được liên kết bởi một người dùng CRM khác.',
  WEB_VERIFICATION_REQUIRED: 'Zalo yêu cầu xác minh bổ sung. Chưa thể tiếp tục bằng mã QR này.',
  WEB_UNEXPECTED_PAGE: 'Zalo chuyển đến trang chưa được bộ kết nối hỗ trợ.',
  ACCOUNT_ALREADY_LINKED: 'Tài khoản này đã được liên kết. Hãy quét bằng một tài khoản Zalo khác.',
  ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản đã chọn. Hãy tải lại danh sách.',
  LOGIN_IN_PROGRESS: 'Có một yêu cầu đăng nhập đang mở. Hãy hoàn tất hoặc hủy trước.',
  LOGIN_REQUEST_CHANGED: 'Yêu cầu đăng nhập đã thay đổi. Hãy mở lại Thêm liên kết.',
  LOGIN_NOT_READY: 'Zalo Web đang xử lý đăng nhập. Hãy chờ rồi thử lại.',
};
const loginLabels: Record<string, string> = {
  starting: 'Đang mở Zalo Web…',
  waiting_scan: 'Quét mã QR bằng Zalo trên điện thoại',
  confirming: 'Xác nhận đăng nhập trên điện thoại',
  connecting: 'Đang xác thực với Zalo Web…',
  expired: 'Mã QR đã hết hạn',
  connected: 'Đã liên kết tài khoản thành công',
  offline: 'Đã nhận phiên, đang chờ kết nối Zalo',
  identity_mismatch: 'Tài khoản vừa quét không khớp tài khoản đã liên kết.',
  blocked: 'Chưa mở được phiên Zalo Web. Hãy thử lại.',
  stopped: 'Phiên Zalo Web đã tạm dừng.',
};
async function requestWeb(
  action: string,
  loginId?: string,
  accountId?: number,
  departmentId?: number,
): Promise<WebSnapshot> {
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ...(departmentId ? { departmentId } : {}),
      ...(loginId ? { loginId } : {}),
      ...(accountId ? { accountId } : {}),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
  return data;
}
export function AccountsPage() {
  const [permissions, setPermissions] = useState<LinkedAccount | null>(null);
  const [directory, setDirectory] = useState<AccessDirectory | null>(null);
  const [department, setDepartment] = useState('');
  const [chooseTeam, setChooseTeam] = useState(false);
  useEffect(() => {
    void accessRequest({ kind: 'read' })
      .then(setDirectory)
      .catch(() => {});
  }, []);
  const [snapshot, setSnapshot] = useState<WebSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState<'link' | 'stop' | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<LinkedAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const revision = useRef(0);
  const operation = useRef(false);
  const alive = useRef(true);
  const accounts = snapshot?.accounts || [];
  const login = snapshot?.login;
  const remainingSeconds = login ? Math.max(0, Math.ceil((login.expiresAt - clock) / 1000)) : 0;
  const loginState =
    login &&
    ['starting', 'connecting', 'waiting_scan', 'confirming'].includes(login.state) &&
    remainingSeconds === 0
      ? 'expired'
      : login?.state;
  const visible = accounts.filter(
    (a) =>
      (!status || a.status === status) &&
      a.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (dialog !== 'link') return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [dialog, login?.id]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.hidden || !navigator.onLine) {
        timer = setTimeout(poll, 30000);
        return;
      }
      const version = revision.current;
      if (!operation.current)
        try {
          const result = await requestWeb('status');
          if (!cancelled && version === revision.current) {
            setSnapshot(result);
            setError('');
          }
        } catch (e) {
          if (!cancelled && version === revision.current)
            setError(e instanceof Error ? e.message : 'WEB_UNAVAILABLE');
        } finally {
          if (!cancelled) setLoaded(true);
        }
      if (!cancelled) timer = setTimeout(poll, dialog === 'link' ? 2000 : 30000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dialog]);
  async function act(action: string, accountId?: number) {
    if (operation.current) return;
    operation.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      const result = await requestWeb(
        action,
        ['retry', 'cancel'].includes(action) ? login?.id : undefined,
        accountId,
        !accountId && department ? Number(department) : undefined,
      );
      if (alive.current) {
        setSnapshot(result);
        return true;
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'WEB_UNAVAILABLE');
    } finally {
      operation.current = false;
      if (alive.current) {
        setBusy(false);
        setLoaded(true);
      }
    }
    return false;
  }
  function begin(account?: LinkedAccount) {
    if (!account && !snapshot?.access?.admin && !department) {
      setChooseTeam(true);
      return;
    }
    setSelectedAccount(account || null);
    setDialog('link');
    void act('begin', account?.id);
  }
  async function close() {
    if (busy) return;
    if (dialog === 'link' && login && login.state !== 'connected') {
      if (!(await act('cancel'))) return;
    }
    setDialog(null);
  }
  const errorMessage =
    errorLabels[error] || (error ? 'Chưa kết nối được Zalo Web. Hãy thử lại.' : '');
  return (
    <ZaloTeamShell activePage="accounts" label="Liên kết tài khoản Zalo Team">
      <TeamManagementLayout
        title="Liên kết tài khoản"
        navigationLabel="Điều hướng liên kết tài khoản"
        navigation={
          <>
            <button
              className={styles.directoryTab}
              aria-pressed="true"
              aria-current="page"
              onClick={() => {
                setSearch('');
                setStatus('');
              }}
            >
              <Icon name="contact" size={24} />
              Danh sách tài khoản
            </button>
            <button
              className={styles.directoryTab}
              disabled={busy || !snapshot?.access?.canLink}
              onClick={() => begin()}
            >
              <Icon name="addContact" size={24} />
              Thêm liên kết
            </button>
          </>
        }
      >
        <section
          className={`${styles.directoryMain} ${layout.main}`}
          aria-labelledby="accounts-heading"
        >
          <header className={styles.directoryHeader}>
            <Icon name="contact" size={24} />
            <h1 id="accounts-heading">Danh sách tài khoản</h1>
            <button
              aria-label="Tải lại tài khoản"
              disabled={busy}
              onClick={() => void act('status')}
            >
              Tải lại
            </button>
          </header>
          <div className={`${styles.directoryBody} ${layout.body}`}>
            {errorMessage && (
              <div className={styles.accountNotice} role="alert">
                {errorMessage}{' '}
                {error === 'CRM_LOGIN_REQUIRED' && <a href="/login">Đăng nhập CRM</a>}
              </div>
            )}
            <h3>Tài khoản ({accounts.length})</h3>
            <section
              className={`${styles.accountsCard} ${layout.card}`}
              aria-label="Danh sách tài khoản"
            >
              <div className={styles.accountsToolbar}>
                <div className={`${styles.accountFilters} ${layout.filters}`}>
                  <SearchInput
                    label="Tìm kiếm tên tài khoản"
                    placeholder="Tìm kiếm tên tài khoản"
                    value={search}
                    onValueChange={setSearch}
                  />
                  <label className={styles.accountSelect}>
                    <TeamSelect
                      aria-label="Trạng thái tài khoản"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </TeamSelect>
                  </label>
                </div>
              </div>
              <div className={styles.accountsTableScroll}>
                <table className={styles.accountsTable}>
                  <thead>
                    <tr>
                      <th scope="col">STT</th>
                      <th scope="col">Tài khoản Zalo</th>
                      <th scope="col">Phòng ban quản lý</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((account: LinkedAccount, index) => (
                      <tr key={account.externalId}>
                        <td>{index + 1}</td>
                        <td>
                          <div className={styles.accountIdentity}>
                            <Avatar conversation={account} />
                            <div>
                              <strong>{account.name}</strong>
                              <p>ID Zalo: {account.externalId}</p>
                              <p>Kiểm tra: {new Date(account.updatedAt).toLocaleString('vi-VN')}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {account.access?.departmentName ||
                            directory?.departments.find(
                              (d) =>
                                d.id ===
                                directory.accounts.find((a) => a.account_id === account.id)
                                  ?.department_id,
                            )?.name ||
                            'Chưa phân công'}
                        </td>
                        <td>
                          <span className={styles.accountStatus} data-status={account.status}>
                            <span />
                            {statusLabels[account.status]}
                          </span>
                        </td>
                        <td>
                          <div className={styles.accountActions}>
                            {(snapshot?.access?.admin || account.access?.manage) && (
                              <button
                                className={styles.secondaryButton}
                                onClick={() => setPermissions(account)}
                              >
                                Phân quyền
                              </button>
                            )}
                            <button
                              className={styles.secondaryButton}
                              disabled={
                                busy ||
                                (account.status === 'connected'
                                  ? !snapshot?.access?.admin
                                  : !account.access?.link)
                              }
                              onClick={
                                account.status === 'connected'
                                  ? () => {
                                      setSelectedAccount(account);
                                      setDialog('stop');
                                    }
                                  : () => begin(account)
                              }
                            >
                              {account.status === 'connected' ? 'Tạm dừng' : 'Kết nối lại'}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              disabled={busy}
                              onClick={() => void act('status', account.id)}
                            >
                              Kiểm tra
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visible.length && (
                      <tr>
                        <td colSpan={5} className={styles.accountEmpty}>
                          <Icon name="member" size={40} />
                          <strong>
                            {!loaded
                              ? 'Đang kiểm tra tài khoản…'
                              : accounts.length
                                ? 'Không tìm thấy tài khoản'
                                : 'Chưa có tài khoản nào'}
                          </strong>
                          <span>
                            {accounts.length
                              ? 'Thử tên hoặc trạng thái khác.'
                              : 'Bấm Thêm liên kết để đăng nhập Zalo Web bằng mã QR.'}
                          </span>
                          {accounts.length > 0 && (
                            <button
                              className={styles.secondaryButton}
                              onClick={() => {
                                setSearch('');
                                setStatus('');
                              }}
                            >
                              Xóa bộ lọc
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className={styles.accountFooter}>
                Hiển thị {visible.length} / {accounts.length} tài khoản
              </footer>
            </section>
          </div>
        </section>
      </TeamManagementLayout>
      {permissions && (
        <AccountPermissions
          id={permissions.id}
          name={permissions.name}
          onClose={() => setPermissions(null)}
          onSaved={() => {
            void accessRequest({ kind: 'read' }).then(setDirectory);
            void act('status');
          }}
        />
      )}
      {chooseTeam && (
        <TeamDialog title="Chọn phòng ban quản lý" onClose={() => setChooseTeam(false)}>
          <div className={styles.confirmBody}>
            <TeamSelect
              aria-label="Phòng ban liên kết Zalo"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Chọn phòng ban</option>
              {directory?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </TeamSelect>
            <div className={styles.dialogActions}>
              <button
                className={styles.primaryButton}
                disabled={!department}
                onClick={() => {
                  setChooseTeam(false);
                  begin();
                }}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </TeamDialog>
      )}
      {dialog && (
        <TeamDialog
          title={dialog === 'link' ? 'Liên kết tài khoản Zalo' : 'Tạm dừng Zalo Web'}
          onClose={() => void close()}
        >
          {dialog === 'link' ? (
            <>
              <div className={styles.qrTab}>Đăng nhập bằng mã QR · Zalo Web</div>
              <div className={styles.qrContent}>
                {login?.qr && !error && !busy && loginState === 'waiting_scan' ? (
                  <div className={styles.qrImage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={login.qr} alt="Mã QR đăng nhập Zalo Web" width={220} height={220} />
                  </div>
                ) : (
                  <div className={styles.qrPlaceholder}>
                    <Icon name={login?.state === 'connected' ? 'member' : 'screenshot'} size={48} />
                    <span>{login?.state === 'connected' ? login.name : 'Mã QR đăng nhập'}</span>
                  </div>
                )}
                <p className={styles.qrUnavailable} role="status">
                  {errorMessage ||
                    (snapshot?.runtime.error && errorLabels[snapshot.runtime.error]) ||
                    (busy
                      ? 'Đang xử lý…'
                      : loginLabels[loginState || 'starting'] || 'Đang chuẩn bị đăng nhập…')}
                </p>
                {loginState === 'waiting_scan' && !error && !busy && (
                  <>
                    <p role="timer" aria-live="off">
                      Lượt đăng nhập còn {Math.floor(remainingSeconds / 60)}:
                      {String(remainingSeconds % 60).padStart(2, '0')}
                    </p>
                    <p>Quét mã mới bằng ứng dụng Zalo. Ảnh QR gửi qua chat không tự cập nhật.</p>
                    <p>Phiên Zalo Web khác của cùng tài khoản có thể bị đăng xuất.</p>
                  </>
                )}
                <div className={styles.qrActions}>
                  {login?.state === 'connected' ? (
                    <button className={styles.primaryButton} onClick={() => setDialog(null)}>
                      Hoàn tất
                    </button>
                  ) : (
                    <>
                      <button
                        className={styles.secondaryButton}
                        disabled={busy}
                        onClick={() => void close()}
                      >
                        Hủy
                      </button>
                      {([
                        'waiting_scan',
                        'expired',
                        'blocked',
                        'stopped',
                        'identity_mismatch',
                      ].includes(loginState || '') ||
                        !!error) && (
                        <button
                          className={styles.primaryButton}
                          disabled={busy || error === 'CRM_LOGIN_REQUIRED'}
                          onClick={() =>
                            void act(
                              login ? 'retry' : 'begin',
                              login ? undefined : selectedAccount?.id,
                            )
                          }
                        >
                          {['waiting_scan', 'expired'].includes(loginState || '')
                            ? 'Lấy mã mới'
                            : 'Thử lại'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.confirmBody}>
              <p>Tạm dừng kết nối tài khoản {selectedAccount?.name} trên máy này?</p>
              <p>Phiên và dữ liệu đã lưu được giữ lại để kết nối lần sau.</p>
              <div className={styles.dialogActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Hủy
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={busy}
                  onClick={async () => {
                    if (await act('stop', selectedAccount?.id)) setDialog(null);
                  }}
                >
                  Tạm dừng
                </button>
              </div>
            </div>
          )}
        </TeamDialog>
      )}
    </ZaloTeamShell>
  );
}
