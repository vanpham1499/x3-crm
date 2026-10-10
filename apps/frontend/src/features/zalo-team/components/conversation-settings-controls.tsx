'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { GroupDialog } from './group-dialog';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Conversation } from '../types';
import type { ConversationSetting, ConversationSettings } from '../conversation-settings';
import { Icon } from './icon';
import { Avatar } from './avatar';
import styles from '../zalo-team.module.css';

function useSettings(conversation: Conversation) {
  const [groupOpen, setGroupOpen] = useState(false);
  const [state, setState] = useState<ConversationSettings | null>(null);
  const [modal, setModal] = useState<'rename' | 'mute' | null>(null);
  const [alias, setAlias] = useState('');
  const [mode, setMode] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const initialRead = useRef<Promise<ConversationSettings> | null>(null);
  const request = async (settings: ConversationSetting, signal?: AbortSignal) => {
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
    return result as ConversationSettings;
  };
  useEffect(() => {
    if (conversation.nativePreparation === 'loading') return;
    const controller = new AbortController();
    const reading = request({ kind: 'read' }, controller.signal);
    initialRead.current = reading;
    reading
      .then((result) => {
        if (controller.signal.aborted) return;
        setState(result);
        setError('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Chưa tải được cài đặt hội thoại.');
      });
    return () => controller.abort();
  }, [
    conversation.accountId,
    conversation.conversationId,
    conversation.nativePreparation,
    conversation.name,
    conversation.pinned,
    conversation.muted,
    retry,
  ]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const act = async (settings: ConversationSetting) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      setState(await request(settings));
      setModal(null);
      window.dispatchEvent(new CustomEvent('zalo-team-group-updated'));
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'WEB_PIN_LIMIT'
          ? 'Đã đạt giới hạn hội thoại ghim của Zalo. Hãy bỏ ghim một hội thoại trước.'
          : 'Chưa xác nhận được thay đổi. Vui lòng kiểm tra kết nối và thử lại.',
      );
      // Read once after an uncertain response; never repeat a mutation silently.
      request({ kind: 'read' })
        .then(setState)
        .catch(() => {});
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const muted = state?.muted ?? conversation.muted;
  const pinned = state?.pinned ?? conversation.pinned;
  const displayName = state?.name || conversation.name;
  const renameTitle = conversation.group ? 'Đổi tên nhóm' : 'Đặt tên gợi nhớ';
  const openRename = () => {
    if (busy || !state?.canRename) return;
    setAlias(state.alias || displayName);
    setError('');
    setModal('rename');
  };
  return {
    ready: () =>
      state
        ? Promise.resolve(state)
        : initialRead.current || Promise.reject(Error('SETTINGS_NOT_READY')),
    groupOpen,
    setGroupOpen,
    state,
    modal,
    setModal,
    alias,
    setAlias,
    mode,
    setMode,
    busy,
    error,
    setError,
    setRetry,
    dialog,
    act,
    muted,
    pinned,
    displayName,
    renameTitle,
    openRename,
  };
}
const SettingsContext = createContext<ReturnType<typeof useSettings> | null>(null);
export function useSharedSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw Error('Missing conversation settings provider');
  return value;
}
export function ConversationSettingsProvider({
  conversation,
  children,
}: {
  conversation?: Conversation | null;
  children: ReactNode;
}) {
  return conversation ? (
    <SettingsProvider key={conversation.id} conversation={conversation}>
      {children}
    </SettingsProvider>
  ) : (
    <>{children}</>
  );
}
function SettingsProvider({
  conversation,
  children,
}: {
  conversation: Conversation;
  children: ReactNode;
}) {
  const settings = useSettings(conversation);
  const {
    modal,
    setModal,
    alias,
    setAlias,
    mode,
    setMode,
    busy,
    error,
    dialog,
    act,
    displayName,
    renameTitle,
  } = settings;
  return (
    <SettingsContext.Provider value={settings}>
      {children}
      <dialog
        ref={dialog}
        className={styles.settingsDialog}
        data-kind={modal}
        aria-label={modal === 'rename' ? renameTitle : 'Tắt thông báo'}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              modal === 'rename' ? { kind: 'rename', name: alias.trim() } : { kind: 'mute', mode },
            );
          }}
        >
          <header>
            <strong>{modal === 'rename' ? renameTitle : 'Xác nhận'}</strong>
            <button type="button" aria-label="Đóng" disabled={busy} onClick={() => setModal(null)}>
              <Icon name="close" size={20} />
            </button>
          </header>
          <div className={styles.settingsDialogBody}>
            {modal === 'rename' ? (
              <>
                <div className={styles.renameIntro}>
                  <Avatar conversation={conversation} size={72} />
                  {conversation.group ? (
                    <p>Tên nhóm mới sẽ hiển thị với tất cả thành viên.</p>
                  ) : (
                    <>
                      <p>Hãy đặt cho {displayName} một cái tên dễ nhớ.</p>
                      <p>Lưu ý: Tên gợi nhớ sẽ chỉ hiển thị riêng với bạn.</p>
                    </>
                  )}
                </div>
                <input
                  autoFocus
                  aria-label="Tên gợi nhớ"
                  maxLength={50}
                  value={alias}
                  disabled={busy}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={displayName}
                />
              </>
            ) : (
              <>
                <p>Bạn có chắc muốn tắt thông báo hội thoại này:</p>
                {['Trong 1 giờ', 'Trong 4 giờ', 'Cho đến 8:00 AM', 'Cho đến khi được mở lại'].map(
                  (label, i) => (
                    <label key={label}>
                      <input
                        type="radio"
                        name="mute"
                        checked={mode === i + 1}
                        disabled={busy}
                        onChange={() => setMode(i + 1)}
                      />
                      {label}
                    </label>
                  ),
                )}
              </>
            )}
            {error && (
              <p role="alert" className={styles.composerError}>
                {error}
              </p>
            )}
          </div>
          <footer>
            <button type="button" disabled={busy} onClick={() => setModal(null)}>
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy || (modal === 'rename' && !!conversation.group && !alias.trim())}
            >
              {busy ? 'Đang lưu…' : modal === 'rename' ? 'Xác nhận' : 'Đồng ý'}
            </button>
          </footer>
        </form>
      </dialog>
    </SettingsContext.Provider>
  );
}
export function ConversationHeaderName() {
  const { displayName, busy, state, openRename } = useSharedSettings();
  return (
    <div className={styles.headerName}>
      <h1 title={displayName}>{displayName}</h1>
      <button
        type="button"
        aria-label="Chỉnh sửa tên trên tiêu đề"
        title="Chỉnh sửa tên"
        className={styles.headerRename}
        disabled={busy || !state?.canRename}
        onClick={openRename}
      >
        <Icon name="edit" size={16} />
      </button>
    </div>
  );
}
export function ConversationSettingsControls({ conversation }: { conversation: Conversation }) {
  const {
    groupOpen,
    setGroupOpen,
    state,
    modal,
    setModal,
    setMode,
    busy,
    error,
    setError,
    setRetry,
    act,
    muted,
    pinned,
    displayName,
    openRename,
  } = useSharedSettings();
  return (
    <>
      <div className={styles.infoName} title={`${displayName} · ${conversation.accountName}`}>
        <span>{displayName}</span>
        <button
          type="button"
          aria-label="Chỉnh sửa tên"
          disabled={busy || !state?.canRename}
          onClick={openRename}
        >
          <Icon name="edit" size={16} />
        </button>
      </div>
      <div className={styles.infoActions} data-group={Boolean(conversation.group)}>
        <button
          type="button"
          aria-pressed={Boolean(muted)}
          disabled={busy || !state}
          onClick={() => {
            if (muted) void act({ kind: 'mute', mode: 0 });
            else {
              setMode(1);
              setError('');
              setModal('mute');
            }
          }}
        >
          <span>
            <Icon name={muted ? 'muted' : 'mute'} size={20} />
          </span>
          {muted ? 'Bật thông báo' : 'Tắt thông báo'}
        </button>
        <button
          type="button"
          aria-pressed={Boolean(pinned)}
          disabled={busy || !state}
          onClick={() => void act({ kind: 'pin', pinned: !pinned })}
        >
          <span>
            <Icon name={pinned ? 'unpin' : 'pin'} size={20} />
          </span>
          {pinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'}
        </button>
        <button type="button" onClick={() => setGroupOpen(true)} disabled={busy}>
          <span>
            <Icon name="group" size={20} />
          </span>
          {conversation.group ? 'Thêm thành viên' : 'Tạo nhóm trò chuyện'}
        </button>
        {conversation.group && (
          <button type="button" disabled>
            <span>
              <Icon name="groupSettings" size={20} />
            </span>
            Quản lý nhóm
          </button>
        )}
      </div>
      {!modal && error && (
        <p role="alert" className={styles.composerError}>
          {error}
          {!state && (
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Thử lại
            </button>
          )}
        </p>
      )}
      {groupOpen && (
        <GroupDialog
          key={`${conversation.accountId}:${conversation.conversationId}`}
          conversation={conversation}
          onClose={() => setGroupOpen(false)}
        />
      )}
    </>
  );
}
