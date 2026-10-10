'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Conversation } from '../types';
import { type PrivacyAction, type PrivacyState, ttlLabel } from '../conversation-privacy';
import { PanelSection } from './primitives';
import { TeamDialog } from './dialog';
import { LeaveGroup } from './group-management';
import { Icon } from './icon';
import { subscribeChanges, affects } from '../live';
import styles from '../zalo-team.module.css';

type Modal = 'ttl' | 'hide' | 'hidden-list' | 'report' | 'clear-history' | null;
const errors: Record<string, string> = {
  WEB_PIN_INVALID: 'Mã PIN không đúng.',
  WEB_PIN_RATE_LIMIT: 'Bạn đã nhập sai nhiều lần. Vui lòng thử lại sau 1 phút.',
  WEB_PIN_ALREADY_SET: 'Tài khoản đã có mã PIN. Hãy tải lại và dùng mã PIN hiện tại.',
  WEB_TTL_NOT_ALLOWED: 'Tài khoản không có quyền chọn thời hạn này.',
  WEB_CONVERSATION_HIDDEN: 'Hội thoại đã được ẩn.',
  WEB_HIDDEN_UNAVAILABLE: 'Tài khoản chưa hỗ trợ ẩn trò chuyện.',
};
export function ConversationPrivacy({
  conversation,
  onChanged,
  renderActions,
  onDismiss,
}: {
  conversation: Conversation;
  onChanged: () => void;
  renderActions?: (controls: {
    open: (modal: Modal) => Promise<boolean>;
    state: PrivacyState | null;
    modal: Modal;
    busy: boolean;
    error: string;
  }) => ReactNode;
  onDismiss?: () => void;
}) {
  const [state, setState] = useState<PrivacyState | null>(null),
    [modal, setModal] = useState<Modal>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(0),
    [pin, setPin] = useState(''),
    [confirmPin, setConfirmPin] = useState(''),
    [reason, setReason] = useState<number | null>(null),
    [content, setContent] = useState('');
  const [hiddenList, setHiddenList] = useState<{ id: string; name: string }[] | null>(null),
    [uncertain, setUncertain] = useState(false);
  const initialRead = useRef<Promise<PrivacyState> | null>(null);
  const readController = useRef<AbortController | null>(null);
  const openingLock = useRef(false);
  const [opening, setOpening] = useState(false);
  const locked = useRef(false),
    requestId = useRef('');
  const request = async (settings: PrivacyAction, signal?: AbortSignal) => {
    const response = await teamFetch('/api/zalo-team/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action: 'conversation-settings',
        accountId: conversation.accountId,
        conversationId: conversation.conversationId,
        settings,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'WEB_UNAVAILABLE');
    if (
      result.accountId !== conversation.accountId ||
      result.conversationId !== conversation.conversationId
    )
      throw Error('WEB_IDENTITY_MISMATCH');
    return result;
  };
  const load = () => request({ kind: 'privacy' }).then(setState);
  useEffect(() => {
    if (conversation.nativePreparation === 'loading') return;
    const controller = new AbortController();
    readController.current = controller;
    const reading = request({ kind: 'privacy' }, controller.signal);
    initialRead.current = reading;
    reading
      .then((result) => {
        if (!controller.signal.aborted) {
          setState(result);
          setError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Chưa tải được thiết lập bảo mật.');
      });
    return () => controller.abort();
  }, [conversation.accountId, conversation.conversationId, conversation.nativePreparation]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (conversation.nativePreparation === 'loading') return;
    const off = subscribeChanges((event) => {
      if (affects(event, 'privacy', conversation.accountId, conversation.conversationId)) {
        clearTimeout(timer);
        timer = setTimeout(() => load().catch(() => {}), 500);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [conversation.accountId, conversation.conversationId, conversation.nativePreparation]);
  const open = async (next: Modal): Promise<boolean> => {
    if (openingLock.current || locked.current) return false;
    openingLock.current = true;
    setOpening(true);
    try {
      const loaded = state || (await initialRead.current);
      if (readController.current?.signal.aborted) return false;
      if (!loaded) throw Error('NOT_READY');
      if ((next === 'hide' && !loaded.canHide) || (next === 'report' && !loaded.canReport)) {
        setError('Tài khoản chưa hỗ trợ thao tác này.');
        return false;
      }
      setError('');
      setNotice('');
      setPin('');
      setConfirmPin('');
      setReason(null);
      setContent('');
      setHiddenList(null);
      setDuration(loaded.ttl || 0);
      requestId.current = crypto.randomUUID();
      setUncertain(false);
      setModal(next);
      return true;
    } catch {
      if (!readController.current?.signal.aborted)
        setError('Chưa tải được thiết lập bảo mật. Vui lòng đóng menu và thử lại.');
      return false;
    } finally {
      openingLock.current = false;
      if (!readController.current?.signal.aborted) setOpening(false);
    }
  };
  const close = () => {
    if (!locked.current) {
      setModal(null);
      setPin('');
      setConfirmPin('');
      setHiddenList(null);
      onDismiss?.();
    }
  };
  const act = async (action: PrivacyAction) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await request(action);
      if (action.kind === 'hidden-list') {
        setHiddenList(result.hiddenConversations);
        return;
      }
      if (result.status !== 'confirmed') {
        setUncertain(true);
        throw Error('WEB_ACTION_UNKNOWN');
      }
      if (action.kind === 'unhide') {
        setHiddenList((list) => list?.filter((x) => x.id !== action.targetId) || []);
        setNotice('Đã bỏ ẩn trò chuyện.');
      } else {
        setModal(null);
        setPin('');
        setConfirmPin('');
        setNotice(
          action.kind === 'report'
            ? 'Đã gửi báo xấu.'
            : action.kind === 'clear-history'
              ? 'Đã xóa lịch sử trò chuyện.'
              : 'Đã cập nhật thiết lập.',
        );
      }
      onChanged();
      window.dispatchEvent(new CustomEvent('zalo-team-group-updated'));
      if (!['hide', 'clear-history'].includes(action.kind)) load().catch(() => {});
      if (!['hidden-list', 'unhide'].includes(action.kind)) onDismiss?.();
    } catch (e) {
      setError(
        errors[e instanceof Error ? e.message : ''] ||
          'Chưa xác nhận được kết quả. Hãy kiểm tra trạng thái trước khi thử lại.',
      );
      if (['clear-history', 'report'].includes(action.kind)) setUncertain(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const setup = modal === 'hide' && !state?.hasPin;
  const title =
    modal === 'ttl'
      ? 'Cài đặt tin nhắn tự xóa'
      : modal === 'hide'
        ? setup
          ? 'Đặt mã PIN'
          : 'Ẩn trò chuyện'
        : modal === 'hidden-list'
          ? 'Trò chuyện đã ẩn'
          : modal === 'report'
            ? 'Báo xấu'
            : 'Xác nhận';
  return (
    <>
      {renderActions ? (
        renderActions({ open, state, modal, busy: busy || opening, error })
      ) : (
        <>
          <PanelSection title="Thiết lập bảo mật" defaultOpen>
            <button
              className={`${styles.panelAction} ${styles.privacyTtl}`}
              disabled={!state?.canTtl}
              onClick={() => open('ttl')}
            >
              <Icon name="timer" size={20} />
              <span>
                Tin nhắn tự xóa{' '}
                <span
                  title="Tin nhắn mới sẽ tự xóa sau thời gian đã chọn."
                  aria-label="Thông tin tin nhắn tự xóa"
                >
                  ⓘ
                </span>
                <small>
                  {!state
                    ? 'Đang tải…'
                    : state.ttlReason === 'NOT_OWNER'
                      ? 'Chỉ dành cho trưởng nhóm'
                      : ttlLabel(state.ttl)}
                </small>
              </span>
            </button>
            <button
              className={styles.panelAction}
              role="switch"
              aria-checked={state?.hidden || false}
              disabled={!state?.canHide}
              onClick={() => open('hide')}
            >
              <Icon name="hideChat" size={20} />
              <span>Ẩn trò chuyện</span>
              <span className={styles.privacySwitch} data-active={state?.hidden} />
            </button>
          </PanelSection>
          <div className={styles.panelBlock}>
            <button
              className={styles.panelAction}
              disabled={!state?.canReport}
              onClick={() => open('report')}
            >
              <Icon name="report" size={20} />
              Báo xấu
            </button>
            <button
              className={`${styles.panelAction} ${styles.privacyDanger}`}
              disabled={!state}
              onClick={() => open('clear-history')}
            >
              <Icon name="trash" size={20} />
              Xóa lịch sử trò chuyện
            </button>
            {conversation.group && <LeaveGroup conversation={conversation} onChanged={onChanged} />}
          </div>
        </>
      )}
      {!renderActions && !modal && (error || notice) && (
        <p role="status" className={styles.messageNotice}>
          {error || notice}
          {error && (
            <button
              onClick={() => {
                setError('');
                load().catch(() => setError('Chưa tải được thiết lập bảo mật.'));
              }}
            >
              Thử lại
            </button>
          )}
        </p>
      )}
      {modal && (
        <TeamDialog
          title={title}
          onClose={close}
          className={`${styles.privacyDialog} ${modal === 'ttl' ? styles.privacyTtlDialog : ''}`}
        >
          <div className={styles.privacyBody}>
            {modal === 'ttl' && (
              <div role="radiogroup" aria-label="Thời gian tự xóa">
                {state?.durations.map((item) => (
                  <label className={styles.privacyOption} key={item.value}>
                    <input
                      type="radio"
                      name="ttl"
                      checked={duration === item.value}
                      disabled={!item.enabled || busy}
                      onChange={() => setDuration(item.value)}
                    />
                    {ttlLabel(item.value)}
                    {!item.enabled && <small>zBusiness</small>}
                  </label>
                ))}
              </div>
            )}
            {(modal === 'hide' || modal === 'hidden-list') && (
              <>
                <p>
                  {modal === 'hide'
                    ? 'Trò chuyện sẽ được ẩn khỏi danh sách tin nhắn. Chỉ có bạn mới có thể tìm thấy và mở lại chúng bằng cách sử dụng mã PIN.'
                    : 'Nhập mã PIN của Zalo để xem và bỏ ẩn trò chuyện trên tài khoản này.'}
                </p>
                {!hiddenList && (
                  <>
                    <label className={styles.privacyPinLabel}>
                      {setup ? 'Mã PIN mới' : 'Mã PIN'}
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        value={pin}
                        disabled={busy}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        aria-label={setup ? 'Mã PIN mới' : 'Mã PIN'}
                      />
                    </label>
                    {setup && (
                      <label className={styles.privacyPinLabel}>
                        Nhập lại mã PIN
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={4}
                          value={confirmPin}
                          disabled={busy}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        />
                      </label>
                    )}
                  </>
                )}
                {hiddenList && (
                  <div className={styles.privacyHiddenList}>
                    {hiddenList.length ? (
                      hiddenList.map((item) => (
                        <div key={item.id}>
                          <span>{item.name || 'Trò chuyện'}</span>
                          <button
                            disabled={busy}
                            onClick={() => act({ kind: 'unhide', pin, targetId: item.id })}
                          >
                            Bỏ ẩn
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>Không có trò chuyện đã ẩn.</p>
                    )}
                  </div>
                )}
              </>
            )}
            {modal === 'report' && (
              <>
                <p>
                  Bạn lo ngại về hội thoại này, chọn một trong những lý do dưới đây rồi gửi cho
                  chúng tôi.
                </p>
                <div role="radiogroup" aria-label="Lý do báo xấu">
                  {state?.reasons.map((item) => (
                    <label className={styles.privacyOption} key={item.id}>
                      <input
                        type="radio"
                        name="reason"
                        checked={reason === item.id}
                        disabled={busy || uncertain}
                        onChange={() => setReason(item.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                {reason === state?.otherReason && (
                  <textarea
                    aria-label="Nội dung báo xấu"
                    placeholder="Nhập lý do khác"
                    maxLength={1000}
                    value={content}
                    disabled={busy || uncertain}
                    onChange={(e) => setContent(e.target.value)}
                  />
                )}
              </>
            )}
            {modal === 'clear-history' && (
              <p>
                Toàn bộ nội dung trò chuyện với <strong>{conversation.name}</strong> sẽ bị xóa vĩnh
                viễn.
                <br />
                Bạn có chắc chắn muốn xóa?
              </p>
            )}
            {(error || notice) && (
              <p className={styles.privacyError} role="status">
                {error || notice}
              </p>
            )}
          </div>
          <footer className={styles.privacyFooter}>
            <button disabled={busy} onClick={close}>
              {modal === 'clear-history' ? 'Không' : 'Hủy'}
            </button>
            {modal === 'ttl' && (
              <button
                className={styles.privacyPrimary}
                disabled={busy || duration === state?.ttl}
                onClick={() => act({ kind: 'ttl', duration })}
              >
                Xác nhận
              </button>
            )}
            {modal === 'hide' && (
              <button
                className={styles.privacyPrimary}
                disabled={busy || pin.length !== 4 || (setup && pin !== confirmPin)}
                onClick={() => act({ kind: 'hide', pin, ...(setup ? { setup: true } : {}) })}
              >
                {setup ? 'Đặt mã PIN và ẩn' : 'Ẩn trò chuyện'}
              </button>
            )}
            {modal === 'hidden-list' && !hiddenList && (
              <button
                className={styles.privacyPrimary}
                disabled={busy || pin.length !== 4}
                onClick={() => act({ kind: 'hidden-list', pin })}
              >
                Xác nhận
              </button>
            )}
            {modal === 'report' && (
              <button
                className={styles.privacyPrimary}
                disabled={
                  busy ||
                  uncertain ||
                  reason === null ||
                  (reason === state?.otherReason && !content.trim())
                }
                onClick={() =>
                  reason !== null &&
                  act({ kind: 'report', reason, content, requestId: requestId.current })
                }
              >
                Báo xấu
              </button>
            )}
            {modal === 'clear-history' && (
              <button
                className={styles.privacyDelete}
                disabled={busy || uncertain}
                onClick={() => act({ kind: 'clear-history', requestId: requestId.current })}
              >
                Xóa
              </button>
            )}
          </footer>
        </TeamDialog>
      )}
    </>
  );
}
