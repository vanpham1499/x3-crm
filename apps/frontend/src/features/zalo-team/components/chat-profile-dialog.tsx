'use client';
import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../types';
import { directoryRequest, type DirectoryPerson } from '../directory';
import { ConversationSettingsProvider } from './conversation-settings-controls';
import { ProfileDialog } from './profile-dialog';
import { TeamDialog } from './dialog';
import { Avatar } from './avatar';
import styles from '../zalo-team.module.css';

export function ChatProfileDialog({
  conversation,
  personId,
  messageId,
  fallbackPerson,
  onClose,
  onChat,
}: {
  conversation: Conversation;
  personId: string;
  messageId?: string;
  fallbackPerson?: { name: string; avatarSrc?: string };
  onClose: () => void;
  onChat: (person: Conversation) => void;
}) {
  const [person, setPerson] = useState<DirectoryPerson | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState<'block' | 'unblock' | 'remove' | null>(null),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    const scope = {
      id: personId,
      conversationId: conversation.conversationId!,
      ...(messageId ? { messageId } : {}),
    };
    void (async () => {
      try {
        const opened = await directoryRequest(
          conversation.accountId!,
          { kind: 'open', ...scope },
          abort.signal,
        );
        if (abort.signal.aborted) return;
        if (opened.status !== 'opened') throw Error();
        const result = await directoryRequest(
          conversation.accountId!,
          { kind: 'profile', ...scope },
          abort.signal,
        );
        if (!result.person || result.person.id !== personId) throw Error();
        if (!abort.signal.aborted) setPerson(result.person);
      } catch {
        if (abort.signal.aborted) return;
        // An imported group message may no longer exist in Web history. The
        // directory still independently authorizes current friends by their ID.
        try {
          const opened = await directoryRequest(
            conversation.accountId!,
            { kind: 'open', id: personId },
            abort.signal,
          );
          if (opened.status !== 'opened' || opened.conversationId !== personId)
            throw Error('WEB_CONVERSATION_NOT_READY');
          const result = await directoryRequest(
            conversation.accountId!,
            { kind: 'profile', id: personId },
            abort.signal,
          );
          if (!result.person || result.person.id !== personId) throw Error('WEB_IDENTITY_MISMATCH');
          if (!abort.signal.aborted) setPerson(result.person);
        } catch {
          if (!abort.signal.aborted) setError('Chưa lấy được hồ sơ hiện tại từ Zalo.');
        }
      }
    })();
    return () => abort.abort();
  }, [conversation.accountId, conversation.conversationId, personId, messageId, retry]);
  const peer: Conversation = {
    ...conversation,
    id: `${conversation.accountId}:${personId}`,
    conversationId: personId,
    name: person?.name || '',
    avatarSrc: person?.avatarSrc,
    group: false,
    memberCount: undefined,
    avatarMembers: undefined,
    pinned: personId === conversation.conversationId ? conversation.pinned : undefined,
    muted: personId === conversation.conversationId ? conversation.muted : undefined,
    category: personId === conversation.conversationId ? conversation.category : undefined,
    unread: undefined,
    unreadMarked: undefined,
    preview: '',
    time: '',
  };
  const ask = (kind: NonNullable<typeof confirm>) => {
    setUncertain(false);
    setError('');
    setConfirm(kind);
  };
  async function act() {
    if (!confirm || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await directoryRequest(conversation.accountId!, {
        kind: confirm,
        id: personId,
      });
      if (!alive.current) return;
      if (result.status !== 'confirmed') throw Error();
      setConfirm(null);
      setRetry((n) => n + 1);
      window.dispatchEvent(new CustomEvent('zalo-team-group-updated'));
    } catch {
      if (alive.current) {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Đóng hộp và tải lại để kiểm tra.');
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!person)
    return (
      <TeamDialog title="Thông tin tài khoản" onClose={onClose}>
        <div className={styles.directoryConfirm}>
          {error && (fallbackPerson || !conversation.group) && (
            <>
              <Avatar
                conversation={{ ...conversation, ...(fallbackPerson || {}), group: false }}
                size={80}
              />
              <h2>{fallbackPerson?.name || conversation.name}</h2>
              <p>Thông tin từ tin nhắn đã lưu.</p>
            </>
          )}
          <p role="status">{error || 'Đang tải thông tin…'}</p>
          {error && <button onClick={() => setRetry((n) => n + 1)}>Thử lại</button>}
        </div>
      </TeamDialog>
    );
  return (
    <>
      <ConversationSettingsProvider conversation={peer}>
        <ProfileDialog
          person={person}
          conversation={peer}
          rename={false}
          onClose={onClose}
          onChat={() => {
            onChat(peer);
            onClose();
          }}
          onBlock={() => ask(person.blocked ? 'unblock' : 'block')}
          onRemove={() => ask('remove')}
        />
      </ConversationSettingsProvider>
      {confirm && (
        <TeamDialog
          title={
            confirm === 'remove' ? 'Xóa bạn' : confirm === 'block' ? 'Chặn người này' : 'Bỏ chặn'
          }
          onClose={() => !busy && setConfirm(null)}
        >
          <div className={styles.directoryConfirm}>
            <p>
              <strong>{person.name}</strong>
            </p>
            <p>
              Thực hiện bằng tài khoản <strong>{conversation.accountName}</strong>.
            </p>
            <p>
              {confirm === 'remove'
                ? 'Bạn và người này sẽ không còn là bạn bè trên Zalo.'
                : confirm === 'block'
                  ? 'Người này sẽ không thể nhắn tin và gọi cho bạn.'
                  : 'Cho phép người này nhắn tin và gọi lại cho bạn.'}
            </p>
            {uncertain && <p role="alert">{error}</p>}
          </div>
          <footer className={styles.inboxCreateFooter}>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Hủy
            </button>
            <button
              className={styles.inboxCreatePrimary}
              disabled={busy || uncertain}
              onClick={() => void act()}
            >
              {busy ? 'Đang xử lý…' : 'Xác nhận'}
            </button>
          </footer>
        </TeamDialog>
      )}
    </>
  );
}
