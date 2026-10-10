'use client';
import { TopicEvent } from './topic-event';
import { useState } from 'react';
import { MessageActions } from './message-actions';
import type { MessageOperation } from '../types';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { MessageAttachmentView, MessageText } from './message-content';
import { messageClock, messageDay } from '../message-presentation';
import { photoAlbumLayout } from '../photo-album';
import { callPresentation } from '../call-presentation';
import type { ChatMessage, Conversation } from '../types';
import styles from '../zalo-team.module.css';
import { PollCard, PollIcon } from './poll-card';

export function MessageItem({
  message,
  conversation,
  first,
  last,
  latest = false,
  onPreview,
  onEditFailed,
  canEditFailed,
  onReply,
  onAction,
  onJump,
  onCall,
  onProfile,
}: {
  onProfile?: (message: ChatMessage) => void;
  onCall?: () => void;
  onReply?: (message: ChatMessage) => void;
  onAction?: (
    message: ChatMessage,
    operation: MessageOperation,
    reaction?: number,
  ) => Promise<void>;
  onJump?: (id: string) => void;
  message: ChatMessage;
  conversation: Conversation;
  first: boolean;
  last: boolean;
  latest?: boolean;
  onPreview: (src: string) => void;
  onEditFailed?: (id: string) => void;
  canEditFailed?: boolean;
}) {
  const [contextMenu, setContextMenu] = useState<{ left: number; top: number } | null>(null);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const album = message.album;
  const actionMessage =
    album?.find((m) => m.id === activePhoto) || album?.[album.length - 1] || message;
  const albumLayout = album ? photoAlbumLayout(album.map((m) => m.attachments[0])) : null;
  const hasActions =
    !!onAction &&
    !!onReply &&
    message.kind !== 'system' &&
    message.kind !== 'call' &&
    (message.archived || /^\d+$/.test(message.id)) &&
    (!message.delivery || message.delivery === 'sent');
  const floating =
    !message.quote &&
    !message.text &&
    message.attachments.length > 0 &&
    message.attachments.every((a) => a.kind === 'image' || a.kind === 'sticker');
  const photoCaption =
    !message.quote &&
    Boolean(message.text) &&
    message.attachments.length > 0 &&
    message.attachments.every((a) => a.kind === 'image');
  const file = message.attachments.some((a) => a.kind === 'file');
  const call = message.call ? callPresentation(message.call) : undefined;
  const link = message.attachments.some((a) => a.kind === 'link');
  const system = message.kind === 'system';
  const time = (last || message.crmSender) && (
    <time
      className={floating || message.kind === 'call' ? styles.floatingTime : styles.messageTime}
      dateTime={new Date(message.time).toISOString()}
      data-crm-sender={message.crmSender ? true : undefined}
      title={`${messageClock(message.time)} ${messageDay(message.time)}${message.crmSender ? ` - ${message.crmSender.name} (Zalo Team)` : ''}`}
    >
      {messageClock(message.time)}
      {message.crmSender && ` - ${message.crmSender.name}`}
    </time>
  );
  if (message.archived && (message.poll || message.topic))
    return (
      <article className={styles.systemMessage}>
        <span>
          {message.text} {message.topic?.title}
        </span>
        <time>
          {messageDay(message.time)} {messageClock(message.time)}
        </time>
      </article>
    );
  if (message.poll)
    return (
      <>
        <div className={`${styles.systemMessage} ${styles.pollCardEvent}`}>
          <span>
            <PollIcon />
            {message.text}
          </span>
        </div>
        <PollCard
          poll={message.poll}
          messageId={message.id}
          accountId={conversation.accountId}
          conversationId={conversation.conversationId}
        />
      </>
    );
  if (message.topic) return <TopicEvent message={message} />;
  if (system)
    return (
      <article
        data-message-id={message.id}
        className={`${styles.systemMessage} ${message.type === 'MSG_POLL' ? styles.pollCardEvent : ''}`}
      >
        <span>
          {message.type === 'MSG_POLL' && <PollIcon />}
          {message.text}
        </span>
      </article>
    );
  return (
    <article
      data-message-id={message.id}
      data-latest-message={latest || undefined}
      onContextMenu={
        hasActions
          ? (event) => {
              event.preventDefault();
              setContextMenu({ left: event.clientX, top: event.clientY });
            }
          : undefined
      }
      className={`${styles.messageRow} ${message.mine ? styles.outgoing : ''} ${last ? styles.blockEnd : ''}`}
    >
      {!message.mine && (
        <div className={styles.messageAvatar}>
          {first && (
            <button
              type="button"
              className={styles.profileAvatarButton}
              aria-label={`Xem thông tin tài khoản ${message.sender.name || conversation.name}`}
              disabled={!onProfile || (conversation.group && !message.sender.id)}
              onClick={() => onProfile?.(message)}
              onContextMenu={(e) => e.stopPropagation()}
            >
              <Avatar
                conversation={{
                  name: message.sender.name || conversation.name,
                  avatarSrc:
                    message.sender.avatarSrc ||
                    (!conversation.group ? conversation.avatarSrc : undefined),
                  color: '#b8c7e3',
                }}
                size={40}
              />
            </button>
          )}
        </div>
      )}
      <div className={`${styles.messageBody} ${floating ? styles.mediaBody : ''}`}>
        {photoCaption && conversation.group && !message.mine && first && (
          <div className={`${styles.messageSender} ${styles.mediaSender}`}>
            {message.sender.name || 'Thành viên nhóm'}
          </div>
        )}
        <div
          className={`${styles.bubble} ${floating ? styles.floatingBubble : ''} ${photoCaption ? styles.photoCaptionBubble : ''} ${file ? styles.fileBubble : ''} ${link ? styles.linkBubble : ''} ${message.kind === 'call' ? styles.callBubble : ''} ${message.kind === 'recalled' ? styles.recalledBubble : ''}`}
        >
          {!photoCaption && conversation.group && !message.mine && first && (
            <div className={styles.messageSender}>{message.sender.name || 'Thành viên nhóm'}</div>
          )}
          {message.kind !== 'recalled' && message.quote && (
            <blockquote
              className={styles.messageQuote}
              onClick={() => message.quote?.id && onJump?.(message.quote.id)}
              title="Xem tin nhắn gốc"
            >
              {message.quote.preview && (
                /* eslint-disable-next-line @next/next/no-img-element */ <img
                  src={message.quote.preview}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.hidden = true;
                  }}
                />
              )}
              <div>
                <strong>{message.quote.sender}</strong>
                <MessageText text={message.quote.text || 'Tin nhắn được trích dẫn'} />
              </div>
            </blockquote>
          )}
          {message.kind === 'call' ? (
            <div className={styles.callContent}>
              <strong data-missed={call?.red || undefined}>{call?.title || message.text}</strong>
              <div className={styles.callSummary}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={call?.icon || '/zalo-team/calls/call-incoming-audio.svg'}
                  width={24}
                  height={24}
                  alt=""
                />
                <span>{call?.subtitle || 'Đã kết thúc'}</span>
              </div>
              {message.call?.callback && (
                <button
                  className={styles.callBack}
                  onClick={onCall}
                  disabled={!onCall}
                  title={onCall ? 'Gọi thoại lại' : 'Dịch vụ gọi điện chưa sẵn sàng'}
                >
                  Gọi lại
                </button>
              )}
            </div>
          ) : (
            !photoCaption &&
            message.text && (
              <MessageText
                text={message.text}
                inline={message.kind === 'recalled' ? undefined : message.inline}
                textStyles={message.kind === 'recalled' ? undefined : message.styles}
                mentions={message.kind === 'recalled' ? undefined : message.mentions}
              />
            )
          )}
          {album && albumLayout ? (
            <div
              className={styles.photoAlbum}
              aria-label={`Nhóm ${album.length} ảnh`}
              style={{
                width: albumLayout.width,
                aspectRatio: `${albumLayout.width} / ${albumLayout.height}`,
              }}
            >
              {album.map((photo, i) => {
                const box = albumLayout.positions[i];
                return (
                  <div
                    key={photo.id}
                    data-message-id={photo.id}
                    className={styles.photoAlbumItem}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActivePhoto(photo.id);
                      setContextMenu({ left: event.clientX, top: event.clientY });
                    }}
                    style={{
                      left: `${(box.x / albumLayout.width) * 100}%`,
                      top: `${(box.y / albumLayout.height) * 100}%`,
                      width: `${(box.width / albumLayout.width) * 100}%`,
                      height: `${(box.height / albumLayout.height) * 100}%`,
                      borderRadius: box.radius,
                    }}
                    data-fit={box.contain ? 'contain' : 'cover'}
                  >
                    <MessageAttachmentView item={photo.attachments[0]} onPreview={onPreview} />
                    {photo.attachments[0].hd && <span className={styles.photoHd}>HD</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={
                message.attachments.length > 1 && (floating || photoCaption)
                  ? styles.mediaGrid
                  : styles.attachmentList
              }
            >
              {message.attachments.map((item, i) => (
                <MessageAttachmentView
                  key={`${message.id}:${i}:${item.url || item.preview}`}
                  item={item}
                  onPreview={onPreview}
                />
              ))}
            </div>
          )}
          {photoCaption && (
            <div className={styles.photoCaptionText}>
              <MessageText
                text={message.text}
                inline={message.inline}
                textStyles={message.styles}
                mentions={message.mentions}
              />
            </div>
          )}
          {!floating && message.kind !== 'call' && time}
        </div>
        {(floating || message.kind === 'call') && time}
        {message.starred && (
          <span className={styles.messageStar} title="Đã đánh dấu">
            <Icon name="star" size={12} />
          </span>
        )}
        {hasActions && onAction && onReply && (
          <MessageActions
            contextMenu={contextMenu}
            message={actionMessage}
            accountId={conversation.accountId}
            conversationId={conversation.conversationId}
            onReply={() => onReply(actionMessage)}
            onAction={(op, reaction) => onAction(actionMessage, op, reaction)}
          />
        )}
        {message.delivery && message.delivery !== 'sent' && (
          <div className={styles.messageDelivery} role="status" data-delivery={message.delivery}>
            {message.delivery === 'queued'
              ? 'Đang chờ gửi…'
              : message.delivery === 'sending'
                ? 'Đang gửi…'
                : message.delivery === 'unknown'
                  ? 'Chưa rõ kết quả'
                  : 'Chưa gửi được'}
            {message.delivery === 'failed' && message.localRequestId && onEditFailed && (
              <button
                disabled={!canEditFailed}
                onClick={() => onEditFailed(message.localRequestId!)}
              >
                {['sticker', 'image', 'file'].includes(message.kind) ? 'Thử gửi lại' : 'Soạn lại'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
