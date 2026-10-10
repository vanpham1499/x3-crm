'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { TopicIcon } from './topic-create';
import styles from '../zalo-team.module.css';
export function TopicEvent({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDialogElement>(null),
    topic = message.topic!;
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  const label = topic.kind === 'reminder' ? 'Nhắc hẹn' : 'Ghi chú';
  useEffect(() => {
    const show = (event: Event) => {
      if ((event as CustomEvent).detail === message.id) setOpen(true);
    };
    window.addEventListener('zalo-team-topic-open', show);
    return () => window.removeEventListener('zalo-team-topic-open', show);
  }, [message.id]);
  return (
    <>
      {topic.kind === 'reminder' && message.type === 'MSG_ECARD' ? (
        <article data-message-id={message.id} className={styles.reminderCard}>
          <header>
            <Avatar
              conversation={{
                name: message.sender.name,
                avatarSrc: message.sender.avatarSrc,
                color: '#e5efff',
              }}
              size={24}
            />
            <span>{message.mine ? 'Bạn' : message.sender.name} tạo nhắc hẹn</span>
          </header>
          <div className={styles.reminderCardBody}>
            <div className={styles.reminderCalendar}>
              <span>
                {new Date(topic.startTime)
                  .toLocaleDateString('vi-VN', { weekday: 'long' })
                  .toUpperCase()}
              </span>
              <strong>{String(new Date(topic.startTime).getDate()).padStart(2, '0')}</strong>
              <small>THÁNG {new Date(topic.startTime).getMonth() + 1}</small>
            </div>
            <div>
              <button type="button" className={styles.reminderTitle} onClick={() => setOpen(true)}>
                {topic.title}
              </button>
              <p>
                <TopicIcon kind="reminder" />
                {new Date(topic.startTime).toLocaleString('vi-VN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {topic.repeat > 0 && <p>Nhắc hẹn lặp lại</p>}
            </div>
          </div>
          <button
            type="button"
            className={styles.reminderDetailButton}
            onClick={() => setOpen(true)}
          >
            Xem chi tiết
          </button>
        </article>
      ) : (
        <article
          data-message-id={message.id}
          className={`${styles.systemMessage} ${styles.topicEvent}`}
        >
          <span>
            <TopicIcon kind={topic.kind} />
            <span>{message.text}</span>
            <button type="button" onClick={() => setOpen(true)}>
              Xem
            </button>
          </span>
        </article>
      )}
      {open && (
        <dialog
          ref={ref}
          className={`${styles.settingsDialog} ${styles.topicDialog}`}
          aria-label={label}
          onCancel={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
        >
          <header>
            <strong>{label}</strong>
            <button type="button" aria-label="Đóng" onClick={() => setOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m4 4 12 12M16 4 4 16" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </header>
          <div className={styles.topicDetail}>
            <small>
              Tạo bởi {message.sender.name || 'bạn'} -{' '}
              {new Date(message.time).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })}
            </small>
            <p>{topic.title}</p>
            {topic.kind === 'reminder' && (
              <>
                <div>
                  <TopicIcon kind="reminder" />
                  <time>
                    {new Date(topic.startTime).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </time>
                </div>
                {topic.onlyMe && <span>Chỉ mình tôi</span>}
                {topic.repeat > 0 && <span>Nhắc hẹn lặp lại</span>}
              </>
            )}
          </div>
          <footer>
            <button
              type="button"
              className={styles.topicCopy}
              aria-label={topic.kind === 'note' ? 'Copy ghi chú' : 'Copy nội dung nhắc hẹn'}
              onClick={() => navigator.clipboard.writeText(topic.title)}
            >
              <Icon name="copy" />
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </footer>
        </dialog>
      )}
    </>
  );
}
