'use client';
import { TeamSelect } from './team-select';
import { useState } from 'react';
import type { Conversation } from '../types';
import { TeamDialog } from './dialog';
import { GroupDialog } from './group-dialog';
import styles from '../zalo-team.module.css';
export function AddPersonToGroupDialog({
  person,
  conversations,
  onClose,
}: {
  person: Conversation;
  conversations: Conversation[];
  onClose: () => void;
}) {
  const [groupId, setGroupId] = useState(''),
    [open, setOpen] = useState(false);
  const groups = conversations.filter((c) => c.accountId === person.accountId && c.group);
  const group = groups.find((g) => String(g.id) === groupId);
  if (open && group)
    return (
      <GroupDialog
        conversation={group}
        initialMembers={person.conversationId ? [person.conversationId] : []}
        onClose={onClose}
      />
    );
  return (
    <TeamDialog title="Thêm vào nhóm" onClose={onClose} className={styles.inboxCreateDialog}>
      <div className={styles.inboxCreateBody}>
        <p className={styles.groupAccountHint}>
          {person.accountName} · {person.name}
        </p>
        <label className={styles.inboxAccountLabel}>
          Nhóm
          <TeamSelect
            aria-label="Nhóm để thêm thành viên"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Chọn nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </TeamSelect>
        </label>
        {!groups.length && <p>Chưa có nhóm trong tài khoản này.</p>}
      </div>
      <footer className={styles.inboxCreateFooter}>
        <button onClick={onClose}>Hủy</button>
        <button
          className={styles.inboxCreatePrimary}
          disabled={!group}
          onClick={() => setOpen(true)}
        >
          Tiếp tục
        </button>
      </footer>
    </TeamDialog>
  );
}
