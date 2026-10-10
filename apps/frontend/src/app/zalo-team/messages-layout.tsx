'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useInboxPreferences } from '@/features/zalo-team/inbox-preferences';
import { useGroupPreferences } from '@/features/zalo-team/use-group-preferences';
import { applyInboxDelta } from '@/features/zalo-team/changes';
import { teamFetch } from '@/features/zalo-team/request';
import { useWorkSummaries } from '@/features/zalo-team/workspace';
import { WorkspaceFilters } from '@/features/zalo-team/components/workspace-filters';
import { matchesWork, emptyWorkFilter, indexWork } from '@/features/zalo-team/workspace-filter';

import { useSharedTags, TagFilter, matchesTags } from '@/features/zalo-team/components/shared-tags';
import { ConversationSettingsProvider } from '@/features/zalo-team/components/conversation-settings-controls';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  groupRows,
  changeGroupLink,
  type LinkedGroup,
  type GroupedRow,
} from '@/features/zalo-team/group-links';
import { GroupAccountPicker } from '@/features/zalo-team/components/group-account-picker';
import { GroupLinkDialog } from '@/features/zalo-team/components/group-link-dialog';
import { Icon, IconButton } from '@/features/zalo-team/components/icon';
import { ConversationSearch } from '@/features/zalo-team/components/conversation-search';
import type { SearchHit } from '@/features/zalo-team/message-search';
import { ConversationDetail } from '@/features/zalo-team/components/conversation-detail';
import { ConversationInfo } from '@/features/zalo-team/components/conversation-info';
import { ZaloTeamShell } from '@/features/zalo-team/components/workspace-shell';
import { VirtualList } from '@/features/zalo-team/components/virtual-list';
import { ConversationRow } from '@/features/zalo-team/components/conversation-row';
import { ConversationListMenu } from '@/features/zalo-team/components/conversation-list-menu';
import { InboxCreateDialog } from '@/features/zalo-team/components/inbox-create-dialog';
import { PhoneSearch } from '@/features/zalo-team/components/phone-search';
import { AddPersonToGroupDialog } from '@/features/zalo-team/components/add-person-to-group-dialog';
import { internationalPhone } from '@/features/zalo-team/friend-actions';
import { SearchInput, ScrollArea } from '@/features/zalo-team/components/primitives';
import type { Conversation, ConversationListResponse } from '@/features/zalo-team/types';
import styles from '@/features/zalo-team/zalo-team.module.css';
import { subscribeChanges, reconnectChanges, affects, packets } from '@/features/zalo-team/live';
import { directoryRequest, directoryConversation } from '@/features/zalo-team/directory';
import { useDirectorySearch } from '@/features/zalo-team/directory-search';
import { useArchiveInbox } from '@/features/zalo-team/archive-inbox';
import { InboxStatus } from '@/features/zalo-team/components/inbox-status';
import { inboxRetryDelay } from '@/features/zalo-team/inbox-notice';
import { openConversationSource } from '@/features/zalo-team/open-conversation';
import { useInboxAvatars } from '@/features/zalo-team/inbox-avatars';
import {
  normalizeConversationName,
  useArchiveConversationSearch,
} from '@/features/zalo-team/inbox-search';

