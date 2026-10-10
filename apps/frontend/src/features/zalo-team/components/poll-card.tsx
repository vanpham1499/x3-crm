'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useRef, useState } from 'react';
import type { PollSummary } from '../polls';
import styles from '../zalo-team.module.css';
export function PollIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="3" height="10" rx="1" />
      <rect x="10.5" y="3" width="3" height="17" rx="1" />
      <rect x="17" y="7" width="3" height="13" rx="1" />
    </svg>
  );
}
export function PollCard({
  poll,
  messageId,
  accountId,
  conversationId,
}: {
  poll: PollSummary;
  messageId: string;
  accountId?: number;
  conversationId?: string;
}) {
  const [all, setAll] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false);
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function vote() {
    if (lock.current || !accountId || !conversationId) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await teamFetch('/api/zalo-team/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'poll-action',
          accountId,
          conversationId,
          requestId: crypto.randomUUID(),
          poll: { kind: 'vote', pollId: poll.id, optionIds: selected },
        }),
      });
      const data = await response.json();
      if (
        !response.ok ||
        data.status !== 'confirmed' ||
        data.accountId !== accountId ||
        data.conversationId !== conversationId
      )
        throw Error(data.error || 'unconfirmed');
      dialog.current?.close();
      window.dispatchEvent(
        new CustomEvent('zalo-team-poll-created', { detail: { accountId, conversationId } }),
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'WEB_POLL_CLOSED'
          ? 'Bình chọn đã kết thúc.'
          : code === 'WEB_CONVERSATION_NOT_FOUND'
            ? 'Không tìm thấy bình chọn trong nhóm này.'
            : code === 'INVALID_REQUEST'
              ? 'Phương án đã thay đổi. Đóng và mở lại bình chọn.'
              : 'Chưa xác nhận được kết quả. Đóng hộp và kiểm tra lại bình chọn.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <article data-message-id={messageId} className={styles.pollCard}>
      <div className={styles.pollCardHeading}>
        <strong>{poll.question}</strong>
      </div>
      <small>
        {poll.closed
          ? 'Bình chọn đã kết thúc'
          : poll.hideResults
            ? 'Kết quả được ẩn cho đến khi bình chọn'
            : poll.multiple
              ? 'Chọn nhiều phương án'
              : 'Chọn một phương án'}
      </small>
      {poll.expiredTime > 0 && (
        <small>
          Hết hạn:{' '}
          {new Date(poll.expiredTime).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </small>
      )}
      {poll.anonymous && <small>Ẩn người bình chọn</small>}
      {!poll.hideResults && poll.total > 0 && (
        <small className={styles.pollVoteTotal}>{poll.total} lượt bình chọn</small>
      )}
      <div className={styles.pollCardOptions}>
        {poll.options.slice(0, all ? undefined : 3).map((o) => (
          <div key={o.id} className={styles.pollCardOptionRow}>
            <div className={styles.pollCardOption}>
              <span style={{ width: `${poll.total ? (o.votes / poll.total) * 100 : 0}%` }} />
              <span>{o.text}</span>
              {o.voted && <b className={styles.pollChecked}>✓</b>}
            </div>
            {!poll.hideResults && <small>{o.votes}</small>}
          </div>
        ))}
      </div>
      {poll.options.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)}>
          {all ? 'Thu gọn' : `Xem thêm ${poll.options.length - 3} lựa chọn`}
        </button>
      )}
      <button
        type="button"
        className={styles.pollVoteButton}
        disabled={poll.closed || !accountId || !conversationId}
        onClick={() => {
          setSelected(poll.options.filter((o) => o.voted).map((o) => o.id));
          setError('');
          dialog.current?.showModal();
        }}
      >
        {poll.closed ? 'Bình chọn đã kết thúc' : poll.joined ? 'Đổi bình chọn' : 'Bình chọn'}
      </button>
      <dialog
        ref={dialog}
        aria-label="Bình chọn"
        className={`${styles.settingsDialog} ${styles.pollVoteDialog}`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header>
          <strong>Bình chọn</strong>
          <button
            type="button"
            aria-label="Đóng bình chọn"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className={styles.pollVoteBody}>
          <strong>{poll.question}</strong>
          <p>{poll.multiple ? 'Chọn nhiều phương án' : 'Chọn một phương án'}</p>
          {poll.options.map((o) => (
            <label key={o.id} className={styles.pollVoteOption}>
              <input
                type={poll.multiple ? 'checkbox' : 'radio'}
                name={`poll-${poll.id}`}
                checked={selected.includes(o.id)}
                disabled={busy || !!error}
                onChange={() =>
                  setSelected((old) =>
                    poll.multiple
                      ? old.includes(o.id)
                        ? old.filter((id) => id !== o.id)
                        : [...old, o.id]
                      : [o.id],
                  )
                }
              />
              <span>{o.text}</span>
              {!poll.hideResults && <small>{o.votes}</small>}
            </label>
          ))}
          {error && (
            <p role="alert" className={styles.pollError}>
              {error}
            </p>
          )}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>
            Hủy
          </button>
          <button
            type="button"
            className={styles.pollConfirm}
            disabled={busy || !!error || (!poll.joined && !selected.length)}
            onClick={() => void vote()}
          >
            {busy ? 'Đang gửi…' : 'Xác nhận'}
          </button>
        </footer>
      </dialog>
    </article>
  );
}
