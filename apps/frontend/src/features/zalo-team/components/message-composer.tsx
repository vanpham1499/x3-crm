'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMentionPicker } from './mention-picker';
import { noMentions, type Mention } from '../mentions';
import { Icon, IconButton } from './icon';
import { ExpressionPicker, type ExpressionTab } from './expression-picker';
import { MessageEditor, type MessageEditorHandle } from './message-editor';
import { FormatToolbar } from './format-toolbar';
import { ClipboardImageTray } from './clipboard-image-tray';
import { PollMenu } from './poll-create';
import type { RichStyle } from '../rich-text';
import type { StickerChoice, PickedAttachment, ReplyTarget } from '../types';
import styles from '../zalo-team.module.css';

const tools = [
  ['sticker', 'Gửi sticker'],
  ['photo', 'Gửi hình ảnh'],
  ['attachment', 'Đính kèm file'],
  ['format', 'Định dạng tin nhắn'],
  ['more', 'Thêm'],
] as const;

/** Both entry buttons share the same native Sticker/Emoji picker. */
export function MessageComposer({
  recipient,
  value,
  onValueChange,
  onSend,
  busy = false,
  blocked = false,
  accountName,
  status,
  error,
  onCheck,
  accountId,
  conversationId,
  onSticker,
  onFiles,
  pastedImages,
  onPastedImagesChange: setPastedImages,
  onSendPastedImages,
  onLike,
  textStyles,
  mentions = noMentions,
  reply,
  onCancelReply,
}: {
  reply?: ReplyTarget;
  onCancelReply?: () => void;
  recipient: string;
  value: string;
  onValueChange: (value: string, styles: RichStyle[], mentions: Mention[]) => void;
  mentions?: Mention[];
  textStyles?: RichStyle[];
  onLike?: () => void;
  onSend: () => void;
  busy?: boolean;
  blocked?: boolean;
  accountName?: string;
  status?: string;
  error?: string;
  onCheck?: () => void;
  accountId?: number;
  conversationId?: string;
  onSticker?: (sticker: StickerChoice) => void;
  onFiles?: (files: PickedAttachment[]) => void;
  pastedImages: File[];
  onPastedImagesChange: (files: File[]) => void;
  onSendPastedImages: () => void;
}) {
  const input = useRef<MessageEditorHandle>(null);
  const [mentionCaret, setMentionCaret] = useState<{ start: number; end: number } | null>(null);
  const onCaret = useCallback(
    (pos: { start: number; end: number } | null) =>
      setMentionCaret((old) => (old?.start === pos?.start && old?.end === pos?.end ? old : pos)),
    [],
  );
  const mentionPicker = useMentionPicker({
    accountId,
    conversationId,
    value,
    mentions,
    caret: mentionCaret,
    blocked,
    onSelect: (member, range) => input.current?.insertMention(member, range) || false,
  });
  useEffect(() => {
    if (reply) input.current?.focus();
  }, [reply]);
  const [formatting, setFormatting] = useState(!!textStyles?.length);
  const [expanded, setExpanded] = useState(false);
  const [formatState, setFormatState] = useState<string[]>([]);
  const onFormatState = useCallback((codes: string[]) => {
    setFormatState((previous) =>
      previous.length === codes.length && previous.every((code, index) => code === codes[index])
        ? previous
        : codes,
    );
  }, []);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const clipboardInput = useRef<HTMLInputElement>(null);
  const chooserTarget = useRef<string | null>(null);
  const target = `${accountId}:${conversationId}`;
  const [fileError, setFileError] = useState('');
  const pickFiles = (files: FileList | File[] | null, kind: 'image' | 'file', stage = false) => {
    if (!files?.length || blocked) return;
    if (chooserTarget.current && chooserTarget.current !== target) {
      chooserTarget.current = null;
      setFileError('Cuộc trò chuyện đã thay đổi. Vui lòng chọn lại tệp.');
      return;
    }
    chooserTarget.current = null;
    const selected = Array.from(files);
    const next = (stage ? [...pastedImages, ...selected] : selected).map((file) => ({
      file,
      kind,
    }));
    if (
      next.length > 10 ||
      next.reduce((sum, item) => sum + item.file.size, 0) > 100 * 1024 * 1024
    ) {
      setFileError('Chọn tối đa 10 tệp, tổng dung lượng tối đa 100 MB.');
      return;
    }
    if (next.some((item) => item.file.size === 0 || item.file.size > 25 * 1024 * 1024)) {
      setFileError('Mỗi tệp phải có dữ liệu và không quá 25 MB.');
      return;
    }
    if (
      next.some(
        (item) => item.kind === 'image' && !/^image\/(png|jpeg|gif|webp)$/.test(item.file.type),
      )
    ) {
      setFileError('Chọn ảnh JPG, PNG, GIF hoặc WebP. Định dạng khác có thể gửi bằng nút File.');
      return;
    }
    setFileError('');
    closePicker();
    if (stage) {
      setPastedImages(next.map(({ file }) => file));
      input.current?.focus();
    } else onFiles?.(next);
  };
  const [expressionTab, setExpressionTab] = useState<ExpressionTab | null>(null);
  const closePicker = useCallback(() => setExpressionTab(null), []);
  const submit = () => {
    if (blocked) return;
    if (!value.trim() && !pastedImages.length) return;
    closePicker();
    if (value.trim()) onSend();
    if (pastedImages.length && onFiles) {
      onSendPastedImages();
    }
  };
  const selectTab = (tab: ExpressionTab) =>
    setExpressionTab((current) => (current === tab ? null : tab));
  useEffect(() => {
    setExpressionTab(null);
    setMentionCaret(null);
    setFileError('');
    setExpanded(false);
    setFormatState([]);
  }, [accountId, conversationId]);
  return (
    <footer
      className={`${styles.composer} ${formatting ? styles.richComposer : ''} ${expanded && formatting ? styles.expandedComposer : ''}`}
      aria-label="Soạn tin nhắn"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          setFormatting((v) => !v);
          input.current?.focus();
        }
      }}
    >
      {reply && (
        <div className={styles.replyBanner}>
          <Icon name="reply" size={16} />
          {reply.preview && <img src={reply.preview} alt="" />}
          <div>
            <div>
              Trả lời <strong>{reply.sender}</strong>
            </div>
            <span>{reply.text}</span>
          </div>
          <button aria-label="Hủy trả lời" onClick={onCancelReply}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <div className={styles.composerStatus} role="status">
        <span>Gửi bằng {accountName} · Enter để gửi, Shift+Enter xuống dòng</span>
        <span>{busy ? 'Đang gửi…' : status === 'sent' ? 'Đã gửi' : ''}</span>
      </div>
      <div className={styles.composerToolbar} role="group" aria-label="Công cụ soạn tin">
        <input
          ref={clipboardInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          hidden
          aria-label="Chọn thêm ảnh vào khay"
          onChange={(e) => {
            pickFiles(e.target.files, 'image', true);
            e.target.value = '';
          }}
        />
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          hidden
          aria-label="Chọn ảnh để gửi"
          onChange={(e) => {
            pickFiles(e.target.files, 'image');
            e.target.value = '';
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          aria-label="Chọn file để gửi"
          onChange={(e) => {
            pickFiles(e.target.files, 'file');
            e.target.value = '';
          }}
        />
        {tools.map(([icon, label]) =>
          icon === 'more' ? (
            <PollMenu
              key={icon}
              accountId={accountId}
              conversationId={conversationId}
              blocked={blocked}
            />
          ) : (
            <span key={icon} data-expression-trigger={icon === 'sticker' ? '' : undefined}>
              <IconButton
                icon={icon}
                label={label}
                active={
                  (icon === 'sticker' && expressionTab === 'sticker') ||
                  (icon === 'format' && formatting)
                }
                onClick={
                  icon === 'format'
                    ? () => {
                        setFormatting((v) => !v);
                        closePicker();
                        input.current?.focus();
                      }
                    : icon === 'photo' && onFiles
                      ? () => {
                          if (!blocked) {
                            chooserTarget.current = target;
                            photoInput.current?.click();
                          }
                        }
                      : icon === 'attachment' && onFiles
                        ? () => {
                            if (!blocked) {
                              chooserTarget.current = target;
                              fileInput.current?.click();
                            }
                          }
                        : icon === 'sticker' && accountId && onSticker
                          ? () => selectTab('sticker')
                          : undefined
                }
              />
            </span>
          ),
        )}
      </div>
      {fileError && (
        <div className={styles.composerError} role="alert">
          {fileError}
        </div>
      )}
      <div className={styles.composerInput}>
        {mentionPicker.popup}
        <MessageEditor
          key={target}
          ref={input}
          accountId={accountId}
          recipient={recipient}
          blocked={blocked}
          value={value}
          textStyles={textStyles}
          mentions={mentions}
          onCaret={onCaret}
          onMentionKey={mentionPicker.keyDown}
          mentionListId={mentionPicker.listId}
          activeMentionId={mentionPicker.activeId}
          onFormatState={onFormatState}
          onRichPaste={() => setFormatting(true)}
          onPasteImages={(files) => pickFiles(files, 'image', true)}
          formatting={formatting}
          onChange={onValueChange}
          onSend={submit}
        />
        {formatting && (
          <FormatToolbar
            active={formatState}
            blocked={blocked}
            onFormat={(code) => input.current?.format(code)}
            expanded={expanded}
            onExpand={() => setExpanded((v) => !v)}
          />
        )}
        <div className={styles.composerActions}>
          <span data-expression-trigger="">
            <IconButton
              icon="emoji"
              label="Biểu cảm"
              active={expressionTab === 'emoji'}
              onClick={() => selectTab('emoji')}
            />
          </span>
          {value.trim() || pastedImages.length ? (
            <button type="button" className={styles.sendButton} disabled={blocked} onClick={submit}>
              Gửi
            </button>
          ) : (
            <button
              type="button"
              className={styles.likeButton}
              disabled={blocked || !onLike}
              aria-label="Gửi nhanh biểu tượng cảm xúc"
              title="Gửi nhanh biểu tượng cảm xúc"
              onClick={() => {
                if (!blocked) {
                  closePicker();
                  onLike?.();
                  input.current?.focus();
                }
              }}
            >
              {/* Public Zalo artwork, independent of the operating system emoji font. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/zalo-team/like.svg" width={24} height={24} alt="" />
            </button>
          )}
        </div>
      </div>
      <ClipboardImageTray
        files={pastedImages}
        blocked={blocked}
        onRemove={(index) => setPastedImages(pastedImages.filter((_, i) => i !== index))}
        onClear={() => setPastedImages([])}
        onAdd={() => {
          chooserTarget.current = target;
          clipboardInput.current?.click();
        }}
      />
      {expressionTab && accountId && conversationId && (
        <ExpressionPicker
          key={`${accountId}:${conversationId}`}
          accountId={accountId}
          conversationId={conversationId}
          tab={expressionTab}
          onTabChange={setExpressionTab}
          blocked={blocked}
          onClose={closePicker}
          onEmoji={(emoji) => input.current?.insertText(emoji.text) || false}
          onSticker={(sticker) => {
            if (!blocked && onSticker) {
              onSticker(sticker);
              closePicker();
              input.current?.focus();
            }
          }}
        />
      )}
      {error && (
        <div className={styles.composerError} role="alert">
          {error}
          {blocked && (
            <button type="button" disabled={busy} onClick={onCheck}>
              Kiểm tra kết quả
            </button>
          )}
        </div>
      )}
    </footer>
  );
}
