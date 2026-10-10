'use client';
import { useAccountAccess } from '../use-account-access';
import { canAccount } from '../account-access';
import { useSendDraft } from '../send-state';
import type { Conversation } from '../types';
import { MessageComposer } from './message-composer';
export function ConversationComposer({ conversation }: { conversation: Conversation }) {
  const { accountId, conversationId } = conversation;
  const draft = useSendDraft(accountId, conversationId);
  const access = useAccountAccess();
  if (!access || !canAccount(access, accountId, 'write'))
    return (
      <p style={{ padding: '16px 20px', margin: 0, color: '#60738f' }}>
        Bạn có quyền xem cuộc trò chuyện này.
      </p>
    );
  return (
    <MessageComposer
      accountId={accountId}
      conversationId={conversationId}
      onSticker={draft.sendSticker}
      onFiles={draft.sendFiles}
      pastedImages={draft.pastedImages}
      onPastedImagesChange={draft.setPastedImages}
      onSendPastedImages={draft.sendPastedImages}
      onLike={draft.sendLike}
      reply={draft.reply}
      onCancelReply={() => draft.setReply(undefined)}
      textStyles={draft.styles}
      mentions={draft.mentions}
      recipient={conversation.name}
      accountName={conversation.accountName}
      value={draft.text}
      onValueChange={(...args) => {
        draft.change(...args);
        window.dispatchEvent(new CustomEvent('zalo-work-typing', { detail: { accountId, conversationId } }));
      }}
      onSend={() => void draft.send()}
      busy={draft.busy}
      blocked={draft.blocked}
      status={draft.status}
      error={draft.error}
      onCheck={() => void draft.send(true)}
    />
  );
}
