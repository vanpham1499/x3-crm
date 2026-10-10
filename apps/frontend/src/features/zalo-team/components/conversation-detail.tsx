'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { GroupDialog } from './group-dialog';
import { ArchiveHistoryDialog } from './archive-history';
import { useArchiveAttachments } from '../use-archive-attachments';
import type { SearchHit } from '../message-search';
import { ConversationTags } from './shared-tags';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from './avatar';
import { ChatProfileDialog } from './chat-profile-dialog';
import { ConversationHeaderName } from './conversation-settings-controls';
import { Icon, IconButton } from './icon';
import { MediaViewer } from './media-viewer';
import { MessageItem } from './message-item';
import { PinnedMessages } from './pinned-messages';
import { FriendshipBanner } from './friendship-banner';
import { ConversationComposer } from './conversation-composer';
import { WorkPresence } from './work-presence';
import { VoiceCall, type VoiceCallHandle } from './voice-call';
import { requestId, useSendDraft } from '../send-state';
import { emojiTokens } from '../emoji-artwork';
import { subscribeChanges, affects } from '../live';
import { readTimelinePage } from '../timeline';
import { mergeTimelineMessages } from '../timeline-merge';
import { archiveRequest } from '../archive';
import { messageLayout } from '../message-presentation';
import { groupPhotoMessages } from '../photo-album';
import {
  captureMessageAnchor,
  restoreMessageAnchor,
  historyCursorAdvanced,
  type MessageAnchor,
} from '../message-scroll';
import type { ChatMessage, Conversation, MessagePage, InfoMedia } from '../types';
import styles from '../zalo-team.module.css';

