'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Conversation, ConversationInfoResponse } from '../types';
import { readConversationInfo } from '../info-api';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { TeamDialog } from './dialog';
import { GroupDialog } from './group-dialog';
import { SearchInput } from './primitives';
import { normalizedSearch } from '../info-presentation';
import styles from '../zalo-team.module.css';

type Member = ConversationInfoResponse['metadata']['members'][number];
type Action = 'promote' | 'demote' | 'remove' | 'leave';
type Command = { kind: Action; memberId?: string; successorId?: string };
const labels: Record<Action, string> = {
  promote: 'Thêm phó nhóm',
  demote: 'Xóa phó nhóm',
  remove: 'Xóa khỏi nhóm',
  leave: 'Rời nhóm',
};
// Keep the receipt after an uncertain response, including closing/reopening the dialog.
const receipts = new Map<string, string>();
async function manage(conversation: Conversation, group: Command) {
  const key = JSON.stringify([conversation.accountId, conversation.conversationId, group]);
  const requestId = receipts.get(key) || crypto.randomUUID();
  receipts.set(key, requestId);
  const response = await teamFetch('/api/zalo-team/web', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'group-action',
      accountId: conversation.accountId,
      conversationId: conversation.conversationId,
      requestId,
      group,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'WEB_UNAVAILABLE');
  if (
    result.accountId !== conversation.accountId ||
    result.conversationId !== conversation.conversationId
  )
    throw Error('WEB_IDENTITY_MISMATCH');
  if (result.status === 'confirmed') receipts.delete(key);
  return result as {
    status: string;
    ownershipTransferred?: boolean;
    roleRemoved?: boolean;
    errorCode?: string | number;
  };
}
function outcome(result: Awaited<ReturnType<typeof manage>>) {
  if (result.status === 'rejected')
    return `Zalo không chấp nhận thao tác này${result.errorCode !== undefined ? ` (mã ${result.errorCode})` : ''}. Hãy tải lại danh sách để kiểm tra quyền hiện tại.`;
  if (result.ownershipTransferred)
    return 'Đã gửi yêu cầu chuyển trưởng nhóm nhưng chưa xác nhận rời nhóm. Hãy tải lại danh sách để kiểm tra.';
  if (result.roleRemoved)
    return 'Đã gửi yêu cầu gỡ phó nhóm nhưng chưa xác nhận xóa thành viên. Hãy tải lại danh sách để kiểm tra.';
  return 'Chưa xác nhận được kết quả từ Zalo. Hãy tải lại danh sách để kiểm tra trước khi thao tác tiếp.';
}
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (/PERMISSION|MEMBER_INVALID|SUCCESSOR/.test(code))
    return 'Quyền hoặc thành viên nhóm đã thay đổi. Hãy tải lại danh sách.';
  return 'Chưa xác nhận được kết quả từ Zalo. Hãy tải lại danh sách để kiểm tra.';
}

