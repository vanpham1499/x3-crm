'use client';
import { useEffect, useRef } from 'react';
import type { Conversation } from '../types';
import type { DirectoryPerson } from '../directory';
import { useSharedSettings } from './conversation-settings-controls';
import { ConversationPrivacy } from './conversation-privacy';
import { TeamDialog } from './dialog';
import { Avatar } from './avatar';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';
export function ProfileDialog({
  person,
  conversation,
  rename,
  onClose,
  onChat,
  onBlock,
  onRemove,
}: {
  person: DirectoryPerson;
  conversation: Conversation;
  rename: boolean;
  onClose: () => void;
  onChat: () => void;
  onBlock: () => void;
  onRemove: () => void;
}) {
  const settings = useSharedSettings(),
    opened = useRef(false);
  useEffect(() => {
    if (rename && settings.state?.canRename && !opened.current) {
      opened.current = true;
      settings.openRename();
    }
  }, [rename, settings]);
  return (
    <TeamDialog title="Thông tin tài khoản" onClose={onClose} className={styles.directoryProfile}>
      {person.coverSrc && (
        <img
          className={styles.directoryCover}
          src={person.coverSrc}
          alt=""
          referrerPolicy="no-referrer"
        />
      )}
      <div className={styles.directoryProfileTitle}>
        <Avatar conversation={{ ...person, color: '#d0dbea' }} size={80} />
        <h2>{settings.displayName || person.name}</h2>
        <button
          aria-label="Đặt tên gợi nhớ"
          disabled={!settings.state?.canRename}
          onClick={settings.openRename}
        >
          <Icon name="edit" size={20} />
        </button>
      </div>
      <div className={styles.directoryProfileBody}>
        <button className={styles.directoryProfileChat} onClick={onChat}>
          Nhắn tin
        </button>
        <h3>Thông tin cá nhân</h3>
        <dl>
          <dt>Giới tính</dt>
          <dd>{person.gender || 'Không hiển thị'}</dd>
          <dt>Ngày sinh</dt>
          <dd>{person.birthday || '••/••/••••'}</dd>
          <dt>Điện thoại</dt>
          <dd>{person.phone || '••••••••••'}</dd>
        </dl>
        <small>Tài khoản: {conversation.accountName}</small>
      </div>
      <div className={styles.directoryProfileActions}>
        {person.isFriend && (
          <button className={styles.directoryProfileAction} onClick={onBlock}>
            <Icon name="profileBlock" size={20} />
            {person.blocked ? 'Bỏ chặn tin nhắn và cuộc gọi' : 'Chặn tin nhắn và cuộc gọi'}
          </button>
        )}
        <ConversationPrivacy
          conversation={conversation}
          onChanged={onClose}
          renderActions={({ open, state }) => (
            <button
              className={styles.directoryProfileAction}
              disabled={!state?.canReport}
              onClick={() => open('report')}
            >
              <Icon name="report" size={20} />
              Báo xấu
            </button>
          )}
        />
        {person.isFriend && (
          <>
            <button
              className={`${styles.directoryProfileAction} ${styles.directoryProfileRemove}`}
              onClick={onRemove}
            >
              <Icon name="trashLine" size={20} />
              Xóa khỏi danh sách bạn bè
            </button>
          </>
        )}
      </div>
    </TeamDialog>
  );
}
