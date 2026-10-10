'use client';
import { ConversationTagIcon } from './shared-tags';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { InlineEmoji } from './inline-emoji';
import type { Conversation } from '../types';
import styles from '../zalo-team.module.css';

export function ConversationRow({
  conversation,
  selected,
  onSelect,
  onMenu,
  menuOpen = false,
  sources,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: (id: number | string, anchor: HTMLButtonElement) => void;
  onMenu: (conversation: Conversation, anchor: HTMLButtonElement) => void;
  menuOpen?: boolean;
  sources?: Conversation[];
}) {
  const tokens = conversation.previewInline;
  const inline =
    tokens?.length && tokens.map((token) => token.text).join('') === conversation.preview
      ? tokens
      : null;
  return (
    <div
      className={`${styles.conversation} ${selected ? styles.conversationSelected : ''}`}
      data-unread={Boolean(conversation.unread || conversation.unreadMarked)}
      data-has-meta={Boolean(
        conversation.unread || conversation.unreadMarked || conversation.pinned,
      )}
      data-menu-open={menuOpen}
    >
      <button
        type="button"
        className={styles.conversationSelect}
        aria-label={`Mở trò chuyện ${conversation.name}`}
        aria-pressed={selected}
        onClick={(event) => onSelect(conversation.id, event.currentTarget)}
      />
      <Avatar conversation={conversation} />
      <span className={styles.conversationText}>
        <span className={styles.conversationName}>
          {conversation.name}{' '}
          {conversation.muted && (
            <span title="Đã tắt thông báo">
              <Icon name="muted" size={14} />
            </span>
          )}
        </span>
        <span className={styles.preview}>
          <ConversationTagIcon
            source={String(conversation.id)}
            onClick={(event) => onSelect(conversation.id, event.currentTarget)}
          />
          <span className={styles.previewText}>
            {inline
              ? inline.map((token, index) =>
                  token.sprite && token.position ? (
                    <InlineEmoji
                      key={index}
                      text={token.text}
                      sprite={token.sprite}
                      position={token.position}
                      compact
                    />
                  ) : (
                    token.text
                  ),
                )
              : conversation.preview}
          </span>
        </span>
      </span>
      <span className={styles.conversationMeta}>
        <span className={styles.conversationTimeAccount}>
          <time>{conversation.time}</time>
          {sources && sources.length > 1 ? (
            <span className={styles.groupRowAccounts}>
              {sources.slice(0, 1).map((source) => (
                <span className={styles.conversationAccountSlot} key={source.id}>
                  <span
                    className={styles.groupAccountAvatar}
                    title={source.accountName}
                    role="img"
                    aria-label={`Tài khoản ${source.accountName}`}
                  >
                    <Avatar
                      conversation={{
                        name: source.accountName || '',
                        avatarSrc: source.accountAvatarSrc,
                        color: '#e5efff',
                      }}
                      size={16}
                    />
                  </span>
                </span>
              ))}
              <span className={styles.groupAccountCountSlot}>
                <span className={styles.groupAccountCount} aria-hidden="true">
                  +{sources.length - 1}
                </span>
                <button
                  type="button"
                  className={styles.groupAccountMore}
                  title={`${sources.length} tài khoản: ${sources.map((source) => source.accountName).join(', ')}`}
                  aria-label={`Thêm thao tác: ${conversation.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                  onClick={(event) => onMenu(conversation, event.currentTarget)}
                >
                  <Icon name="more" size={16} />
                </button>
              </span>
            </span>
          ) : (
            conversation.accountName && (
              <span className={styles.conversationAccountSlot}>
                <span
                  className={styles.conversationAccountAvatar}
                  title={conversation.accountName}
                  role="img"
                  aria-label={`Tài khoản ${conversation.accountName}`}
                >
                  <Avatar
                    conversation={{
                      name: conversation.accountName,
                      avatarSrc: conversation.accountAvatarSrc,
                      color: '#e5efff',
                    }}
                    size={16}
                  />
                </span>
                <button
                  type="button"
                  className={styles.conversationMore}
                  aria-label={`Thêm thao tác: ${conversation.name} · ${conversation.accountName}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={(event) => onMenu(conversation, event.currentTarget)}
                >
                  <Icon name="more" size={16} />
                </button>
              </span>
            )
          )}
        </span>
        {conversation.unread ? (
          <span className={styles.unreadBadge}>
            {conversation.unread > 99 ? '99+' : conversation.unread}
          </span>
        ) : conversation.unreadMarked ? (
          <span className={styles.unreadMark} aria-label="Đã đánh dấu chưa đọc" />
        ) : conversation.pinned ? (
          <Icon name="pinFilled" size={16} />
        ) : null}
      </span>
    </div>
  );
}