export function GroupManagementDialog({
  conversation,
  member,
  onClose,
  onChanged,
}: {
  conversation: Conversation;
  member?: Member;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [metadata, setMetadata] = useState<ConversationInfoResponse['metadata'] | null>(null);
  const [successor, setSuccessor] = useState('');
  const [selectionDone, setSelectionDone] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(!member);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempted, setAttempted] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (member) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const result = await readConversationInfo(conversation, controller.signal, 'members');
        if (!controller.signal.aborted) setMetadata(result.metadata);
      } catch {
        if (!controller.signal.aborted)
          setNotice('Chưa tải được thông tin nhóm. Đóng và mở lại để thử lại.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [conversation.accountId, conversation.conversationId, member]);
  const transfer = !member && metadata?.selfRole === 'owner' && (metadata.memberCount || 0) > 1;
  async function more() {
    if (!metadata?.memberCursor || loading) return;
    setLoading(true);
    try {
      const next = await readConversationInfo(
        conversation,
        new AbortController().signal,
        'members',
        metadata.memberCursor,
      );
      setMetadata({
        ...next.metadata,
        members: Array.from(
          new Map([...metadata.members, ...next.metadata.members].map((m) => [m.id, m])).values(),
        ),
      });
    } catch {
      setNotice('Chưa tải được các thành viên tiếp theo.');
    } finally {
      setLoading(false);
    }
  }
  async function submit() {
    if (lock.current || attempted) return;
    lock.current = true;
    setBusy(true);
    setAttempted(true);
    setNotice('');
    try {
      const result = await manage(
        conversation,
        member
          ? { kind: 'remove', memberId: member.id }
          : { kind: 'leave', ...(transfer ? { successorId: successor } : {}) },
      );
      onChanged();
      if (result.status === 'confirmed') onClose();
      else setNotice(outcome(result));
    } catch (e) {
      setNotice(failure(e));
      onChanged();
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <TeamDialog
      className={styles.groupConfirmDialog}
      title={
        member
          ? 'Xác nhận'
          : transfer && !selectionDone
            ? 'Chọn trưởng nhóm mới trước khi rời'
            : 'Rời nhóm và xóa trò chuyện'
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className={styles.confirmBody}>
        {(!transfer || selectionDone) && (
          <p>
            {member ? (
              <>
                Xóa <strong>{member.name || 'thành viên này'}</strong> khỏi nhóm?
              </>
            ) : (
              <>
                Bạn có chắc muốn rời nhóm <strong>{conversation.name}</strong>?
              </>
            )}
          </p>
        )}
        {transfer && selectionDone && (
          <p>
            Quyền trưởng nhóm sẽ được chuyển cho{' '}
            <strong>{metadata?.members.find((m) => m.id === successor)?.name}</strong>.
          </p>
        )}
        {!member && (!transfer || selectionDone) && (
          <p>Bạn sẽ không thể xem lại tin nhắn trong nhóm này sau khi rời nhóm.</p>
        )}
        {transfer && !selectionDone && (
          <>
            <SearchInput
              label="Tìm kiếm trưởng nhóm mới"
              placeholder="Tìm kiếm"
              value={query}
              onValueChange={setQuery}
            />
            <div className={styles.successorList} role="radiogroup" aria-label="Trưởng nhóm mới">
              {metadata?.members
                .filter(
                  (m) =>
                    !m.self && normalizedSearch(m.name || '').includes(normalizedSearch(query)),
                )
                .map((m) => (
                  <label key={m.id}>
                    <input
                      type="radio"
                      name="successor"
                      value={m.id}
                      checked={successor === m.id}
                      disabled={busy || attempted}
                      onChange={() => setSuccessor(m.id)}
                    />
                    <Avatar
                      conversation={{
                        name: m.name || 'Thành viên',
                        avatarSrc: m.avatarSrc,
                        color: '#b8c7e3',
                      }}
                      size={40}
                    />
                    <span>{m.name || 'Thành viên'}</span>
                  </label>
                ))}
              {metadata?.memberCursor && (
                <button
                  className={styles.infoViewAll}
                  disabled={loading || attempted}
                  onClick={() => void more()}
                >
                  {loading ? 'Đang tải…' : 'Xem thêm thành viên'}
                </button>
              )}
            </div>
          </>
        )}
        {loading && <p role="status">Đang tải thông tin nhóm…</p>}
        {notice && <p role="status">{notice}</p>}
        <div className={styles.dialogActions}>
          <button className={styles.secondaryButton} disabled={busy} onClick={onClose}>
            {member ? 'Đóng' : 'Hủy'}
          </button>
          {!attempted && (
            <button
              className={`${styles.primaryButton} ${!member && (!transfer || selectionDone) ? styles.groupLeaveConfirm : ''}`}
              disabled={
                busy || loading || (!member && (!metadata?.canLeave || (transfer && !successor)))
              }
              onClick={() => {
                if (transfer && !selectionDone) setSelectionDone(true);
                else void submit();
              }}
            >
              {member ? 'Đồng ý' : transfer && !selectionDone ? 'Chọn và tiếp tục' : 'Rời nhóm'}
            </button>
          )}
          {attempted && busy && (
            <button className={styles.primaryButton} disabled>
              Đang xử lý…
            </button>
          )}
        </div>
      </div>
    </TeamDialog>
  );
}

export function LeaveGroup({
  conversation,
  onChanged,
}: {
  conversation: Conversation;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={`${styles.panelAction} ${styles.leaveGroup}`}
        onClick={() => setOpen(true)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5" />
        </svg>
        <span>Rời nhóm</span>
      </button>
      {open && (
        <GroupManagementDialog
          conversation={conversation}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

export function GroupMembers({
  conversation,
  metadata,
  onChanged,
}: {
  conversation: Conversation;
  metadata: ConversationInfoResponse['metadata'];
  onChanged: () => void;
}) {
  const [menu, setMenu] = useState<{ member: Member; left: number; top: number } | null>(null);
  const [confirm, setConfirm] = useState<Member | 'leave' | null>(null);
  const [add, setAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = () => setMenu(null);
    const pointer = (e: PointerEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        trigger.current?.focus();
      }
    };
    const scroll = (e: Event) => {
      // Only movement of the member list affects this anchor; incoming chat
      // messages can scroll the separate history pane while this menu is open.
      if (e.target instanceof Element && e.target.contains(trigger.current)) close();
    };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [menu]);
  useEffect(() => {
    setMenu(null);
  }, [metadata]);
  async function act(kind: Action, member: Member) {
    setMenu(null);
    if (kind === 'remove' || kind === 'leave') {
      setConfirm(kind === 'leave' ? 'leave' : member);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice('');
    try {
      const result = await manage(conversation, { kind, memberId: member.id });
      setNotice(
        result.status === 'confirmed'
          ? kind === 'promote'
            ? 'Đã thêm phó nhóm.'
            : 'Đã xóa phó nhóm.'
          : outcome(result),
      );
    } catch (e) {
      setNotice(failure(e));
    } finally {
      lock.current = false;
      setBusy(false);
      onChanged();
    }
  }
  return (
    <>
      <div className={styles.memberAdd}>
        <button disabled={!metadata.canAdd || busy} onClick={() => setAdd(true)}>
          <Icon name="group" size={16} />
          Thêm thành viên
        </button>
      </div>
      <h3 className={styles.memberCount}>
        Danh sách thành viên ({metadata.memberCount ?? metadata.members.length})
      </h3>
      {notice && (
        <div className={styles.memberNotice} role="status">
          {notice}
          <button onClick={onChanged}>Tải lại danh sách</button>
        </div>
      )}
      {metadata.members.map((member) => (
        <div
          key={member.id}
          className={styles.groupMember}
          data-open={menu?.member.id === member.id || undefined}
        >
          <span className={styles.memberAvatar}>
            <Avatar
              conversation={{
                name: member.name || 'Thành viên',
                avatarSrc: member.avatarSrc,
                color: '#b8c7e3',
              }}
              size={40}
            />
            {member.role !== 'member' && (
              <span className={styles.memberBadge} data-owner={member.role === 'owner'}>
                <Icon name="keyFilled" size={12} />
              </span>
            )}
          </span>
          <span className={styles.memberName}>
            <strong title={member.name}>{member.self ? 'Bạn' : member.name || 'Thành viên'}</strong>
            {member.role !== 'member' && (
              <small>{member.role === 'owner' ? 'Trưởng nhóm' : 'Phó nhóm'}</small>
            )}
          </span>
          {!!member.actions?.length && (
            <button
              className={styles.memberMore}
              disabled={busy}
              aria-label={`Thao tác với ${member.self ? 'Bạn' : member.name}`}
              aria-haspopup="menu"
              aria-expanded={menu?.member.id === member.id}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                trigger.current = e.currentTarget;
                setMenu(
                  menu?.member.id === member.id
                    ? null
                    : {
                        member,
                        left: Math.max(8, rect.right - 184),
                        top: Math.max(
                          8,
                          Math.min(
                            rect.bottom,
                            window.innerHeight - 16 - (member.actions?.length || 0) * 40 - 16,
                          ),
                        ),
                      },
                );
              }}
            >
              <Icon name="more" size={20} />
            </button>
          )}
        </div>
      ))}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.memberMenu}
            style={{ left: menu.left, top: menu.top }}
            role="menu"
            aria-label={`Thao tác thành viên ${menu.member.name}`}
            onKeyDown={(e) => {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
              );
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                buttons[
                  (index + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
                ]?.focus();
              }
            }}
          >
            {menu.member.actions?.map((kind) => (
              <button key={kind} role="menuitem" onClick={() => void act(kind, menu.member)}>
                {labels[kind]}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {confirm && (
        <GroupManagementDialog
          conversation={conversation}
          member={confirm === 'leave' ? undefined : confirm}
          onChanged={onChanged}
          onClose={() => setConfirm(null)}
        />
      )}
      {add && (
        <GroupDialog
          conversation={conversation}
          onClose={() => {
            setAdd(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}