function timeLabel(timestamp: number) {
  if (!timestamp) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return minutes + ' phút';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' giờ';
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}
export default function MessagesLayout() {
  const client = useQueryClient();
  const inboxPreferences = useInboxPreferences();
  const groupPreferences = useGroupPreferences();
  const [archivedView, setArchivedView] = useState(false);
  const tags = useSharedTags();
  const [tagFilter, setTagFilter] = useState<string[]>([]),
    [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [data, setData] = useState<ConversationListResponse | null>(
    () => client.getQueryData(['inbox']) || null,
  );
  const listSnapshot = useRef(data);
  const conversationScroll = useRef<HTMLDivElement>(null);
  listSnapshot.current = data;
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [workFilter, setWorkFilter] = useState(emptyWorkFilter);
  const [workFilterOpen, setWorkFilterOpen] = useState(false);
  const workActive = workFilter.person !== 'all' || workFilter.state !== 'all';
  const workSummary = useWorkSummaries(workFilterOpen || workActive);
  const workIndex = useMemo(() => indexWork(workSummary.data), [workSummary.data]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHit, setSearchHit] = useState<{
    sourceId: Conversation['id'];
    hit: SearchHit;
    sequence: number;
  } | null>(null);
  useEffect(() => {
    setSearchOpen(false);
    setSearchHit(null);
  }, [selectedId]);
  const [search, setSearch] = useState('');
  const [phoneAccountId, setPhoneAccountId] = useState('');
  const [openedPerson, setOpenedPerson] = useState<Conversation | null>(null);
  const [addPerson, setAddPerson] = useState<Conversation | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [liveDisconnected, setLiveDisconnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const retryAccount = useRef<number | undefined>();
  const [createKind, setCreateKind] = useState<'friend' | 'group' | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkedGroup | null>(null);
  const [picker, setPicker] = useState<{
    groupId: string;
    anchor: HTMLButtonElement;
    mode: 'chat' | 'menu';
  } | null>(null);
  const pendingPreference = useRef<{
    groupId: string;
    accountId: number | null;
    sourceId: Conversation['id'];
  } | null>(null);
  const readySource = useRef<Conversation['id'] | null>(null);
  const [menu, setMenu] = useState<{
    conversation: Conversation;
    anchor: HTMLButtonElement;
    phoneResult?: boolean;
  } | null>(null);
  const [openGroup, setOpenGroup] = useState<{ accountId: number; groupId: string } | null>(null);
  const directoryOpened = useRef(false);
  const workOpened = useRef(false);
  const workJumped = useRef(false);
  useEffect(() => {
    if (!selectedId || !data || workJumped.current) return;
    const params = new URLSearchParams(window.location.search);
    const account = Number(params.get('workAccount')),
      peer = params.get('workPeer');
    const id = params.get('workMessage'),
      time = Number(params.get('workTime'));
    const selected = data.conversations.find((c) => c.id === selectedId);
    if (
      !selected ||
      selected.accountId !== account ||
      selected.conversationId !== peer ||
      !id ||
      !/^[\w:-]{1,128}$/.test(id) ||
      !Number.isFinite(time) ||
      time <= 0
    )
      return;
    workJumped.current = true;
    setSearchHit({
      sourceId: selectedId,
      hit: { id, time, text: '', kind: 'text', sender: { id: '', name: '' } },
      sequence: Date.now(),
    });
  }, [selectedId, data]);
  useEffect(() => {
    if (!data || workOpened.current) return;
    const params = new URLSearchParams(window.location.search);
    const aid = Number(params.get('workAccount')),
      peer = params.get('workPeer');
    if (!aid || !peer) return;
    const c = data.conversations.find((c) => c.accountId === aid && c.conversationId === peer);
    if (!c) return;
    workOpened.current = true;
    setSelectedId(c.id);
    setAccountId(String(aid));
    setInfoOpen(true);
  }, [data]);
  useEffect(() => {
    const open = (event: Event) => {
      const peer = (event as CustomEvent<Conversation>).detail;
      setOpenedPerson(peer);
      setSelectedId(peer.id);
      setAccountId(String(peer.accountId));
      setInfoOpen(true);
    };
    window.addEventListener('zalo-team-open-person', open);
    return () => window.removeEventListener('zalo-team-open-person', open);
  }, []);
  const directoryAccounts = JSON.stringify(
    data?.accounts.map(({ id, name, avatarSrc }) => ({ id, name, avatarSrc })),
  );
  useEffect(() => {
    if (!data || directoryOpened.current) return;
    const query = new URLSearchParams(window.location.search),
      account = Number(query.get('directoryAccount')),
      peer = query.get('directoryPeer') || '';
    const source = data.accounts.find((a) => a.id === account);
    if (!source || !/^g?\d{1,30}$/.test(peer)) return;
    const abort = new AbortController();
    directoryRequest(account, { kind: 'open', id: peer }, abort.signal)
      .then((r) => {
        if (abort.signal.aborted || !r.person || r.status !== 'opened') return;
        directoryOpened.current = true;
        const c = directoryConversation(r.person!, source);
        setOpenedPerson(c);
        setSelectedId(c.id);
        setAccountId(String(account));
        setInfoOpen(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          directoryOpened.current = true;
          setError('Chưa mở được liên hệ từ danh bạ. Vui lòng thử lại.');
        }
      });
    return () => abort.abort();
  }, [directoryAccounts]);
  useEffect(() => {
    const updated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setReload((n) => n + 1);
      if (detail?.open) {
        setOpenGroup(detail);
        setSearch('');
        setUnreadOnly(false);
        setAccountId(String(detail.accountId));
        setInfoOpen(true);
      }
    };
    window.addEventListener('zalo-team-group-updated', updated);
    return () => window.removeEventListener('zalo-team-group-updated', updated);
  }, []);
  useEffect(() => {
    if (!openGroup) return;
    const found = data?.conversations.find(
      (c) => c.accountId === openGroup.accountId && c.conversationId === openGroup.groupId,
    );
    if (found) {
      setSelectedId(found.id);
      setOpenGroup(null);
    }
  }, [data, openGroup]);
  useEffect(() => {
    let cancelled = false;
    setLoading(!listSnapshot.current);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let busy = false,
      pending = false;
    let retryAttempt = 0;
    let targetAccount = retryAccount.current;
    retryAccount.current = undefined;
    async function load() {
      if (busy) {
        pending = true;
        return;
      }
      busy = true;
      const started = Date.now();
      let firstPacketMs: number | undefined;
      const requestedAccount = targetAccount;
      let retryDelay: number | null = null;
      try {
        const response = await teamFetch('/api/zalo-team/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
          body: JSON.stringify({
            action: 'conversations',
            ...(requestedAccount ? { accountId: requestedAccount } : {}),
          }),
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        await packets<ConversationListResponse & { partial?: boolean }>(response, (result) => {
          if (cancelled) return;
          firstPacketMs ??= Date.now() - started;
          const previous = listSnapshot.current;
          const ids = new Set(result.accounts.map((a) => a.id));
          const next =
            (requestedAccount || result.partial) && previous
              ? {
                  ...previous,
                  ...result,
                  groups: result.groups || previous.groups,
                  accounts: [
                    ...previous.accounts.filter((a) => !ids.has(a.id)),
                    ...result.accounts,
                  ].sort((a, b) => a.id - b.id),
                  conversations: [
                    ...previous.conversations.filter((c) => !ids.has(c.accountId)),
                    ...result.conversations,
                  ],
                }
              : result;
          listSnapshot.current = next;
          client.setQueryData(['inbox'], next);
          setData(next);
          setLoading(false);
          setError('');
          if (!result.partial) {
            retryDelay = inboxRetryDelay(next.accounts || [], retryAttempt);
            if (retryDelay !== null) {
              targetAccount = undefined;
              retryAttempt++;
            } else if (next.accounts.every((a) => a.state === 'connected' && !a.error))
              retryAttempt = 0;
          }
        });
      } catch (e) {
        if (!cancelled && !(e instanceof Error && e.message === 'CRM_LOGIN_REQUIRED'))
          retryDelay = Math.min(30000, 2000 * 2 ** Math.min(retryAttempt++, 4));
        if (!cancelled)
          setError(
            e instanceof Error && e.message === 'CRM_LOGIN_REQUIRED'
              ? 'Bạn cần đăng nhập CRM để xem danh sách.'
              : 'Chưa tải được danh sách. Hệ thống sẽ thử lại trong tối đa 30 giây.',
          );
      } finally {
        if (!cancelled && process.env.NODE_ENV !== 'production')
          console.debug(
            '[zalo-inbox]',
            JSON.stringify({ event: 'read', ms: Date.now() - started, firstPacketMs }),
          );
        if (!cancelled) {
          setLoading(false);
          if (pending) {
            pending = false;
            timer = setTimeout(load, 100);
          } else if (retryDelay !== null) {
            clearTimeout(timer);
            timer = setTimeout(load, retryDelay);
          }
        }
        busy = false;
      }
    }
    void load();
    const off = subscribeChanges((event) => {
      if (event.error) {
        setLiveDisconnected(true);
        return;
      }
      setLiveDisconnected(false);
      if (event.inboxes?.length && listSnapshot.current) {
        // A response already in flight may predate this delta; reconcile once
        // after that response instead of allowing it to overwrite newer rows.
        if (busy) pending = true;
        const next = applyInboxDelta(listSnapshot.current, event.inboxes);
        listSnapshot.current = next;
        client.setQueryData(['inbox'], next);
        setData(next);
      }
      if (affects(event, 'directory'))
        void client.invalidateQueries({
          queryKey: ['directory-avatars'],
          predicate: (q) => affects(event, 'directory', Number(q.queryKey[1])),
        });
      if (!affects(event, 'inbox')) return;
      targetAccount = busy ? undefined : event.accountId;
      clearTimeout(timer);
      timer = setTimeout(load, 100);
    });
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      off();
    };
  }, [reload, client]);
  const accountAvatars = new Map(data?.accounts.map((account) => [account.id, account.avatarSrc]));
  const archiveSearch = useArchiveConversationSearch(search, accountId, reload);
  const archiveInbox = useArchiveInbox(accountId, reload);
  const missingAvatarAccounts = new Set(
    [...(data?.conversations || []), ...archiveInbox.conversations]
      .filter((c) => !c.avatarSrc && !c.avatarMembers?.length)
      .map((c) => c.accountId),
  );
  const inboxAvatars = useInboxAvatars(
    (data?.accounts || []).filter((a) => missingAvatarAccounts.has(a.id)),
    accountId,
    reload,
  );
  const directorySearch = useDirectorySearch(search, accountId, data?.accounts || [], reload);
  const openingRequest = useRef<AbortController | null>(null);
  const [openingName, setOpeningName] = useState('');
  const [nativePreparation, setNativePreparation] = useState<{
    id: Conversation['id'];
    state: Conversation['nativePreparation'];
  } | null>(null);
  useEffect(() => {
    setOpeningName('');
    setNativePreparation(null);
    return () => {
      openingRequest.current?.abort();
    };
  }, [accountId]);
  const archiveMatchIds = new Set(archiveSearch.conversations.map((c) => c.id));
  const storedIds = new Set(archiveInbox.conversations.map((c) => c.id));
  const storedRows = new Map(archiveInbox.conversations.map((c) => [c.id, c]));
  const directoryMatchIds = new Set(directorySearch.conversations.map((c) => c.id));
  const conversations: Conversation[] = (data?.conversations || []).map((item) => {
    const stored = storedRows.get(item.id);
    const storedPreview = stored && (item.previewError || (stored.updatedAt || 0) > item.updatedAt);
    const updatedAt = storedPreview ? stored.updatedAt : item.updatedAt;
    return {
      ...item,
      hasArchive: !!stored,
      ...(storedPreview ? { preview: stored.preview, previewInline: undefined } : {}),
      updatedAt,
      avatarSrc: item.avatarSrc || inboxAvatars[item.id]?.avatarSrc || stored?.avatarSrc,
      avatarMembers:
        item.avatarMembers || inboxAvatars[item.id]?.avatarMembers || stored?.avatarMembers,
      accountAvatarSrc: accountAvatars.get(item.accountId),
      time: timeLabel(updatedAt || 0),
      color: '#b8c7e3',
    };
  });
  const liveIds = new Set(conversations.map((c) => c.id));
  const listedIds = new Set(liveIds);
  for (const item of [
    ...archiveInbox.conversations,
    ...directorySearch.conversations,
    ...archiveSearch.conversations,
  ]) {
    if (!listedIds.has(item.id)) {
      listedIds.add(item.id);
      conversations.push({
        ...item,
        archiveOnly: storedIds.has(item.id) || archiveMatchIds.has(item.id),
        hasArchive: storedIds.has(item.id) || archiveMatchIds.has(item.id),
        avatarSrc: inboxAvatars[item.id]?.avatarSrc || item.avatarSrc,
        avatarMembers: inboxAvatars[item.id]?.avatarMembers || item.avatarMembers,
        accountAvatarSrc: accountAvatars.get(item.accountId!),
        time: timeLabel(item.updatedAt || 0),
        color: '#b8c7e3',
      });
    }
  }
  const selectedRow =
    conversations.find((item) => item.id === selectedId) ||
    (openedPerson?.id === selectedId ? openedPerson : undefined);
  const selected = selectedRow
    ? {
        ...selectedRow,
        nativePreparation:
          nativePreparation?.id === selectedRow.id ? nativePreparation.state : undefined,
      }
    : undefined;
  const phone = internationalPhone(search.trim());
  const phoneSearch = /^\+[1-9]\d{7,14}$/.test(phone);
  const grouped = groupRows(
    conversations.filter(
      (c) =>
        (!accountId || String(c.accountId) === accountId) &&
        inboxPreferences.archived.has(String(c.id)) === archivedView,
    ),
    data?.groups || [],
    groupPreferences.values,
  );
  const visible = grouped.filter((row) =>
    row.sources.some(
      (item) =>
        matchesTags(tags.data, String(item.id), tagFilter, tagMode) &&
        (!workActive ||
          (!workSummary.isError &&
            matchesWork(item, workFilter, workIndex, workSummary.data?.userId))) &&
        (!accountId || String(item.accountId) === accountId) &&
        (!unreadOnly || item.unread || item.unreadMarked) &&
        (normalizeConversationName(item.name).includes(normalizeConversationName(search)) ||
          archiveMatchIds.has(item.id) ||
          directoryMatchIds.has(item.id)),
    ),
  );
  const selectedLink = grouped.find((g) => g.sources.some((s) => s.id === selectedId))?.link;
  const pickerRow = grouped.find((g) => g.link?.id === picker?.groupId);
  const pickerLink = pickerRow?.link;
  const pickerSources = pickerRow?.sources || [];
  function updateLinks(groups: LinkedGroup[]) {
    setData((d) => (d ? { ...d, groups } : d));
    setReload((n) => n + 1);
  }
  function rememberAfterReady(sourceId: Conversation['id']) {
    readySource.current = sourceId;
    const pending = pendingPreference.current;
    if (!pending || pending.sourceId !== sourceId) return;
    pendingPreference.current = null;
    if (pending.groupId.startsWith('auto:')) {
      try {
        groupPreferences.remember(pending.groupId, pending.accountId);
      } catch {
        setError('Đã mở nhóm nhưng trình duyệt chưa lưu được lựa chọn tài khoản.');
      }
      return;
    }
    void changeGroupLink({
      kind: 'remember',
      groupId: pending.groupId,
      accountId: pending.accountId,
    })
      .then((r) => updateLinks(r.groups))
      .catch(() => setError('Đã mở nhóm nhưng chưa lưu được lựa chọn tài khoản.'));
  }
  async function prepareSource(source: Conversation, background = false) {
    openingRequest.current?.abort();
    const controller = new AbortController();
    openingRequest.current = controller;
    setOpeningName('');
    setNativePreparation(null);
    if (
      liveIds.has(source.id) ||
      (!storedIds.has(source.id) &&
        !archiveMatchIds.has(source.id) &&
        !directoryMatchIds.has(source.id))
    )
      return source;
    if (!background) setOpeningName(source.name);
    else setNativePreparation({ id: source.id, state: 'loading' });
    try {
      const opened = await directoryRequest(
        source.accountId!,
        { kind: 'open', id: source.conversationId! },
        AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      );
      if (controller.signal.aborted) return null;
      if (opened.status !== 'opened' || opened.conversationId !== source.conversationId)
        throw Error('NOT_OPENED');
      if (background) setNativePreparation({ id: source.id, state: 'ready' });
      return source;
    } catch {
      if (background && !controller.signal.aborted)
        setNativePreparation({ id: source.id, state: 'failed' });
      // History remains readable when the linked Zalo account is unavailable.
      // A successful native open above also prepares settings/profile/send APIs.
      if (!controller.signal.aborted && source.archiveOnly) return source;
      if (!controller.signal.aborted)
        setError('Chưa mở được liên hệ. Kiểm tra kết nối tài khoản rồi thử lại.');
      return null;
    } finally {
      if (!controller.signal.aborted) setOpeningName('');
    }
  }
  async function openSource(source: Conversation, link?: LinkedGroup, remember?: boolean) {
    if (!conversations.some((c) => c.id === source.id)) return;
    await openConversationSource(
      source,
      () => prepareSource(source, !!source.archiveOnly),
      () => {
        pendingPreference.current =
          link && remember !== undefined
            ? {
                groupId: link.id,
                accountId: remember ? source.accountId! : null,
                sourceId: source.id,
              }
            : null;
        setPicker(null);
        setMenu(null);
        setOpenedPerson(source);
        setSelectedId(source.id);
        setInfoOpen(true);
        if (readySource.current === source.id) rememberAfterReady(source.id);
      },
    );
  }
  async function openMenu(source: Conversation, anchor: HTMLButtonElement) {
    // Personal archive controls must remain usable while native Zalo is offline.
    setMenu({ conversation: { ...source, nativePreparation: 'loading' }, anchor });
    const ready = await prepareSource(source);
    setMenu((current) =>
      current?.conversation.id === source.id
        ? {
            ...current,
            conversation: { ...source, nativePreparation: ready ? 'ready' : 'failed' },
          }
        : current,
    );
  }
  function openRow(row: GroupedRow, anchor: HTMLButtonElement, mode: 'chat' | 'menu') {
    if (!row.link) {
      if (mode === 'menu') void openMenu(row.conversation, anchor);
      else openSource(row.conversation);
      return;
    }
    const preferred = row.sources.find((s) => s.accountId === row.link?.preferredAccountId);
    if (mode === 'chat' && (accountId || preferred)) {
      openSource(accountId ? row.sources[0] : preferred!);
      return;
    }
    setMenu(null);
    setPicker({ groupId: row.link.id, anchor, mode });
  }
  function selectInboxTab(tab: 'all' | 'unread' | 'archived') {
    const nextArchived = tab === 'archived';
    setArchivedView(nextArchived);
    setUnreadOnly(tab === 'unread');
    setMenu(null);
    setPicker(null);
    if (nextArchived !== archivedView) setSelectedId(null);
  }
  const unavailable =
    data?.accounts.filter((account) => account.state !== 'connected' || account.error) || [];
  const preparing = unavailable.filter(
    (a) =>
      ['starting', 'connecting'].includes(a.state) ||
      (a.state === 'connected' && a.error === 'WEB_CONVERSATIONS_NOT_READY'),
  );
  const listUnavailable = unavailable.filter(
    (a) =>
      a.state === 'connected' &&
      a.error !== 'WEB_CONVERSATIONS_NOT_READY' &&
      a.error !== 'WEB_IDENTITY_MISMATCH',
  );
  const accountUnavailable = unavailable.filter(
    (a) => !preparing.includes(a) && !listUnavailable.includes(a),
  );
  function retryInbox() {
    setReload((value) => value + 1);
    tags.refresh();
    reconnectChanges();
  }
  const sidebarError = !!(
    error ||
    liveDisconnected ||
    tags.error ||
    archiveInbox.error ||
    unavailable.length ||
    (search.trim() && (directorySearch.error || archiveSearch.error))
  );
  return (
    <ZaloTeamShell
      label="Zalo Team — danh sách hội thoại"
      accountFilter={{
        accounts: data?.accounts || [],
        accountId,
        onAccountChange: (id) => {
          setAccountId(id);
          setPhoneAccountId(id);
          setMenu(null);
          setSelectedId(null);
          setPicker(null);
          pendingPreference.current = null;
        },
      }}
      unreadCount={groupRows(conversations, data?.groups || []).reduce(
        (sum, row) => sum + (row.conversation.unread || (row.conversation.unreadMarked ? 1 : 0)),
        0,
      )}
    >
      <section className={styles.inbox} aria-label="Danh sách tin nhắn">
        <div className={styles.searchRow}>
          <SearchInput label="Tìm kiếm cuộc trò chuyện" value={search} onValueChange={setSearch} />
          <IconButton
            icon="addContact"
            label="Thêm bạn"
            size={20}
            onClick={() => setCreateKind('friend')}
          />
          <IconButton
            icon="group"
            label="Tạo nhóm"
            size={20}
            onClick={() => setCreateKind('group')}
          />
        </div>
        <div className={styles.filterRow}>
          <div className={styles.filterTabs}>
            <button
              className={!archivedView && !unreadOnly ? styles.filterSelected : ''}
              onClick={() => selectInboxTab('all')}
              aria-pressed={!archivedView && !unreadOnly}
            >
              Tất cả
            </button>
            <button
              className={!archivedView && unreadOnly ? styles.filterSelected : ''}
              onClick={() => selectInboxTab('unread')}
              aria-pressed={!archivedView && unreadOnly}
            >
              Chưa đọc
            </button>
            <button
              className={archivedView ? styles.filterSelected : ''}
              onClick={() => selectInboxTab('archived')}
              aria-pressed={archivedView}
            >
              Lưu trữ
            </button>
          </div>
          <TagFilter
            value={tagFilter}
            onChange={setTagFilter}
            mode={tagMode}
            onModeChange={setTagMode}
          />
          <WorkspaceFilters
            value={workFilter}
            onChange={setWorkFilter}
            onOpen={setWorkFilterOpen}
            data={workSummary.isError ? undefined : workSummary.data}
            loading={workSummary.isFetching}
            error={workSummary.error?.message}
            onRetry={() => void workSummary.refetch()}
          />
        </div>
        {inboxPreferences.error && (
          <div className={styles.listNotice} role="status">
            Chưa tải được tùy chọn lưu trữ.{' '}
            <button onClick={() => void inboxPreferences.retry()}>Thử lại</button>
          </div>
        )}
        <InboxStatus
          listError={error}
          liveDisconnected={liveDisconnected}
          archiveError={archiveInbox.error}
          tagsError={tags.error}
          unavailable={accountUnavailable.map((a) => a.name)}
          listUnavailable={listUnavailable.map((a) => a.name)}
          preparing={preparing.map((a) => a.name)}
          directoryError={search.trim() ? directorySearch.error : ''}
          searchError={search.trim() ? archiveSearch.error : ''}
          hasRows={conversations.length > 0}
          retry={retryInbox}
          retrying={loading}
          accounts={unavailable}
          retryAccount={(id) => {
            retryAccount.current = id;
            setReload((value) => value + 1);
          }}
        />
        {openingName && (
          <div className={styles.listNotice} role="status">
            Đang mở {openingName}…
          </div>
        )}
        {!sidebarError && search.trim() && (directorySearch.loading || archiveSearch.loading) && (
          <div className={styles.listNotice} role="status">
            Đang tìm trong danh bạ và lịch sử…
          </div>
        )}
        <ScrollArea
          scrollRef={conversationScroll}
          className={styles.conversationList}
          compact
          label="Danh sách hội thoại"
        >
          {phoneSearch && (
            <PhoneSearch
              phone={phone}
              accountId={phoneAccountId}
              accounts={data?.accounts || []}
              onAccountChange={(id) => {
                setPhoneAccountId(id);
                setMenu(null);
                setOpenedPerson(null);
                setSelectedId(null);
              }}
              onOpen={(conversation, anchor) => {
                setReload((n) => n + 1);
                if (anchor) setMenu({ conversation, anchor, phoneResult: true });
                else {
                  setOpenedPerson(conversation);
                  setSelectedId(conversation.id);
                  setInfoOpen(true);
                }
              }}
            />
          )}
          {inboxPreferences.ready && (
            <VirtualList
              items={visible}
              scrollRef={conversationScroll}
              resetKey={`${search}:${accountId}:${unreadOnly}:${archivedView}:${tagMode}:${tagFilter.join(',')}:${workFilter.person}:${workFilter.state}`}
              itemKey={(row) => row.conversation.id}
              pinnedKey={
                visible.find(
                  (row) =>
                    row.sources.some((s) => s.id === menu?.conversation.id) ||
                    (picker && picker.groupId === row.link?.id),
                )?.conversation.id
              }
              render={(row) => (
                <ConversationRow
                  key={row.conversation.id}
                  conversation={row.conversation}
                  sources={row.link ? row.sources : undefined}
                  selected={row.sources.some((s) => s.id === selectedId)}
                  menuOpen={
                    row.sources.some((s) => s.id === menu?.conversation.id) ||
                    (picker?.groupId === row.link?.id && !!picker)
                  }
                  onMenu={(_, anchor) => openRow(row, anchor, 'menu')}
                  onSelect={(_, anchor) => openRow(row, anchor, 'chat')}
                />
              )}
            />
          )}
          {(archiveSearch.hasMore || directorySearch.hasMore) && (
            <div className={styles.listNotice}>
              <button
                disabled={archiveSearch.loading || directorySearch.loading}
                onClick={() => {
                  if (archiveSearch.hasMore) archiveSearch.loadMore();
                  if (directorySearch.hasMore) directorySearch.loadMore();
                }}
              >
                Xem thêm kết quả
              </button>
            </div>
          )}
          {(!inboxPreferences.ready || !visible.length) && !phoneSearch && (
            <p className={styles.emptyList}>
              {!inboxPreferences.ready
                ? inboxPreferences.error
                  ? 'Chưa tải được danh sách'
                  : 'Đang tải danh sách…'
                : loading ||
                    archiveInbox.loading ||
                    archiveSearch.loading ||
                    directorySearch.loading
                  ? 'Đang tải danh sách…'
                  : sidebarError
                    ? 'Danh sách chưa sẵn sàng'
                    : workActive
                      ? workSummary.isFetching
                        ? 'Đang lọc công việc…'
                        : workSummary.isError
                          ? 'Chưa tải được công việc. Thử lại ở bộ lọc bên trên.'
                          : 'Không có hội thoại phù hợp. Bấm Bỏ lọc để xem tất cả.'
                      : 'Không có cuộc trò chuyện'}
            </p>
          )}
        </ScrollArea>
      </section>
      {picker && pickerLink && (
        <GroupAccountPicker
          key={picker.groupId + picker.mode}
          sources={pickerSources}
          link={pickerLink}
          anchor={picker.anchor}
          mode={picker.mode}
          onClose={() => setPicker(null)}
          onChoose={(source, remember) => {
            if (picker.mode === 'menu') {
              void openMenu(source, picker.anchor);
              setPicker(null);
            } else openSource(source, pickerLink, remember);
          }}
          onManage={() => {
            setLinkDialog(pickerLink);
            setPicker(null);
          }}
        />
      )}
      {linkDialog && (
        <GroupLinkDialog
          conversations={conversations}
          accounts={data?.accounts || []}
          links={data?.groups || []}
          initial={linkDialog}
          onChanged={updateLinks}
          onClose={() => setLinkDialog(null)}
        />
      )}
      {addPerson && (
        <AddPersonToGroupDialog
          person={addPerson}
          conversations={conversations}
          onClose={() => setAddPerson(null)}
        />
      )}
      {createKind && (
        <InboxCreateDialog
          kind={createKind}
          accounts={data?.accounts || []}
          initialAccountId={accountId ? Number(accountId) : selected?.accountId}
          onOpenSelf={(ownerId, conversationId) => {
            const self = conversations.find(
              (c) => c.accountId === ownerId && c.conversationId === conversationId,
            );
            if (self) {
              setSelectedId(self.id);
              setInfoOpen(true);
            } else {
              const owner = data?.accounts.find((a) => a.id === ownerId);
              if (owner) {
                const conversation: Conversation = {
                  id: `${ownerId}:${conversationId}`,
                  accountId: ownerId,
                  accountName: owner.name,
                  accountAvatarSrc: owner.avatarSrc,
                  conversationId,
                  name: 'My Documents',
                  avatarSrc: '/zalo-team/my-documents.png',
                  color: '#e5efff',
                  preview: '',
                  time: '',
                };
                setOpenedPerson(conversation);
                setSelectedId(conversation.id);
                setInfoOpen(true);
              }
            }
          }}
          onClose={() => setCreateKind(null)}
        />
      )}
      {menu && (
        <ConversationListMenu
          key={menu.conversation.id}
          conversation={{
            ...(conversations.find((item) => item.id === menu.conversation.id) ||
              menu.conversation),
            nativePreparation: menu.conversation.nativePreparation,
          }}
          archived={inboxPreferences.archived.has(String(menu.conversation.id))}
          onArchive={
            inboxPreferences.ready && !menu.phoneResult
              ? async () => {
                  const id = String(menu.conversation.id);
                  await inboxPreferences.set([id], !inboxPreferences.archived.has(id));
                  if (selectedId === menu.conversation.id) {
                    setSelectedId(null);
                    setOpenedPerson(null);
                  }
                }
              : undefined
          }
          anchor={menu.anchor}
          onAddToGroup={
            menu.phoneResult
              ? () => {
                  setAddPerson(menu.conversation);
                  setMenu(null);
                }
              : undefined
          }
          onClose={() => setMenu(null)}
          onChanged={() => setReload((value) => value + 1)}
        />
      )}
      <ConversationSettingsProvider conversation={selected}>
        <section
          className={styles.chat}
          aria-label={
            selected ? 'Cuộc trò chuyện với ' + selected.name : 'Chi tiết cuộc trò chuyện'
          }
        >
          {selected ? (
            <ConversationDetail
              key={selected.id}
              conversation={selected}
              infoOpen={infoOpen && !searchOpen}
              searchOpen={searchOpen}
              onToggleSearch={() => setSearchOpen((open) => !open)}
              searchHit={searchHit?.sourceId === selected.id ? searchHit : null}
              onToggleInfo={() => {
                setSearchOpen(false);
                setInfoOpen((open) => searchOpen || !open);
              }}
              onReady={() => rememberAfterReady(selected.id)}
              onChooseAccount={
                selectedLink
                  ? (anchor) => setPicker({ groupId: selectedLink.id, anchor, mode: 'chat' })
                  : undefined
              }
            />
          ) : (
            <div className={styles.conversationPlaceholder}>
              <Icon name="message" size={40} />
              <h2>Tin nhắn Zalo Team</h2>
              <p>Chọn một cuộc trò chuyện từ danh sách bên trái.</p>
              {data && (
                <p>
                  {grouped.length} cuộc trò chuyện ·{' '}
                  {data.accounts.filter((a) => a.state === 'connected' && !a.error).length}/
                  {data.accounts.length} tài khoản
                </p>
              )}
            </div>
          )}
        </section>
        {selected && searchOpen ? (
          <ConversationSearch
            key={selected.id}
            conversation={selected}
            onClose={() => setSearchOpen(false)}
            onSelect={(hit) =>
              setSearchHit((old) => ({
                sourceId: selected.id,
                hit,
                sequence: (old?.sequence || 0) + 1,
              }))
            }
          />
        ) : (
          selected && infoOpen && <ConversationInfo key={selected.id} conversation={selected} />
        )}
      </ConversationSettingsProvider>
    </ZaloTeamShell>
  );
}
