'use client';
import { useState, type CSSProperties } from 'react';
import type { Conversation } from '../types';
import styles from '../zalo-team.module.css';

export function Avatar({
  conversation,
  size = 48,
}: {
  conversation: Pick<
    Conversation,
    'name' | 'color' | 'avatarSrc' | 'group' | 'avatarMembers' | 'memberCount'
  >;
  size?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const initials = conversation.name
    .split(' ')
    .slice(-2)
    .map((word) => word[0])
    .join('');
  const style = {
    '--avatar-color': conversation.color,
    '--member-size': `${Math.floor(size / 2) + 2}px`,
    width: size,
    height: size,
  } as CSSProperties;
  if (conversation.avatarSrc && failedSrc !== conversation.avatarSrc)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`${styles.avatar} ${styles.docsAvatar}`}
        style={style}
        src={conversation.avatarSrc}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(conversation.avatarSrc)}
      />
    );
  if (conversation.group && conversation.avatarMembers?.length)
    return (
      <span className={`${styles.avatar} ${styles.groupAvatar}`} style={style} aria-hidden="true">
        {conversation.avatarMembers
          .slice(0, (conversation.memberCount || 0) > 4 ? 3 : 4)
          .map((member, i) => (
            <span key={i} style={{ background: ['#b9cdd8', '#ded2b4', '#b4cebd', '#ebecf0'][i] }}>
              <Avatar
                conversation={{
                  name: member.name || '?',
                  avatarSrc: member.avatarSrc,
                  color: '#b9cdd8',
                }}
                size={Math.floor(size / 2) + 2}
              />
            </span>
          ))}
        {(conversation.memberCount || 0) > 4 && (
          <span className={styles.groupCount}>
            {conversation.memberCount! > 99 ? '99+' : conversation.memberCount}
          </span>
        )}
      </span>
    );
  return (
    <span className={styles.avatar} style={style} aria-hidden="true">
      {initials}
    </span>
  );
}
