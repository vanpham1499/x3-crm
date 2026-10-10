'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamFetch } from '../request';
import type { ConversationListResponse } from '../types';
import { MessageEditor, type MessageEditorHandle } from './message-editor';
import { ExpressionPicker } from './expression-picker';
import { Icon } from './icon';
import { TeamSelect } from './team-select';
import styles from '../campaigns.module.css';

export type CampaignAsset = {
  id: string;
  name: string;
  kind?: string;
  previewUrl?: string;
  file?: File;
};

function AssetPreview({ asset }: { asset: CampaignAsset }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!asset.file || !/^image\/(png|jpeg|gif|webp)$/.test(asset.file.type)) return;
    const url = URL.createObjectURL(asset.file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.file]);
  return src || (asset.kind === 'image' && asset.previewUrl) ? (
    <img src={src || asset.previewUrl} alt={asset.name} className={styles.assetImage} />
  ) : (
    <Icon name="documents" size={24} />
  );
}

/** Campaign draft uses the same editor and emoji artwork as chat, without live send actions. */
export function CampaignMessageComposer({
  accountId,
  value,
  onChange,
  assets,
  onFiles,
  onRemove,
  busy,
}: {
  accountId?: number;
  value: string;
  onChange: (text: string) => void;
  assets: CampaignAsset[];
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const editor = useRef<MessageEditorHandle>(null);
  const photos = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fileError, setFileError] = useState('');
  const client = useQueryClient();
  // The native catalog requires an existing chat. Directory recipients may
  // never have chatted with this account; don't open their chats to fetch emoji.
  const emojiSource = useQuery({
    queryKey: ['campaign-emoji-source', accountId],
    enabled: emojiOpen && !!accountId,
    staleTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const cached = client.getQueryData<ConversationListResponse>(['inbox']);
      const peer = cached?.conversations.find((c) => c.accountId === accountId && !c.archiveOnly);
      if (peer) return peer.conversationId;
      const response = await teamFetch('/api/zalo-team/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'conversations', accountId }),
        signal,
      });
      const data = await response.json();
      if (!response.ok || data.error) throw Error('Chưa tải được biểu cảm.');
      const source = (data as ConversationListResponse).conversations.find(
        (c) => c.accountId === accountId && !c.archiveOnly,
      );
      if (!source) throw Error('Tài khoản chưa có hội thoại để tải biểu cảm.');
      return source.conversationId;
    },
  });
  const closeEmoji = useCallback(() => setEmojiOpen(false), []);
  useEffect(() => {
    setEmojiOpen(false);
    setFileError('');
  }, [accountId]);
  const addFiles = (items: File[]) => {
    if (!items.length || busy || !accountId) return;
    if (items.length + assets.length > 3) {
      setFileError('Tối đa 3 ảnh hoặc tệp trong một chiến dịch.');
      return;
    }
    if (items.some((file) => !file.size || file.size > 25 * 1024 * 1024)) {
      setFileError('Mỗi tệp phải có dữ liệu và không quá 25 MB.');
      return;
    }
    setFileError('');
    setEmojiOpen(false);
    onFiles(items);
  };
  return (
    <div className={styles.campaignComposer} aria-label="Soạn nội dung chiến dịch">
      <div className={styles.nativeTools} role="group" aria-label="Công cụ soạn nội dung">
        <button
          type="button"
          title="Biểu cảm"
          aria-label="Biểu cảm"
          data-expression-trigger=""
          aria-expanded={emojiOpen}
          disabled={busy || !accountId}
          onClick={() => setEmojiOpen(!emojiOpen)}
        >
          <Icon name="emoji" size={24} />
        </button>
        <button
          type="button"
          title="Chèn ảnh"
          aria-label="Chèn ảnh"
          disabled={busy || !accountId || assets.length >= 3}
          onClick={() => photos.current?.click()}
        >
          <Icon name="photo" size={24} />
        </button>
        <button
          type="button"
          title="Đính kèm tệp"
          aria-label="Đính kèm tệp"
          disabled={busy || !accountId || assets.length >= 3}
          onClick={() => files.current?.click()}
        >
          <Icon name="attachment" size={24} />
        </button>
        <div className={styles.fieldPicker}>
          <TeamSelect
            aria-label="Chèn trường"
            appearance="chip"
            value=""
            disabled={busy}
            onChange={(event) => {
              const field = event.target.value;
              // Restore the editor after the select menu releases its focus trap.
              requestAnimationFrame(() => editor.current?.insertText(field));
            }}
            options={[
              { value: '', label: 'Chèn trường' },
              { value: '{ten_khach}', label: 'Tên người nhận / nhóm' },
              { value: '{ten_nhan_vien}', label: 'Tên nhân viên CRM gửi' },
            ]}
          />
        </div>
        <span className={styles.characterCount}>{value.length}/2.000</span>
        <input
          ref={photos}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          aria-label="Chọn ảnh cho chiến dịch"
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <input
          ref={files}
          type="file"
          hidden
          multiple
          aria-label="Chọn tệp cho chiến dịch"
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
      </div>
      {emojiOpen && !!accountId && (
        <div className={styles.campaignExpressions}>
          {emojiSource.data ? (
            <ExpressionPicker
              accountId={accountId}
              conversationId={emojiSource.data}
              tab="emoji"
              emojiOnly
              onTabChange={() => {}}
              blocked={busy}
              onEmoji={(emoji) => editor.current?.insertText(emoji.text) || false}
              onSticker={() => {}}
              onClose={closeEmoji}
            />
          ) : emojiSource.isError ? (
            <p role="alert">
              {emojiSource.error.message}{' '}
              <button type="button" onClick={() => void emojiSource.refetch()}>
                Thử lại
              </button>
            </p>
          ) : (
            <p role="status">Đang tải biểu cảm…</p>
          )}
        </div>
      )}
      <MessageEditor
        ref={editor}
        accountId={accountId}
        recipient="người nhận chiến dịch"
        value={value}
        onChange={onChange}
        blocked={busy}
        sendOnEnter={false}
        allowFormatting={false}
        placeholder="Nhập nội dung tin nhắn…"
        onSend={() => {}}
        onPasteImages={addFiles}
      />
      {fileError && (
        <p className={styles.composerFileError} role="alert">
          {fileError}
        </p>
      )}
      {!!assets.length && (
        <div className={styles.attachments} aria-label="Tệp đính kèm chiến dịch">
          {assets.map((asset) => (
            <div className={styles.attachment} key={asset.id}>
              <AssetPreview asset={asset} />
              <span title={asset.name}>{asset.name}</span>
              <button
                type="button"
                aria-label={`Bỏ tệp ${asset.name}`}
                disabled={busy}
                onClick={() => onRemove(asset.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {busy && (
        <p className={styles.muted} role="status">
          Đang xử lý…
        </p>
      )}
    </div>
  );
}
