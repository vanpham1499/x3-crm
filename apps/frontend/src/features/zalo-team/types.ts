export type Conversation = {
  nativePreparation?: 'loading' | 'ready' | 'failed';
  hasArchive?: boolean;
  archiveOnly?: boolean;
  updatedAt?: number;
  id: number | string;
  accountId?: number;
  accountName?: string;
  accountAvatarSrc?: string;
  conversationId?: string;
  globalGroupId?: string;
  name: string;
  preview: string;
  previewInline?: ChatMessage['inline'];
  time: string;
  color: string;
  avatarSrc?: string;
  avatarMembers?: { name: string; avatarSrc?: string }[];
  memberCount?: number;
  unread?: number;
  unreadMarked?: boolean;
  group?: boolean;
  pinned?: boolean;
  muted?: boolean;
  category?: string;
};

export type StickerAnimation = { url?: string; sheet: boolean; frames: number; frameMs: number };
export type StickerChoice = {
  id: number;
  categoryId: number;
  name: string;
  preview: string;
  animation?: StickerAnimation;
};
export type EmojiChoice = { key: string; text: string; position: string };
export type ExpressionCatalog = {
  accountId: number;
  conversationId: string;
  categories: { id: number; name: string; preview?: string }[];
  stickers: StickerChoice[];
  emojiGroups: { id: string; name: string; items: EmojiChoice[] }[];
  recentEmoji: EmojiChoice[];
  sprite?: string;
};

export type MessageAttachment = {
  archiveUrl?: string;
  archivePreview?: string;
  archiveState?: string;
  archiveError?: string | null;
  hd?: boolean;
  animation?: StickerAnimation;
  kind: 'image' | 'sticker' | 'video' | 'audio' | 'file' | 'link';
  animated?: boolean;
  name: string;
  url?: string;
  preview?: string;
  size: number;
  description?: string;
  width?: number;
  height?: number;
};
export type ReplyTarget = { id: string; sender: string; text: string; preview?: string };
export type MessageOperation = 'star' | 'unstar' | 'pin' | 'recall' | 'delete' | 'react';
export type TopicSummary = {
  id: string;
  title: string;
  kind: 'note' | 'reminder';
  startTime: number;
  repeat: number;
  onlyMe: boolean;
};
export type ChatMessage = {
  crmSender?: { userId: number; name: string };
  archived?: boolean;
  topic?: TopicSummary;
  poll?: import('./polls').PollSummary;
  photoGroup?: { id: string; index: number; total: number };
  album?: ChatMessage[];
  starred?: boolean;
  canRecall?: boolean;
  currentReaction?: number | null;
  reactions?: {
    type: number;
    count: number;
    mine: boolean;
    users?: { id: string; name: string; mine: boolean }[];
  }[];
  styles?: import('./rich-text').RichStyle[];
  mentions?: import('./mentions').Mention[];
  delivery?: 'queued' | 'sending' | 'sent' | 'failed' | 'unknown';
  localRequestId?: string;
  id: string;
  clientId: string;
  time: number;
  type: string;
  kind: string;
  call?: {
    id?: string;
    direction: 'incoming' | 'outgoing';
    missed: boolean;
    video: boolean;
    durationSeconds: number | null;
    callback: boolean;
    reason: number;
  };
  mine: boolean;
  sender: { id?: string; name: string; avatarSrc?: string };
  text: string;
  inline?: { text: string; sprite?: string; position?: string }[];
  attachments: MessageAttachment[];
  quote: { id?: string; sender: string; text: string; preview?: string } | null;
};
export type MessagePage = {
  pins?: { id: string; text: string; sender: string; poll?: boolean; topic?: boolean }[] | null;
  accountId: number;
  conversationId: string;
  messages: ChatMessage[];
  cursor: { id: string; time: string } | null;
  hasMore: boolean;
  warning: string | null;
};

export type InfoMediaSection = 'images' | 'files' | 'links';
export type InfoMedia = MessageAttachment & {
  id: string;
  messageId: string;
  time: number;
  sender?: { id: string; name: string };
};
export type InfoMediaPage = { items: InfoMedia[]; cursor: string | null; error: string | null };
export type ConversationInfoResponse = {
  accountId: number;
  conversationId: string;
  metadata: {
    name: string;
    avatarSrc?: string;
    group: boolean;
    memberCount: number | null;
    selfId?: string;
    selfRole?: 'owner' | 'admin' | 'member';
    canLeave?: boolean;
    canAdd?: boolean;
    members: {
      id: string;
      name: string;
      avatarSrc?: string;
      role: 'owner' | 'admin' | 'member';
      self?: boolean;
      actions?: ('promote' | 'demote' | 'remove' | 'leave')[];
    }[];
    memberCursor: string | null;
    error: string | null;
  };
  sections: Partial<Record<InfoMediaSection, InfoMediaPage>>;
};

export type ConversationListResponse = {
  groups?: import('./group-links').LinkedGroup[];
  conversations: (Omit<Conversation, 'time' | 'color'> & {
    id: string;
    conversationId: string;
    accountId: number;
    accountName: string;
    updatedAt: number;
    previewError: boolean;
    previewState: 'ready' | 'unavailable' | 'sync_pending' | 'out_of_range' | 'loading';
  })[];
  accounts: {
    id: number;
    name: string;
    avatarSrc?: string;
    state: string;
    count: number;
    error: string | null;
    readiness?: {
      state: 'ready' | 'retry_wait' | 'action_required';
      stage: string;
      attempts?: number;
      since?: string;
      lastSuccessAt?: string | null;
      nextRetryAt?: string | null;
      stale?: boolean;
      requestId?: string;
    };
  }[];
  fetchedAt: string;
};
export type PickedAttachment = { file: File; kind: 'image' | 'file' };
