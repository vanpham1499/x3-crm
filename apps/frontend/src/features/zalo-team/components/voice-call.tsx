'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CallMedia } from '../call-media';
import { useAccountAccess } from '../use-account-access';
import { canAccount } from '../account-access';
import type { Conversation } from '../types';
import { Avatar } from './avatar';
import { Icon, IconButton } from './icon';
import styles from '../voice-call.module.css';

type Scope = { accountId: number; conversationId: string };
type Run = {
  scope: Scope;
  media: CallMedia;
  closed: boolean;
  sessionId?: string;
  timer?: ReturnType<typeof setTimeout>;
  connectedAt?: number;
};
async function request(action: string, scope?: Scope, data: Record<string, unknown> = {}) {
  const response = await fetch('/api/zalo-team/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...scope, ...data }),
    keepalive: action === 'end',
    signal: AbortSignal.timeout(action === 'capabilities' ? 32000 : 18000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'CALL_UNAVAILABLE');
  return result;
}
const errors: Record<string, string> = {
  WEB_ACCESS_DENIED: 'Bạn chưa được cấp quyền gọi bằng tài khoản Zalo này.',
  NotAllowedError: 'Bạn cần cho phép Chrome sử dụng micro.',
  NotFoundError: 'Không tìm thấy micro.',
  CALL_UNAVAILABLE: 'Dịch vụ gọi điện chưa sẵn sàng.',
  CALL_START_FAILED: 'Chưa khởi động được dịch vụ gọi điện. Vui lòng thử lại.',
  CALL_WORKER_BUSY: 'Đang có một cuộc gọi khác. Vui lòng thử lại sau.',
  CALL_PEER_UNAVAILABLE: 'Không thể gọi tới cuộc trò chuyện này.',
  CALL_REJECTED: 'Người nhận đã từ chối cuộc gọi.',
  CALL_NO_ANSWER: 'Người nhận chưa trả lời.',
  CALL_SIGNAL_LOST: 'Kết nối cuộc gọi đã bị gián đoạn.',
  CALL_MEDIA_CLOSED: 'Cuộc gọi đã kết thúc.',
  CALL_AUDIO_NOT_CONNECTED: 'Chrome chưa kết nối được âm thanh. Hãy đóng cuộc gọi và thử lại.',
  CALL_UDP_TIMEOUT: 'Không nhận được phản hồi từ máy chủ cuộc gọi Zalo. Vui lòng thử lại.',
  CALL_NEGOTIATION_FAILED: 'Zalo chưa chấp nhận cuộc gọi. Vui lòng thử lại sau ít giây.',
  CALL_SESSION_NOT_FOUND: 'Phiên gọi đã hết hạn. Hãy mở lại cuộc gọi.',
  CALL_SESSION_EXPIRED: 'Phiên gọi đã hết hạn. Hãy mở lại cuộc gọi.',
  AUDIO_FORMAT_UNSUPPORTED: 'Không xử lý được âm thanh từ micro đang chọn.',
  AUDIO_CLOCK_FAILED: 'Bộ phát âm thanh chưa khởi động được. Vui lòng thử lại.',
  AUDIO_ICE_TIMEOUT: 'Không thiết lập được đường âm thanh. Vui lòng gọi lại.',
  AUDIO_CONNECTION_LOST: 'Kết nối âm thanh đã bị ngắt.',
  CALL_CODEC_UNSUPPORTED: 'Thiết bị nhận chưa dùng định dạng âm thanh được hỗ trợ.',
};
function message(error: unknown) {
  const e = error as Error;
  console.warn('[Zalo Team call]', /^[A-Z_]+$/.test(e.message) ? e.message : e.name);
  return errors[e.name] || errors[e.message] || 'Không thể kết nối cuộc gọi. Vui lòng thử lại.';
}
function release(run: Run) {
  if (run.closed) return;
  run.closed = true;
  clearTimeout(run.timer);
  run.media.close();
  if (run.sessionId) void request('end', run.scope, { sessionId: run.sessionId }).catch(() => {});
}

export type VoiceCallHandle = { start: () => void };
export const VoiceCall = forwardRef<
  VoiceCallHandle,
  {
    conversation: Conversation;
    onAvailability?: (available: boolean) => void;
  }
>(function VoiceCall({ conversation, onAvailability }, ref) {
  const access = useAccountAccess();
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState(''),
    [ended, setEnded] = useState(false),
    [muted, setMuted] = useState(false),
    [blocked, setBlocked] = useState(false),
    [seconds, setSeconds] = useState(0);
  const active = useRef<Run | null>(null),
    trigger = useRef<HTMLDivElement>(null),
    endButton = useRef<HTMLButtonElement>(null);
  const canCall =
    !!access &&
    canAccount(access, conversation.accountId, 'write') &&
    !!conversation.accountId &&
    !!conversation.conversationId &&
    !conversation.group &&
    conversation.name !== 'My Documents';
  useEffect(() => {
    onAvailability?.(canCall);
  }, [canCall, onAvailability]);
  useImperativeHandle(ref, () => ({
    start: () => {
      if (canCall) void begin();
    },
  }));
  useEffect(
    () => () => {
      if (active.current) release(active.current);
      active.current = null;
    },
    [conversation.accountId, conversation.conversationId],
  );
  useEffect(() => {
    if (open) {
      endButton.current?.focus();
      return () => {
        trigger.current?.querySelector('button')?.focus();
      };
    }
  }, [open]);
  const finish = (text = 'Cuộc gọi đã kết thúc') => {
    if (active.current) release(active.current);
    setEnded(true);
    setStatus(text);
  };
  const begin = async () => {
    if (active.current && !active.current.closed) return;
    const { accountId, conversationId } = conversation;
    if (!accountId || !conversationId) return;
    setOpen(true);
    setEnded(false);
    setMuted(false);
    setBlocked(false);
    setSeconds(0);
    setStatus('Đang kiểm tra kết nối gọi…');
    let ready: () => void = () => {};
    const connected = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const media = new CallMedia((state) => {
      if (!run || run.closed) return;
      if (state === 'connected') ready();
      else if (state === 'playback-blocked') setBlocked(true);
      else if (state === 'failed' || state === 'microphone-ended') {
        release(run);
        setEnded(true);
        setStatus(
          state === 'microphone-ended'
            ? 'Micro đã ngắt kết nối.'
            : 'Kết nối âm thanh bị gián đoạn.',
        );
      }
    });
    const run: Run = { scope: { accountId, conversationId }, media, closed: false };
    active.current = run;
    try {
      // Recheck on each click so a stopped/restarted worker cannot leave a silent dead button.
      const capabilities = await request('capabilities');
      if (run.closed) return;
      if (capabilities.available !== true) throw Error('CALL_UNAVAILABLE');
      setStatus('Đang mở micro…');
      const offer = await media.offer();
      if (run.closed) return;
      setStatus('Đang kết nối…');
      const result = await request('offer', run.scope, { offer });
      run.sessionId = result.sessionId;
      if (run.closed) {
        void request('end', run.scope, { sessionId: run.sessionId }).catch(() => {});
        return;
      }
      await media.accept(result.answer);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          connected,
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(Error('CALL_AUDIO_NOT_CONNECTED')), 8000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      if (run.closed) return;
      await request('start', run.scope, { sessionId: run.sessionId });
      if (run.closed) return;
      setStatus('Đang gọi…');
      const poll = async () => {
        if (run.closed) return;
        try {
          const state = await request('status', run.scope, { sessionId: run.sessionId });
          if (run.closed) return;
          if (state.error) throw Error(state.error);
          if (state.callState === 'ended') {
            finish();
            return;
          }
          if (state.callConnected) {
            run.connectedAt = state.connectedAt;
            setStatus('Đang trong cuộc gọi');
            setSeconds(
              Math.max(0, Math.floor((Date.now() - (run.connectedAt || Date.now())) / 1000)),
            );
          }
          run.timer = setTimeout(() => void poll(), 750);
        } catch (error) {
          if (!run.closed) {
            release(run);
            setEnded(true);
            setStatus(message(error));
          }
        }
      };
      void poll();
    } catch (error) {
      if (!run.closed) {
        release(run);
        setEnded(true);
        setStatus(message(error));
      }
    }
  };
  const close = () => {
    if (active.current) release(active.current);
    setOpen(false);
  };
  return (
    <>
      <div ref={trigger}>
        <IconButton
          icon="phone"
          label="Gọi thoại"
          size={20}
          onClick={canCall ? () => void begin() : undefined}
        />
      </div>
      {open &&
        createPortal(
          <div
            className={styles.overlay}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
              if (event.key === 'Tab') {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
                );
                const first = buttons[0],
                  last = buttons.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <section
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="voice-call-title"
            >
              <div className={styles.top}>
                <span>Cuộc gọi thoại</span>
                <button aria-label={ended ? 'Đóng' : 'Kết thúc và đóng cuộc gọi'} onClick={close}>
                  <Icon name="close" size={18} />
                </button>
              </div>
              <div className={styles.avatar}>
                <Avatar conversation={conversation} size={80} />
              </div>
              <h2 id="voice-call-title">{conversation.name}</h2>
              <p className={styles.account}>Gọi bằng {conversation.accountName}</p>
              <p role="status" className={styles.status}>
                {status}
              </p>
              {active.current?.connectedAt && !ended && (
                <div className={styles.duration}>
                  {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                  {String(seconds % 60).padStart(2, '0')}
                </div>
              )}
              {blocked && !ended && (
                <button
                  className={styles.resume}
                  onClick={() => {
                    void active.current?.media
                      .resumePlayback()
                      .then(() => setBlocked(false))
                      .catch(() => {});
                  }}
                >
                  Bật âm thanh
                </button>
              )}
              <div className={styles.controls}>
                {!ended && (
                  <button
                    aria-label={muted ? 'Bật micro' : 'Tắt micro'}
                    aria-pressed={muted}
                    className={`${styles.mic} ${muted ? styles.muted : ''}`}
                    onClick={() => {
                      active.current?.media.setMuted(!muted);
                      setMuted(!muted);
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
                      {muted && <path d="M3 3l18 18" />}
                    </svg>
                  </button>
                )}
                <button
                  ref={endButton}
                  className={ended ? styles.done : styles.hangup}
                  aria-label={ended ? 'Đóng' : 'Kết thúc cuộc gọi'}
                  onClick={() => (ended ? close() : finish())}
                >
                  {ended ? 'Đóng' : <Icon name="phone" size={24} />}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
});
