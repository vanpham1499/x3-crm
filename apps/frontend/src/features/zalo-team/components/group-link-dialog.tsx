'use client';
import { TeamSelect } from './team-select';
import { useState } from 'react';
import type { Conversation, ConversationListResponse } from '../types';
import { changeGroupLink, type LinkedGroup } from '../group-links';
import { TeamDialog } from './dialog';
import styles from '../zalo-team.module.css';
export function GroupLinkDialog({
  conversations,
  accounts,
  links,
  initial,
  onChanged,
  onClose,
}: {
  conversations: Conversation[];
  accounts: ConversationListResponse['accounts'];
  links: LinkedGroup[];
  initial?: LinkedGroup;
  onChanged: (groups: LinkedGroup[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Record<string, string>>(
      Object.fromEntries((initial?.sources || []).map((id) => [id.split(':')[0], id])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sources = Object.values(picked).filter(Boolean);
  async function save() {
    if (sources.length < 2 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await changeGroupLink({ kind: 'link', sources });
      onChanged(r.groups);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'WEB_GROUP_LINK_CONFLICT'
          ? 'Một tài khoản đã có nhóm khác trong liên kết. Tách liên kết cũ trước khi ghép lại.'
          : 'Chưa liên kết được. Kiểm tra tài khoản và thử lại.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function unlink(groupId: string, source: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await changeGroupLink({ kind: 'unlink', groupId, source });
      onChanged(r.groups);
      setPicked((p) => ({ ...p, [source.split(':')[0]]: '' }));
    } catch {
      setError('Chưa tách được liên kết. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamDialog
      title="Liên kết cùng nhóm"
      onClose={() => !busy && onClose()}
      className={styles.inboxCreateDialog}
    >
      <div className={styles.inboxCreateBody}>
        <p className={styles.groupLinkIntro}>
          Chọn các cuộc trò chuyện thuộc cùng một nhóm Zalo. Mỗi tài khoản chọn một nhóm.
        </p>
        {accounts.map((account) => (
          <label key={account.id} className={styles.inboxAccountLabel}>
            {account.name}
            <TeamSelect
              aria-label={`Nhóm của ${account.name}`}
              disabled={busy || account.state !== 'connected' || !!account.error}
              value={picked[account.id] || ''}
              onChange={(e) => setPicked((p) => ({ ...p, [account.id]: e.target.value }))}
            >
              <option value="">Không chọn</option>
              {conversations
                .filter((c) => c.group && c.accountId === account.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </TeamSelect>
          </label>
        ))}
        {links
          .filter((g) => g.sources.some((s) => sources.includes(s)))
          .map((g) => (
            <div key={g.id} className={styles.groupLinkExisting}>
              <small>Đã liên kết</small>
              {g.sources.map((id) => {
                const c = conversations.find((c) => c.id === id);
                return (
                  c && (
                    <div key={id}>
                      <span>
                        {c.accountName} · {c.name}
                      </span>
                      <button disabled={busy} onClick={() => void unlink(g.id, id)}>
                        Tách
                      </button>
                    </div>
                  )
                );
              })}
            </div>
          ))}
        <p className={styles.groupLinkIntro}>
          Liên kết chỉ gộp cách hiển thị trong Team. Tách liên kết không rời nhóm hoặc xóa tin nhắn.
        </p>
        {error && (
          <p role="alert" className={styles.friendError}>
            {error}
          </p>
        )}
      </div>
      <footer className={styles.inboxCreateFooter}>
        <button disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button
          disabled={busy || sources.length < 2}
          className={styles.inboxCreatePrimary}
          onClick={() => void save()}
        >
          {busy ? 'Đang lưu…' : 'Xác nhận cùng nhóm'}
        </button>
      </footer>
    </TeamDialog>
  );
}
