'use client';
import { TeamSelect } from './team-select';
import { useEffect, useRef, useState } from 'react';
import type { Conversation, ConversationListResponse } from '../types';
import { requestFriend, type FriendPerson } from '../friend-actions';
import { Avatar } from './avatar';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

type Props = {
  phone: string;
  accountId: string;
  accounts: ConversationListResponse['accounts'];
  onAccountChange: (id: string) => void;
  onOpen: (conversation: Conversation, anchor?: HTMLButtonElement) => void;
};
export function PhoneSearch({ phone, accountId, accounts, onAccountChange, onOpen }: Props) {
  const [result, setResult] = useState<{ key: string; person: FriendPerson } | null>(null);
  const [busy, setBusy] = useState(false),
    [opening, setOpening] = useState(false),
    [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const key = accountId + ':' + phone;
  const current = useRef(key);
  current.current = key;
  useEffect(
    () => () => {
      current.current = '';
    },
    [],
  );
  const account = accounts.find(
    (a) => String(a.id) === accountId && a.state === 'connected' && !a.error,
  );
  const person = result?.key === key ? result.person : null;
  useEffect(() => {
    const abort = new AbortController();
    setResult(null);
    setError('');
    setOpening(false);
    if (!accountId || !account) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      requestFriend(Number(accountId), { kind: 'search', phone }, abort.signal)
        .then((data) => {
          if (abort.signal.aborted) return;
          if (data.person) setResult({ key, person: data.person });
          else setError('Không tìm thấy tài khoản qua số điện thoại này.');
        })
        .catch((e) => {
          if (!abort.signal.aborted)
            setError(
              e.message === 'WEB_CONVERSATION_HIDDEN'
                ? 'Trò chuyện này đang được ẩn.'
                : 'Chưa tìm được tài khoản. Vui lòng thử lại.',
            );
        })
        .finally(() => {
          if (!abort.signal.aborted) setBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [phone, accountId, !!account, retry]);
  async function open(anchor?: HTMLButtonElement) {
    if (!person || !account || opening) return;
    setOpening(true);
    setError('');
    try {
      const data = await requestFriend(account.id, { kind: 'open', phone, userId: person.id });
      if (current.current !== key) return;
      if (
        data.status !== 'opened' ||
        !data.conversationId ||
        (!person.self && data.conversationId !== person.id)
      )
        throw Error();
      onOpen(
        {
          id: `${account.id}:${data.conversationId}`,
          accountId: account.id,
          accountName: account.name,
          accountAvatarSrc: account.avatarSrc,
          conversationId: data.conversationId,
          name: person.self ? 'My Documents' : person.name,
          avatarSrc: person.self ? '/zalo-team/my-documents.png' : person.avatarSrc,
          color: '#e5efff',
          preview: '',
          time: '',
        },
        anchor,
      );
    } catch {
      if (current.current === key) setError('Chưa mở được trò chuyện. Vui lòng thử lại.');
    } finally {
      if (current.current === key) setOpening(false);
    }
  }
  return (
    <section className={styles.phoneSearch} aria-label="Tìm bạn qua số điện thoại">
      <label className={styles.phoneSearchAccount}>
        <span>Tìm bằng</span>
        <TeamSelect
          aria-label="Tài khoản tìm số điện thoại"
          value={accountId}
          onChange={(e) => onAccountChange(e.target.value)}
          disabled={opening}
        >
          <option value="">Chọn tài khoản</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.state !== 'connected' || !!a.error}>
              {a.name}
            </option>
          ))}
        </TeamSelect>
      </label>
      {!accountId ? (
        <p>Chọn tài khoản để tìm và thao tác.</p>
      ) : busy ? (
        <p role="status">Đang tìm số điện thoại…</p>
      ) : (
        person && (
          <>
            <h3>Tìm bạn qua số điện thoại:</h3>
            <div className={styles.phoneSearchResult}>
              <button
                className={styles.phoneSearchPerson}
                onClick={() => void open()}
                disabled={opening}
                aria-label={
                  person.self
                    ? `Mở My Documents của ${account?.name}`
                    : `Nhắn tin với ${person.name} bằng ${account?.name}`
                }
              >
                <Avatar
                  conversation={{
                    name: person.name,
                    avatarSrc: person.avatarSrc,
                    color: '#e5efff',
                  }}
                  size={48}
                />
                <span>
                  <strong>
                    {person.name}
                    {person.self ? ' (Bạn)' : ''}
                  </strong>
                  <small>
                    Số điện thoại: {phone.startsWith('+84') ? '0' + phone.slice(3) : phone}
                  </small>
                </span>
              </button>
              {!person.self && (
                <button
                  className={styles.phoneSearchMore}
                  aria-label={`Thao tác với ${person.name} bằng ${account?.name}`}
                  disabled={opening}
                  onClick={(e) => void open(e.currentTarget)}
                >
                  <Icon name="more" size={16} />
                </button>
              )}
            </div>
            {opening && <p role="status">Đang mở trò chuyện…</p>}
          </>
        )
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
        </p>
      )}
    </section>
  );
}
