import type { Conversation, ConversationInfoResponse } from './types';
import { packets } from './live';
import { archiveRequest } from './archive';
import { mergeStoredMedia } from './media-source';
import type { InfoMedia } from './types';

export async function readConversationInfo(
  conversation: Conversation,
  signal: AbortSignal,
  section = 'overview',
  cursor?: string | null,
  onData?: (data: ConversationInfoResponse) => void,
): Promise<ConversationInfoResponse> {
  if ((conversation.hasArchive || conversation.archiveOnly) && section !== 'members') {
    if (section === 'overview') {
      const pages = await Promise.all(
        ['images', 'files', 'links'].map((key) => readConversationInfo(conversation, signal, key)),
      );
      const combined: ConversationInfoResponse = {
        ...pages[0],
        sections: Object.assign({}, ...pages.map((page) => page.sections)),
      };
      for (const page of Object.values(combined.sections))
        if (page) page.items = page.items.slice(0, 6);
      onData?.(combined);
      return combined;
    }
    const position: { stored?: { id: string; time: string } | null; live?: string | null } = cursor
      ? JSON.parse(cursor)
      : {};
    const liveRequest =
      conversation.archiveOnly || (cursor && position.live === null)
        ? Promise.resolve(null)
        : readNativeInfo(
            conversation,
            AbortSignal.any([signal, AbortSignal.timeout(5000)]),
            section,
            position.live,
          ).catch((error) => {
            if (error instanceof Error && error.message === 'WEB_IDENTITY_MISMATCH') throw error;
            return null;
          });
    const storedRequest =
      cursor && position.stored === null
        ? {
            accountId: conversation.accountId!,
            conversationId: conversation.conversationId!,
            items: [] as InfoMedia[],
            cursor: null,
          }
        : archiveRequest<{
            accountId: number;
            conversationId: string;
            items: InfoMedia[];
            cursor: { id: string; time: string } | null;
          }>(
            {
              kind: 'media-library',
              accountId: conversation.accountId,
              conversationId: conversation.conversationId,
              section,
              ...(position.stored ? { before: position.stored } : {}),
            },
            signal,
          );
    const [result, live] = await Promise.all([storedRequest, liveRequest]);
    if (
      result.accountId !== conversation.accountId ||
      result.conversationId !== conversation.conversationId
    )
      throw Error('WEB_IDENTITY_MISMATCH');
    const data: ConversationInfoResponse = {
      accountId: result.accountId,
      conversationId: result.conversationId,
      metadata: {
        name: conversation.name,
        avatarSrc: conversation.avatarSrc,
        group: !!conversation.group,
        memberCount: conversation.memberCount ?? null,
        members: [],
        memberCursor: null,
        error: null,
      },
      sections: {},
    };
    for (const key of ['images', 'files', 'links'] as const) {
      if (section !== 'overview' && section !== key) continue;
      const kinds =
        key === 'images' ? ['image', 'video'] : key === 'files' ? ['file', 'audio'] : ['link'];
      data.sections[key] = {
        items: mergeInfoMedia(
          result.items.filter((a) => kinds.includes(a.kind)),
          live?.sections[key]?.items || [],
        ),
        cursor:
          result.cursor || live?.sections[key]?.cursor
            ? JSON.stringify({ stored: result.cursor, live: live?.sections[key]?.cursor ?? null })
            : null,
        error: null,
      };
    }
    onData?.(data);
    return data;
  }
  return readNativeInfo(conversation, signal, section, cursor, onData);
}

export function mergeInfoMedia(stored: InfoMedia[], live: InfoMedia[]): InfoMedia[] {
  const items = new Map(stored.map((item) => [item.id, item]));
  for (const item of live) {
    const saved = items.get(item.id);
    const same =
      saved && saved.kind === item.kind && saved.name === item.name && saved.size === item.size;
    items.set(item.id, same ? mergeStoredMedia(item, saved, item.time) : item);
  }
  return [...items.values()].sort((a, b) => b.time - a.time);
}

async function readNativeInfo(
  conversation: Conversation,
  signal: AbortSignal,
  section: string,
  cursor?: string | null,
  onData?: (data: ConversationInfoResponse) => void,
): Promise<ConversationInfoResponse> {
  const response = await fetch('/api/zalo-team/conversation-info', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({
      accountId: conversation.accountId,
      conversationId: conversation.conversationId,
      section,
      ...(cursor ? { cursor } : {}),
    }),
  });
  let result: ConversationInfoResponse | undefined;
  await packets<ConversationInfoResponse>(response, (data) => {
    if (
      data.accountId !== conversation.accountId ||
      data.conversationId !== conversation.conversationId
    )
      throw Error('WEB_IDENTITY_MISMATCH');
    result = data;
    onData?.(data);
  });
  if (!result) throw Error('WEB_INFO_UNAVAILABLE');
  return result;
}

export function infoError(error: unknown) {
  if (error instanceof Error && error.message === 'WEB_ACCOUNT_OFFLINE')
    return 'Tài khoản đã mất kết nối. Hãy kết nối lại trong tab Tài khoản.';
  if (error instanceof Error && error.message === 'WEB_CONTENT_PROTECTED')
    return 'Nội dung được bảo vệ trong Zalo.';
  return 'Chưa tải được thông tin. Vui lòng thử lại.';
}