export function ConversationDetail({
  conversation,
  infoOpen,
  onToggleInfo,
  onChooseAccount,
  onReady,
  searchOpen,
  onToggleSearch,
  searchHit,
}: {
  conversation: Conversation;
  infoOpen?: boolean;
  onToggleInfo?: () => void;
  onChooseAccount?: (anchor: HTMLButtonElement) => void;
  onReady?: () => void;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  searchHit?: { hit: SearchHit; sequence: number } | null;
}) {
  const { accountId, conversationId, archiveOnly } = conversation;
  const [groupOpen, setGroupOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyContext, setHistoryContext] = useState(false);
  const contextMode = useRef(false);
  const [highlight, setHighlight] = useState('');
  const jumpPending = useRef('');
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const draft = useSendDraft(accountId, conversationId, 'history');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const storedMessages = useArchiveAttachments(messages, accountId, conversationId);
  const voiceCall = useRef<VoiceCallHandle>(null);
  const [callAvailable, setCallAvailable] = useState(false);
  const [pins, setPins] = useState<NonNullable<MessagePage['pins']>>([]);
  const [cursor, setCursor] = useState<MessagePage['cursor']>(null);
  const [loading, setLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    messageId?: string;
    person?: ChatMessage['sender'];
  } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const historyBusy = useRef(false);
  const nativeEnd = useRef<MessagePage['cursor']>(null);
  const deletedMessages = useRef(new Set<string>());
  const archiveDeletePending = useRef(false);
  const pendingRefresh = useRef(false);
  const initial = useRef(true);
  const anchor = useRef<MessageAnchor | null>(null);
  const lastTop = useRef(0);
  const restoredTop = useRef<number | null>(null);
  const stickBottom = useRef(true);
  const outgoingMessages: ChatMessage[] = (historyContext ? [] : draft.outgoing).flatMap((item) => {
    const receipt = item.receipt;
    if (
      messages.some(
        (m) =>
          (receipt?.messageId && m.id === receipt.messageId) ||
          (receipt?.clientId && m.clientId === receipt.clientId),
      )
    )
      return [];
    return [
      {
        id: receipt?.messageId || 'local:' + item.requestId,
        clientId: receipt?.clientId || '',
        crmSender: receipt?.crmSender,
        time: receipt?.time || item.time,
        type: item.media
          ? item.media.kind === 'image'
            ? 'MSG_PHOTO'
            : 'MSG_FILE'
          : item.sticker
            ? 'MSG_STICKER'
            : 'MSG_TEXT',
        kind: item.media?.kind || (item.sticker ? 'sticker' : 'text'),
        mine: true,
        sender: { name: conversation.accountName || '' },
        text: item.text,
        styles: item.styles,
        mentions: item.mentions,
        inline: emojiTokens(item.text, accountId),
        attachments: item.media
          ? [
              {
                kind: item.media.kind,
                name: item.media.file.name,
                preview: item.media.preview,
                size: item.media.file.size,
              },
            ]
          : item.sticker
            ? [
                {
                  kind: 'sticker',
                  name: item.sticker.name,
                  preview: item.sticker.preview,
                  animation: item.sticker.animation,
                  size: 0,
                },
              ]
            : [],
        quote: item.reply || null,
        delivery: item.status,
        localRequestId: item.requestId,
      },
    ];
  });
  const orderedMessages = groupPhotoMessages([
    ...[...storedMessages, ...outgoingMessages.filter((m) => m.delivery === 'sent')].sort(
      (a, b) => a.time - b.time || a.id.localeCompare(b.id),
    ),
    ...outgoingMessages.filter((m) => m.delivery !== 'sent'),
  ]);
  const lastPoll = new Map<string, string>();
  orderedMessages.forEach((m) => {
    if (m.poll) lastPoll.set(m.poll.id, m.id);
  });
  const visibleMessages = orderedMessages.map((m) =>
    m.poll && lastPoll.get(m.poll.id) !== m.id ? { ...m, poll: undefined, kind: 'system' } : m,
  );
  useEffect(() => {
    draft.acknowledgeMedia(messages);
  }, [messages, draft.outgoing]);
  const lastOutgoing = draft.outgoing.at(-1)?.requestId;
  useLayoutEffect(() => {
    if (lastOutgoing) {
      stickBottom.current = true;
      anchor.current = null;
      if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [lastOutgoing]);

  const restorePosition = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (stickBottom.current) el.scrollTop = el.scrollHeight;
    else if (anchor.current) restoreMessageAnchor(el, anchor.current);
    restoredTop.current = lastTop.current = el.scrollTop;
  }, []);

  const load = useCallback(
    async (before?: MessagePage['cursor'], refresh = false, replace = false): Promise<void> => {
      if (refresh && contextMode.current) return;
      if (replace) {
        controller.current?.abort();
        busy.current = false;
        historyBusy.current = false;
        pendingRefresh.current = false;
      }
      let replacePage = replace;
      if (busy.current && !controller.current?.signal.aborted) {
        if (!before || historyBusy.current) {
          if (refresh) pendingRefresh.current = true;
          return;
        }
        // Scrolling takes priority over polling; never interrupt an older-page request.
        controller.current?.abort();
      }
      busy.current = true;
      historyBusy.current = Boolean(before);
      const abort = (controller.current = new AbortController());
      const started = Date.now();
      let firstPaint = false;
      if (before) {
        setOlderLoading(true);
        setHistoryError('');
      }
      try {
        const data = await readTimelinePage(
          accountId!,
          conversationId!,
          before,
          refresh,
          abort.signal,
          replace ? null : nativeEnd.current,
          archiveOnly,
          page => {
            if (abort.signal.aborted || !initial.current || replace) return;
            setMessages(page.messages);
            setLoading(false);
            if (!firstPaint && process.env.NODE_ENV !== 'production')
              console.debug('[zalo-timeline]', JSON.stringify({event:'first-page',ms:Date.now()-started,messages:page.messages.length}));
            firstPaint=true;
          },
        );
        if (data.nativeEnd !== undefined && !abort.signal.aborted)
          nativeEnd.current = data.nativeEnd;
        {
          if (abort.signal.aborted) return;
          if (data.accountId !== accountId || data.conversationId !== conversationId)
            throw Error('WEB_IDENTITY_MISMATCH');
          const page = data as MessagePage;
          if (page.pins) setPins(page.pins);
          if (before && !historyCursorAdvanced(before, page.cursor))
            throw Error('WEB_HISTORY_NOT_ADVANCED');
          const el = scroller.current;
          if (el) {
            stickBottom.current =
              !before && (initial.current || el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            anchor.current = stickBottom.current ? null : captureMessageAnchor(el);
          }
          if ((!refresh && !before) || before || initial.current) setCursor(page.cursor);
          initial.current = false;
          const resetPage = replacePage;
          replacePage = false;
          setMessages((current) =>
            mergeTimelineMessages(resetPage ? [] : current, page.messages).filter(
              (m) => !deletedMessages.current.has(m.id),
            ),
          );
          if (
            replace &&
            jumpPending.current &&
            !page.messages.some((m) => m.id === jumpPending.current)
          ) {
            setHistoryError(
              'Tin nhắn này không còn trong lịch sử có thể tải. Hãy chọn kết quả khác.',
            );
            jumpPending.current = '';
          }
          setError('');
          setWarning(archiveDeletePending.current ? 'ARCHIVE_DELETE_PENDING' : page.warning);
          if (!before && process.env.NODE_ENV !== 'production')
            console.debug('[zalo-timeline]', JSON.stringify({event:refresh?'refresh':'complete',ms:Date.now()-started,messages:page.messages.length}));
          setLoading(false);
          if (!before && !['ARCHIVE_FALLBACK', 'WEB_HISTORY_PARTIAL'].includes(page.warning || ''))
            readyCallback.current?.();
        }
      } catch (e) {
        if (abort.signal.aborted) return;
        const setLoadError = before ? setHistoryError : setError;
        setLoadError(
          e instanceof Error && e.message === 'WEB_ACCOUNT_OFFLINE'
            ? 'Tài khoản đã mất kết nối. Hãy kết nối lại trong tab Tài khoản.'
            : before
              ? 'Chưa tải được tin nhắn cũ hơn.'
              : 'Chưa tải được tin nhắn.',
        );
      } finally {
        if (controller.current === abort && !abort.signal.aborted) {
          busy.current = false;
          historyBusy.current = false;
          setLoading(false);
          setOlderLoading(false);
          if (pendingRefresh.current) {
            pendingRefresh.current = false;
            void load(undefined, true);
          }
        }
      }
    },
    [accountId, conversationId, archiveOnly],
  );
  function latestMessages() {
    contextMode.current = false;
    setHistoryContext(false);
    setHighlight('');
    jumpPending.current = '';
    initial.current = true;
    stickBottom.current = true;
    anchor.current = null;
    setLoading(true);
    setMessages([]);
    void load(undefined, false, true);
  }
  useLayoutEffect(() => {
    if (!searchHit) return;
    const hit = searchHit.hit;
    setHighlight(hit.id);
    jumpPending.current = hit.id;
    stickBottom.current = false;
    anchor.current = null;
    if (
      messages.some(
        (m) =>
          m.id === hit.id || m.attachments.some((a) => 'messageId' in a && a.messageId === hit.id),
      )
    )
      return;
    contextMode.current = true;
    setHistoryContext(true);
    void load({ id: hit.id, time: String(hit.time + 1) }, false, true);
  }, [searchHit]);
  useEffect(() => {
    if (lastOutgoing && contextMode.current) latestMessages();
  }, [lastOutgoing]);
  useEffect(() => {
    void load();
    const off = subscribeChanges((event) => {
      if (affects(event, 'messages', accountId, conversationId))
        void load(undefined, true);
    });
    const pollChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.accountId === accountId && detail?.conversationId === conversationId)
        void load(undefined, true);
    };
    window.addEventListener('zalo-team-poll-created', pollChanged);
    window.addEventListener('zalo-team-topic-created', pollChanged);
    return () => {
      off();
      window.removeEventListener('zalo-team-poll-created', pollChanged);
      window.removeEventListener('zalo-team-topic-created', pollChanged);
      pendingRefresh.current = false;
      controller.current?.abort();
      busy.current = false;
    };
  }, [load]);
  useLayoutEffect(() => {
    if (jumpPending.current) {
      const renderedId =
        visibleMessages.find(
          (m) =>
            m.id === jumpPending.current ||
            m.album?.some((item) => item.id === jumpPending.current),
        )?.id || jumpPending.current;
      const node = scroller.current?.querySelector<HTMLElement>(
        '[data-message-id="' + CSS.escape(renderedId) + '"]',
      );
      if (node) {
        node.scrollIntoView({ block: 'center' });
        stickBottom.current = false;
        anchor.current = captureMessageAnchor(scroller.current!);
        jumpPending.current = '';
      }
    } else restorePosition();
  }, [messages, draft.outgoing, restorePosition, searchHit]);
  useEffect(() => {
    if (!content.current) return;
    const observer = new ResizeObserver(restorePosition);
    observer.observe(content.current);
    // Formatting/expanded composer changes the viewport without changing messages.
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [restorePosition]);
  const loadOlderNearTop = () => {
    if (!loading && !historyError && cursor && scroller.current && scroller.current.scrollTop < 160)
      void load(cursor);
  };
  const gallery: InfoMedia[] = storedMessages.flatMap((message) =>
    message.attachments
      .filter((item) => item.kind === 'image' || item.kind === 'video')
      .map((item, index) => ({
        ...item,
        id: `${message.id}:${index}`,
        messageId: message.id,
        time: message.time,
        sender: { id: message.sender.id || '', name: message.sender.name },
      })),
  );
  const selectedMedia = gallery.find((item) => item.url === image || item.preview === image);
  const viewerItems: InfoMedia[] = selectedMedia
    ? gallery
    : image
      ? [
          {
            id: image,
            messageId: '',
            kind: 'image',
            name: 'Ảnh trong cuộc trò chuyện',
            url: image,
            time: 0,
            size: 0,
          },
        ]
      : [];
  return (
    <>
      <header className={styles.chatHeader}>
        <button
          type="button"
          className={styles.profileAvatarButton}
          aria-label={
            conversation.group
              ? 'Xem thông tin nhóm'
              : conversation.avatarSrc === '/zalo-team/my-documents.png'
                ? 'Xem thông tin hội thoại'
                : `Xem thông tin tài khoản ${conversation.name} trên tiêu đề`
          }
          onClick={() =>
            conversation.group || conversation.avatarSrc === '/zalo-team/my-documents.png'
              ? !infoOpen && onToggleInfo?.()
              : conversationId && setProfile({ id: conversationId })
          }
        >
          <Avatar conversation={conversation} />
        </button>
        <div className={styles.headerTitle}>
          <ConversationHeaderName />
          <div className={styles.headerSubtitle}>
            <ConversationTags conversation={conversation} />
            <span className={styles.headerSubtitleSeparator} aria-hidden="true" />
            {onChooseAccount ? (
              <button
                className={styles.groupCurrentAccount}
                onClick={(event) => onChooseAccount(event.currentTarget)}
              >
                <Avatar
                  conversation={{
                    name: conversation.accountName || '',
                    avatarSrc: conversation.accountAvatarSrc,
                    color: '#e5efff',
                  }}
                  size={16}
                />
                Đang dùng: {conversation.accountName}
                <Icon name="down" size={12} />
              </button>
            ) : (
              conversation.accountName
            )}
            {conversation.group && conversation.memberCount
              ? ` · ${conversation.memberCount} thành viên`
              : ''}
          </div>
        </div>
        <IconButton
          icon="group"
          label={conversation.group ? 'Thêm thành viên vào nhóm' : 'Tạo nhóm với người này'}
          size={20}
          onClick={() => setGroupOpen(true)}
        />
        <VoiceCall
          ref={voiceCall}
          key={`${accountId}:${conversationId}`}
          conversation={conversation}
          onAvailability={setCallAvailable}
        />
        <IconButton
          icon="search"
          label="Tìm kiếm trong trò chuyện"
          size={20}
          active={searchOpen}
          onClick={onToggleSearch}
        />
        <IconButton
          icon="download"
          label="Lịch sử đã lưu trên server"
          size={20}
          onClick={() => setArchiveOpen(true)}
        />
        <IconButton
          icon={infoOpen ? 'panelActive' : 'panel'}
          label={infoOpen ? 'Đóng thông tin hội thoại' : 'Mở thông tin hội thoại'}
          size={20}
          active={infoOpen}
          onClick={onToggleInfo}
        />
      </header>
      {historyContext && (
        <div className={styles.searchContextNotice} role="status">
          Đang xem tin nhắn trong kết quả tìm kiếm{' '}
          <button onClick={latestMessages}>Về tin nhắn mới nhất</button>
        </div>
      )}
      <FriendshipBanner conversation={conversation} />
      <div className={styles.chatHistoryArea}>
        <PinnedMessages
          pins={pins}
          onJump={(id) => {
            if (id.startsWith('topic:')) {
              id = [...messages].reverse().find((m) => m.topic?.id === id.slice(6))?.id || id;
              window.dispatchEvent(new CustomEvent('zalo-team-topic-open', { detail: id }));
            }
            if (id.startsWith('poll:'))
              id = messages.findLast((m) => m.poll?.id === id.slice(5))?.id || '';
            const node = scroller.current?.querySelector<HTMLElement>(
              '[data-message-id="' + id + '"]',
            );
            if (!node) return false;
            node.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return true;
          }}
        />
        <div
          ref={scroller}
          className={`${styles.scrollArea} ${styles.messageList} ${styles.liveMessageList}`}
          data-search-highlight={highlight || undefined}
          role="region"
          aria-label="Nội dung cuộc trò chuyện"
          tabIndex={0}
          aria-busy={loading || olderLoading}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (restoredTop.current !== null && Math.abs(el.scrollTop - restoredTop.current) < 1) {
              restoredTop.current = null;
              return;
            }
            restoredTop.current = null;
            const upward = el.scrollTop < lastTop.current;
            lastTop.current = el.scrollTop;
            stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            anchor.current = stickBottom.current ? null : captureMessageAnchor(el);
            if (upward) loadOlderNearTop();
          }}
          onWheel={(e) => {
            if (e.deltaY < 0) loadOlderNearTop();
          }}
          onKeyDown={(e) => {
            if (['Home', 'PageUp', 'ArrowUp'].includes(e.key)) loadOlderNearTop();
          }}
        >
          <div ref={content}>
            {loading && !outgoingMessages.length ? (
              <p className={styles.noMessages}>Đang tải tin nhắn…</p>
            ) : (
              <>
                <div className={styles.historyStatus} role="status" aria-live="polite">
                  {olderLoading ? (
                    'Đang tải tin nhắn cũ hơn…'
                  ) : historyError ? (
                    <>
                      {historyError} <button onClick={() => void load(cursor)}>Thử lại</button>
                    </>
                  ) : !cursor && messages.length > 0 ? (
                    'Đầu lịch sử hiện có trên Zalo và trong kho đã lưu'
                  ) : null}
                </div>
                {!visibleMessages.length && !error && (
                  <p className={styles.noMessages}>
                    Chưa có tin nhắn trong nguồn Zalo và kho đã lưu của tài khoản này.
                  </p>
                )}
                {visibleMessages.some((m) => m.archived) && (
                  <div className={styles.historyStatus}>
                    Đã nối lịch sử lưu trên server. Tin chỉ còn trong bản lưu được xem ở chế độ chỉ
                    đọc.
                  </div>
                )}
                {visibleMessages.map((message, index) => {
                  const layout = messageLayout(visibleMessages, index);
                  return (
                    <Fragment key={message.id}>
                      {layout.separator && (
                        <div className={styles.dateSeparator}>
                          <span>{layout.separator}</span>
                        </div>
                      )}
                      <div
                        className={
                          highlight === message.id ||
                          message.album?.some((item) => item.id === highlight)
                            ? styles.searchMessageHighlight
                            : undefined
                        }
                      >
                        <MessageItem
                          message={message}
                          conversation={conversation}
                          first={layout.first}
                          last={layout.last}
                          latest={index === visibleMessages.length - 1}
                          onPreview={setImage}
                          onProfile={(m) => {
                            const id =
                              m.sender.id || (!conversation.group ? conversationId : undefined);
                            if (id && /^\d+$/.test(id))
                              setProfile({
                                id,
                                person: m.sender,
                                ...(conversation.group ? { messageId: m.id } : {}),
                              });
                          }}
                          onCall={callAvailable ? () => voiceCall.current?.start() : undefined}
                          onReply={(m) =>
                            draft.setReply({
                              id: m.id,
                              sender: m.mine ? 'Bạn' : m.sender.name || conversation.name,
                              text: m.text || m.attachments[0]?.name || 'Tin nhắn',
                              preview: m.attachments.find((a) => a.kind === 'image')?.preview,
                            })
                          }
                          onJump={(id) => {
                            const el = scroller.current?.querySelector<HTMLElement>(
                              '[data-message-id="' + id + '"]',
                            );
                            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                          }}
                          onAction={async (m, operation, reaction) => {
                            const response = await teamFetch('/api/zalo-team/web', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'message-action',
                                accountId,
                                conversationId,
                                messageId: m.id,
                                operation,
                                reaction,
                                requestId: requestId(),
                              }),
                              signal: AbortSignal.timeout(30000),
                            });
                            const result = await response.json();
                            if (!response.ok) throw Error(result.error || 'WEB_ACTION_FAILED');
                            if (
                              result.accountId !== accountId ||
                              result.conversationId !== conversationId
                            )
                              throw Error('WEB_IDENTITY_MISMATCH');
                            if (!['done', 'queued'].includes(result.status))
                              throw Error('WEB_ACTION_UNKNOWN');
                            if (operation === 'delete') {
                              deletedMessages.current.add(m.id);
                              setMessages((current) => current.filter((x) => x.id !== m.id));
                              try {
                                await archiveRequest({
                                  kind: 'hide-message',
                                  accountId,
                                  conversationId,
                                  messageIds: [m.id],
                                });
                              } catch {
                                archiveDeletePending.current = true;
                                setWarning('ARCHIVE_DELETE_PENDING');
                              }
                            } else if (operation === 'recall')
                              setMessages((current) =>
                                current.map((x) =>
                                  x.id === m.id
                                    ? {
                                        ...x,
                                        kind: 'recalled',
                                        text: 'Tin nhắn đã được thu hồi',
                                        starred: false,
                                        canRecall: false,
                                        reactions: [],
                                        attachments: [],
                                        quote: null,
                                      }
                                    : x,
                                ),
                              );
                            else if (operation === 'star' || operation === 'unstar')
                              setMessages((current) =>
                                current.map((x) =>
                                  x.id === m.id ? { ...x, starred: operation === 'star' } : x,
                                ),
                              );
                            void load(undefined, true);
                          }}
                          onEditFailed={draft.editFailed}
                          canEditFailed={
                            !draft.blocked &&
                            (['sticker', 'image', 'file'].includes(message.kind) || !draft.text)
                          }
                        />
                      </div>
                    </Fragment>
                  );
                })}
              </>
            )}
            {(error || warning) && (
              <div className={styles.messageNotice} role="status">
                {error ||
                  (warning === 'ARCHIVE_FALLBACK'
                    ? 'Zalo chưa phản hồi đầy đủ. Đang hiển thị dữ liệu đã lưu của tài khoản này.'
                    : warning === 'ARCHIVE_UNAVAILABLE'
                      ? 'Kho lưu trữ chưa phản hồi. Tin hiện tại được tải từ Zalo.'
                      : warning === 'ARCHIVE_DELETE_PENDING'
                        ? 'Đã gửi lệnh xóa trên Zalo nhưng chưa cập nhật được bản lưu. Cần kiểm tra lại kho.'
                        : 'Một phần lịch sử chưa tải được từ Zalo.')}{' '}
                <button onClick={() => void load()}>Thử lại</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <WorkPresence key={`${accountId}:${conversationId}`} conversation={conversation} />
      <ConversationComposer conversation={conversation} />
      {archiveOpen && (
        <ArchiveHistoryDialog
          key={`${accountId}:${conversationId}`}
          accountId={accountId}
          conversationId={conversationId}
          name={conversation.name}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      {groupOpen && <GroupDialog conversation={conversation} onClose={() => setGroupOpen(false)} />}
      {profile && (
        <ChatProfileDialog
          fallbackPerson={profile.person}
          key={`${accountId}:${conversationId}:${profile.id}:${profile.messageId || ''}`}
          conversation={conversation}
          personId={profile.id}
          messageId={profile.messageId}
          onClose={() => setProfile(null)}
          onChat={(peer) =>
            window.dispatchEvent(new CustomEvent('zalo-team-open-person', { detail: peer }))
          }
        />
      )}
      {image && (
        <MediaViewer
          items={viewerItems}
          initialId={selectedMedia?.id || image}
          onClose={() => setImage(null)}
        />
      )}
    </>
  );
}
