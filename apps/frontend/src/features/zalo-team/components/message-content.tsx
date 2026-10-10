'use client';
import { noMentions, validMentions, type Mention } from '../mentions';
import { imageSources } from '../media-source';
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';
import { StickerArtwork } from './sticker-artwork';
import { InlineEmoji } from './inline-emoji';
import { FileIcon } from './file-icon';
import { documentKind, FileDocumentDialog, FileDocumentPreview, FileVideo } from './file-preview';
import { fileSize } from '../message-presentation';
import type { ChatMessage, MessageAttachment } from '../types';
import styles from '../zalo-team.module.css';
import { codesAt, richCss, validRichStyles, type RichStyle } from '../rich-text';

function TextLinks({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function MessageText({
  text,
  inline,
  textStyles,
  mentions = noMentions,
}: {
  text: string;
  inline?: ChatMessage['inline'];
  textStyles?: RichStyle[];
  mentions?: Mention[];
}) {
  textStyles = validRichStyles(textStyles, text) ? textStyles : [];
  if (mentions.length && validMentions(mentions, text)) {
    textStyles = [
      ...(textStyles || []),
      ...mentions.map((m) => ({ start: m.pos, len: m.len, st: 'c_005ae0' })),
    ];
  }
  // Quick Like must render immediately even before the expression catalog is opened.
  if (text === '/-strong')
    return (
      <div className={styles.messageText}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/zalo-team/like.svg"
          width={40}
          height={40}
          alt="👍"
          style={{ display: 'block' }}
        />
      </div>
    );
  const tokens = inline?.length && inline.map((t) => t.text).join('') === text ? inline : null;
  if (textStyles?.length) {
    let tokenStart = 0;
    const pieces = (tokens || [{ text }]).map((token) => {
      const start = tokenStart;
      tokenStart += token.text.length;
      return { ...token, start, end: tokenStart };
    });
    let lineStart = 0;
    return (
      <div className={`${styles.messageText} ${styles.formattedMessage}`}>
        {text.split('\n').map((line, index) => {
          const start = lineStart,
            end = start + line.length;
          lineStart = end + 1;
          const block = codesAt(textStyles, start);
          const list = block.find((c) => c.startsWith('lst_'));
          const indent = Number(block.find((c) => c.startsWith('ind_'))?.slice(4) || 0);
          return (
            <div key={index} data-list={list} style={indent ? { marginLeft: indent } : undefined}>
              {!line && <br />}
              {pieces
                .filter((p) => p.end > start && p.start < end)
                .flatMap((p) => {
                  if (p.sprite && p.position)
                    return [
                      <InlineEmoji
                        key={p.start}
                        text={p.text}
                        sprite={p.sprite}
                        position={p.position}
                      />,
                    ];
                  const result = [];
                  for (let at = Math.max(start, p.start); at < Math.min(end, p.end);) {
                    const marks = codesAt(textStyles, at),
                      signature = marks.join(',');
                    let next = at + 1;
                    while (
                      next < Math.min(end, p.end) &&
                      codesAt(textStyles, next).join(',') === signature
                    )
                      next++;
                    result.push(
                      <span key={at} style={richCss(marks)}>
                        <TextLinks text={text.slice(at, next)} />
                      </span>,
                    );
                    at = next;
                  }
                  return result;
                })}
            </div>
          );
        })}
      </div>
    );
  }
  const emojiOnly =
    tokens &&
    tokens.filter((t) => t.sprite).length <= 3 &&
    tokens.every((t) => t.sprite || !t.text.trim());
  return (
    <div className={`${styles.messageText} ${emojiOnly ? styles.emojiOnly : ''}`}>
      {tokens ? (
        tokens.map((token, i) =>
          token.sprite && token.position ? (
            <InlineEmoji
              key={i}
              text={token.text}
              sprite={token.sprite}
              position={token.position}
            />
          ) : (
            <TextLinks key={i} text={token.text} />
          ),
        )
      ) : (
        <TextLinks text={text} />
      )}
    </div>
  );
}

function UnavailableMedia({
  name,
  detail = 'Không tải được từ Zalo',
}: {
  name: string;
  detail?: string;
}) {
  return (
    <div className={styles.unavailableMedia}>
      <Icon name="photo" size={28} />
      <span>
        {name || 'Tệp đính kèm'}
        <small>{detail}</small>
      </span>
    </div>
  );
}

function FileCard({
  item,
  onPreview,
  onDocument,
}: {
  item: MessageAttachment;
  onPreview: (src: string) => void;
  onDocument: () => void;
}) {
  const canPreview = /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(item.name);
  const extensionAt = item.name.lastIndexOf('.');
  return (
    <div className={styles.fileCard}>
      <FileIcon name={item.name} />
      <div className={styles.fileDetails}>
        {item.url ? (
          <a
            className={styles.fileName}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={item.name}
            onClick={(event) => {
              if (documentKind(item.name) && item.url) {
                event.preventDefault();
                onDocument();
                return;
              }
              if (canPreview && item.url) {
                event.preventDefault();
                onPreview(item.url);
              }
            }}
          >
            <span>
              {extensionAt > 0 ? item.name.slice(0, extensionAt) : item.name || 'Tệp đính kèm'}
            </span>
            {extensionAt > 0 && <span>{item.name.slice(extensionAt)}</span>}
          </a>
        ) : (
          <span className={styles.fileName}>{item.name || 'Tệp đính kèm'}</span>
        )}
        <small>
          {fileSize(item.size) || (!item.url ? 'Tệp chưa có trong phiên này' : 'Tệp đính kèm')}
        </small>
      </div>
      {item.url && (
        <a
          className={styles.fileDownload}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Tải về ${item.name}`}
          title="Tải về"
        >
          <Icon name="fileDownload" size={20} />
        </a>
      )}
    </div>
  );
}

export function MessageAttachmentView({
  item,
  onPreview,
}: {
  item: MessageAttachment;
  onPreview: (src: string) => void;
}) {
  const state = item.kind !== 'link' ? item.archiveState : undefined;
  const tipId = useId();
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    above: boolean;
    host: HTMLElement;
  } | null>(null);
  const showTip = (target: HTMLElement) => {
    const r = target.getBoundingClientRect();
    setTip({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 261)),
      top: r.top > 150 ? r.top - 8 : r.bottom + 8,
      above: r.top > 150,
      host: target.closest('dialog') || document.body,
    });
  };
  const label =
    state === 'dismissed'
      ? 'Đã dọn khỏi hàng đợi'
      : state === 'ready'
        ? 'Đã lưu trên server'
        : state === 'partial'
          ? 'Mới lưu ảnh xem trước'
          : state === 'pending'
            ? 'Đang chờ lưu'
            : 'Chưa lưu được';
  const description =
    state === 'dismissed'
      ? 'Chưa có bản tệp trong kho. Có thể đưa về hàng đợi tại Đồng bộ & sao lưu → Dọn dẹp.'
      : state === 'ready'
        ? 'Tệp đã được lưu trong kho Zalo Team. Bạn có thể mở lại bản lưu khi liên kết Zalo hết hạn.'
        : state === 'partial'
          ? 'Ảnh xem trước đã lưu; tệp gốc chưa lưu thành công.'
          : state === 'pending'
            ? 'Zalo Team đang xếp hàng tải tệp về server.'
            : state === 'missing'
              ? 'Bản ghi còn nhưng tệp trên ổ lưu trữ bị thiếu. Cần kiểm tra hoặc khôi phục sao lưu.'
              : item.archiveError || 'Kho Zalo Team chưa có bản lưu của tệp này.';
  return (
    <div className={styles.archiveAttachment}>
      <AttachmentContent item={item} onPreview={onPreview} />
      {state && (
        <span
          className={styles.archiveBadge}
          data-state={state}
          tabIndex={0}
          aria-label={label}
          aria-describedby={tip ? tipId : undefined}
          onMouseEnter={(e) => showTip(e.currentTarget)}
          onMouseLeave={() => setTip(null)}
          onFocus={(e) => showTip(e.currentTarget)}
          onBlur={() => setTip(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTip(null);
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M7 18H6a4 4 0 0 1-.6-7.95 6.5 6.5 0 0 1 12.5-1.5A4.8 4.8 0 0 1 18 18h-1" />
            <path d={state === 'ready' ? 'm8 15 3 3 5-6' : 'M12 12v4m0 3v.1'} />
          </svg>
          {tip &&
            createPortal(
              <span
                id={tipId}
                className={styles.archiveTooltip}
                role="tooltip"
                style={{
                  position: 'fixed',
                  display: 'block',
                  left: tip.left,
                  top: tip.top,
                  bottom: 'auto',
                  transform: tip.above ? 'translateY(-100%)' : undefined,
                  zIndex: 10000,
                }}
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </span>,
              tip.host,
            )}
        </span>
      )}
    </div>
  );
}

function AttachmentContent({
  item,
  onPreview,
}: {
  item: MessageAttachment;
  onPreview: (src: string) => void;
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [documentOpen, setDocumentOpen] = useState(false);
  const setFailedSource = (url: string) => setFailedSources((previous) => [...previous, url]);
  const source = imageSources(item, !!item.animated).find(
    (url) => url && !failedSources.includes(url),
  );
  const available = !!source;
  if (item.archiveState && !available)
    return (
      <UnavailableMedia
        name={`${item.name || 'Tệp đính kèm'} · ${item.archiveState === 'pending' ? 'Đang chờ lưu' : 'Chưa tải được bản lưu'}`}
        detail={
          item.archiveState === 'pending'
            ? 'Tệp đang chờ tải về kho Zalo Team'
            : item.archiveError || 'Kho Zalo Team chưa có tệp gốc'
        }
      />
    );
  if (item.kind === 'image' || item.kind === 'sticker') {
    if (!available)
      return (
        <UnavailableMedia name={item.kind === 'sticker' ? 'Sticker' : item.name || 'Hình ảnh'} />
      );
    return (
      <button
        className={styles.messageImageButton}
        onClick={() => onPreview(item.url || source)}
        aria-label={item.kind === 'sticker' ? 'Xem sticker' : 'Xem ảnh lớn'}
      >
        {item.kind === 'sticker' ? (
          <StickerArtwork preview={source!} animation={item.animation} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */ <img
            src={source}
            alt={item.name || 'Hình ảnh'}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedSource(source!)}
            className={styles.messageImage}
            style={
              item.width && item.height
                ? {
                    width: Math.min(item.width, 480, (400 * item.width) / item.height),
                    aspectRatio: `${item.width} / ${item.height}`,
                  }
                : undefined
            }
          />
        )}
      </button>
    );
  }
  if (item.kind === 'video' && item.url)
    return (
      <video
        className={styles.messageVideo}
        controls
        preload="none"
        poster={item.preview}
        src={item.url}
      />
    );
  if (item.kind === 'audio' && item.url)
    return <audio className={styles.messageAudio} controls preload="none" src={item.url} />;
  if (item.kind === 'link' && item.url) {
    let domain = item.url;
    try {
      domain = new URL(item.url).hostname.replace(/^www\./, '');
    } catch {
      /* Keep the URL visible if malformed. */
    }
    return (
      <div className={styles.linkCard}>
        <a className={styles.linkAddress} href={item.url} target="_blank" rel="noopener noreferrer">
          {item.url}
        </a>
        <a className={styles.linkPreview} href={item.url} target="_blank" rel="noopener noreferrer">
          {item.preview && !failedSources.includes(item.preview) && (
            /* eslint-disable-next-line @next/next/no-img-element */ <img
              className={styles.linkThumbnail}
              src={item.preview}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailedSource(item.preview!)}
            />
          )}
          <div className={styles.linkInfo}>
            {item.name && item.name !== item.url && <strong>{item.name}</strong>}
            {item.description && <span className={styles.linkDescription}>{item.description}</span>}
            <span className={styles.linkDomain}>{domain}</span>
          </div>
        </a>
      </div>
    );
  }
  return (
    <div className={styles.messageAttachment}>
      {item.url && /\.(mp4|webm|mov)$/i.test(item.name) ? (
        <FileVideo item={item} />
      ) : item.url && documentKind(item.name) ? (
        <button
          className={styles.documentPreviewButton}
          onClick={() => setDocumentOpen(true)}
          aria-label={`Xem trước ${item.name}`}
        >
          <FileDocumentPreview item={item} />
        </button>
      ) : (
        item.preview &&
        !failedSources.includes(item.preview) && (
          <button
            className={styles.filePreview}
            onClick={() => onPreview(item.preview!)}
            aria-label="Xem ảnh xem trước"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.preview}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailedSource(item.preview!)}
              className={styles.messageThumbnail}
            />
          </button>
        )
      )}
      <FileCard item={item} onPreview={onPreview} onDocument={() => setDocumentOpen(true)} />
      {documentOpen && <FileDocumentDialog item={item} onClose={() => setDocumentOpen(false)} />}
    </div>
  );
}
