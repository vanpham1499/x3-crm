'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { TeamSelect } from './team-select';
import { useRef, useState } from 'react';
import type { ConversationListResponse } from '../types';
import {
  internationalPhone,
  requestFriend,
  type FriendPerson,
  type FriendAction,
} from '../friend-actions';
import { TeamDialog } from './dialog';
import { GroupDialog } from './group-dialog';
import { Avatar } from './avatar';
import styles from '../zalo-team.module.css';

type Props = {
  kind: 'friend' | 'group';
  accounts: ConversationListResponse['accounts'];
  initialAccountId?: number;
  target?: FriendPerson;
  onSent?: () => void;
  onOpenSelf?: (accountId: number, conversationId: string) => void;
  onClose: () => void;
};
export function InboxCreateDialog({
  kind,
  accounts,
  initialAccountId,
  target,
  onSent,
  onOpenSelf,
  onClose,
}: Props) {
  const available = accounts.filter((a) => a.state === 'connected' && !a.error);
  const [accountId, setAccountId] = useState(
    String(available.find((a) => a.id === initialAccountId)?.id ?? available[0]?.id ?? ''),
  );
  const account = available.find((a) => String(a.id) === accountId);
  const [groupOpen, setGroupOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [person, setPerson] = useState<FriendPerson | null>(target || null);
  const [message, setMessage] = useState(
    target
      ? `Xin chào, mình là ${account?.name || ''}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`.slice(
          0,
          150,
        )
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  const receipt = useRef<string | null>(null);
  const normalized = internationalPhone(phone);
  const valid = !!target || /^\+[1-9]\d{7,14}$/.test(normalized);
  function resetResult() {
    setPerson(null);
    setError('');
    setNotice('');
    setUncertain(false);
    receipt.current = null;
  }
  async function run(send = false) {
    if (
      !account ||
      !valid ||
      locked.current ||
      (send &&
        (!person ||
          person.self ||
          person.isFriend ||
          person.requested ||
          person.incoming ||
          !message.trim() ||
          uncertain))
    )
      return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    if (send) receipt.current ||= crypto.randomUUID();
    const friend: FriendAction = send
      ? {
          kind: 'send',
          ...(target ? {} : { phone: normalized }),
          userId: person!.id,
          message: message.trim(),
        }
      : target
        ? { kind: 'status', userId: target.id }
        : { kind: 'search', phone: normalized };
    try {
      const response = await teamFetch('/api/zalo-team/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'friend-action',
          accountId: account.id,
          friend,
          requestId: send ? receipt.current : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
      if (data.accountId !== account.id) throw Error('WEB_IDENTITY_MISMATCH');
      if (data.status === 'not-found') {
        setPerson(null);
        setError(
          'Không tìm thấy tài khoản. Kiểm tra số điện thoại hoặc quyền tìm kiếm của người nhận.',
        );
        return;
      }
      if (data.person) setPerson(data.person);
      if (!send) {
        setMessage(
          `Xin chào, mình là ${account.name}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`.slice(
            0,
            150,
          ),
        );
        if (data.person?.requested) setNotice('Đã gửi lời mời kết bạn.');
        setUncertain(false);
        receipt.current = null;
      } else if (data.status === 'confirmed') {
        setNotice(data.person?.isFriend ? 'Hai bạn đã là bạn bè.' : 'Đã gửi lời mời kết bạn.');
        onSent?.();
      } else if (data.status === 'rejected') {
        setError(
          `Zalo chưa cho phép gửi lời mời${data.nativeCode ? ` (mã ${data.nativeCode})` : ''}. Vui lòng kiểm tra lại sau.`,
        );
        setUncertain(true);
      } else {
        setUncertain(true);
        setError(
          'Chưa xác nhận được kết quả gửi. Bấm Kiểm tra trạng thái trước khi thao tác tiếp.',
        );
      }
    } catch {
      if (send) setUncertain(true);
      setError(
        send
          ? 'Chưa xác nhận được kết quả gửi. Bấm Kiểm tra trạng thái để kiểm tra, tránh gửi trùng.'
          : 'Chưa tìm được tài khoản. Vui lòng kiểm tra kết nối và thử lại.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    if (!locked.current) onClose();
  };
  async function openSelf() {
    if (!account || !person?.self || busy) return;
    setBusy(true);
    try {
      const data = await requestFriend(account.id, {
        kind: 'open',
        phone: normalized,
        userId: person.id,
      });
      if (data.status !== 'opened' || !data.conversationId) throw Error();
      onOpenSelf?.(account.id, data.conversationId);
      onClose();
    } catch {
      setError('Chưa mở được My Documents. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  if (groupOpen && account) return <GroupDialog account={account} onClose={onClose} />;
  const canSend =
    person &&
    !person.self &&
    !person.isFriend &&
    !person.requested &&
    !person.incoming &&
    !uncertain;
  return (
    <TeamDialog
      title={kind === 'friend' ? (person ? 'Thông tin tài khoản' : 'Thêm bạn') : 'Tạo nhóm'}
      onClose={close}
      className={styles.inboxCreateDialog}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (kind === 'group') {
            if (account) setGroupOpen(true);
          } else void run(!!person && !uncertain);
        }}
      >
        {person && (
          <div className={styles.friendProfileCover}>
            {person.coverSrc && (
              <img
                src={person.coverSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        )}
        <div className={`${styles.inboxCreateBody} ${person ? styles.friendProfileBody : ''}`}>
          {!person && (
            <label className={styles.inboxAccountLabel}>
              Tài khoản
              <TeamSelect
                aria-label="Tài khoản thực hiện"
                value={accountId}
                disabled={busy || !!target}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  resetResult();
                }}
              >
                {!available.length && <option value="">Chưa có tài khoản kết nối</option>}
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </TeamSelect>
            </label>
          )}
          {kind === 'friend' && (
            <>
              {!target && !person && (
                <label className={styles.friendPhoneLabel}>
                  Số điện thoại
                  <div className={styles.friendPhone}>
                    <span>VN (+84)</span>
                    <input
                      aria-label="Số điện thoại"
                      type="tel"
                      autoFocus
                      placeholder="Số điện thoại"
                      value={phone}
                      disabled={busy}
                      maxLength={24}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        resetResult();
                      }}
                    />
                  </div>
                </label>
              )}
              {person && (
                <>
                  <div className={styles.friendPerson}>
                    <Avatar
                      conversation={{
                        name: person.name,
                        avatarSrc: person.avatarSrc,
                        color: '#e5efff',
                      }}
                      size={80}
                    />
                    <div>
                      <strong>{person.name}</strong>
                      <small>
                        {person.self
                          ? 'Đây là tài khoản của bạn'
                          : person.isFriend
                            ? 'Bạn bè'
                            : person.requested
                              ? 'Đã gửi lời mời'
                              : person.incoming
                                ? 'Người này đã gửi lời mời kết bạn cho bạn'
                                : `Gửi bằng ${account?.name}`}
                      </small>
                    </div>
                  </div>
                  {canSend && (
                    <div className={styles.friendGreeting}>
                      <textarea
                        aria-label="Lời chào kết bạn"
                        placeholder="Nhập lời chào..."
                        value={message}
                        maxLength={150}
                        disabled={busy}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                      <small>{message.length}/150 ký tự</small>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={styles.friendError}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className={styles.friendNotice}>
              {notice}
            </p>
          )}
        </div>
        <footer className={styles.inboxCreateFooter}>
          <button type="button" disabled={busy} onClick={close}>
            {notice ? 'Đóng' : 'Hủy'}
          </button>
          {person && !target && !notice && (
            <button type="button" disabled={busy} onClick={resetResult}>
              Quay lại
            </button>
          )}
          {person?.self && onOpenSelf && (
            <button
              type="button"
              className={styles.inboxCreatePrimary}
              disabled={busy}
              onClick={() => void openSelf()}
            >
              My Documents
            </button>
          )}
          {kind === 'group' ? (
            <button type="submit" className={styles.inboxCreatePrimary} disabled={!account}>
              Tiếp tục
            </button>
          ) : (
            (!person || canSend || uncertain) && (
              <button
                type="submit"
                className={styles.inboxCreatePrimary}
                disabled={busy || !account || !valid || (!!canSend && !message.trim())}
              >
                {busy
                  ? 'Đang xử lý…'
                  : uncertain
                    ? 'Kiểm tra trạng thái'
                    : person
                      ? 'Kết bạn'
                      : 'Tìm kiếm'}
              </button>
            )
          )}
        </footer>
      </form>
    </TeamDialog>
  );
}
