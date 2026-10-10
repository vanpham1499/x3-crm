'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageText } from './message-content';
import { Icon } from './icon';
import { emojiTokens, registerEmojiArtwork, useEmojiArtwork } from '../emoji-artwork';
import { teamFetch } from '../request';
import type { ConversationListResponse, ExpressionCatalog } from '../types';
import styles from '../campaigns.module.css';

export function useCampaignEmoji(accountId: number) {
  const client = useQueryClient();
  const query = useQuery<ExpressionCatalog>({
    queryKey: ['campaign-emoji-catalog', accountId],
    staleTime: 30 * 60000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      async function read(body: Record<string, unknown>) {
        const response = await teamFetch('/api/zalo-team/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, accountId }),
          signal,
        });
        const data = await response.json();
        if (!response.ok || data.error) throw Error('Chưa tải được emoji.');
        return data;
      }
      let chats = client.getQueryData<ConversationListResponse>(['inbox']);
      if (!chats?.conversations.some((c) => c.accountId === accountId && !c.archiveOnly))
        chats = await read({ action: 'conversations' });
      const peer = chats?.conversations.find(
        (c) => c.accountId === accountId && !c.archiveOnly,
      )?.conversationId;
      if (!peer) throw Error('Chưa có nguồn emoji.');
      const data = await read({ action: 'expressions', conversationId: peer });
      if (data.accountId !== accountId || data.conversationId !== peer)
        throw Error('Nguồn emoji không khớp.');
      return data;
    },
  });
  useEffect(() => {
    if (query.data) registerEmojiArtwork(accountId, query.data);
  }, [accountId, query.data]);
  useEmojiArtwork(accountId);
}

export function campaignAssetUrl(campaign: string, asset: string) {
  return `/api/zalo-team/campaigns/${encodeURIComponent(campaign)}/assets/${encodeURIComponent(asset)}`;
}
export function CampaignPreview({
  campaignId,
  accountId,
  part,
}: {
  campaignId: string;
  accountId: number;
  part: { kind: string; text?: string; name?: string; assetId?: string };
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [part.assetId]);
  if (part.kind === 'text')
    return <MessageText text={part.text || ''} inline={emojiTokens(part.text || '', accountId)} />;
  const src = part.assetId ? campaignAssetUrl(campaignId, part.assetId) : '';
  if (part.kind === 'image' && src && !failed)
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh ${part.name}`}>
        <img
          src={`${src}?v=${attempt}`}
          alt={part.name || 'Ảnh chiến dịch'}
          className={styles.reviewImage}
          onError={() => setFailed(true)}
        />
      </a>
    );
  return (
    <div className={styles.reviewFile}>
      <Icon name={part.kind === 'image' ? 'photo' : 'attachment'} size={28} />
      <span>
        <small>{failed ? 'Chưa tải được ảnh' : 'Tệp đính kèm'}</small>
        {part.kind === 'image' ? (
          <>
            <span>{part.name}</span>
            <button
              onClick={() => {
                setAttempt(attempt + 1);
                setFailed(false);
              }}
            >
              Tải lại ảnh
            </button>
          </>
        ) : (
          <a href={src} download={part.name}>
            {part.name}
          </a>
        )}
      </span>
    </div>
  );
}
