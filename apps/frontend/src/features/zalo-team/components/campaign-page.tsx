'use client';
import { useEffect, useRef, useState } from 'react';
import { CampaignReview } from './campaign-review';
import type { ListPaginationData } from './list-pagination';
import { CampaignList } from './campaign-list';
import type { CampaignAction } from './campaign-menu';
import { campaignAssetUrl } from './campaign-preview';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamFetch } from '../request';
import { ZaloTeamShell } from './workspace-shell';
import { TeamManagementLayout } from './management-layout';
import { TeamSelect } from './team-select';
import { TeamDialog } from './dialog';
import { Icon } from './icon';
import { Avatar } from './avatar';
import { CampaignMessageComposer, type CampaignAsset } from './campaign-message-composer';
import { TagMarker, useSharedTags } from './shared-tags';
import { directoryRequest, type DirectoryData } from '../directory';
import { useAccountAccess } from '../use-account-access';
import styles from '../campaigns.module.css';
import teamStyles from '../zalo-team.module.css';

type Part = { kind: string; text?: string; name?: string; assetId?: string };
type Delivery = { id: string; position: number; state: string; issue?: string };
type Recipient = {
  id: string;
  peer: string;
  name: string;
  parts: Part[];
  deliveries: Delivery[];
  suppressed: boolean;
};
type Campaign = {
  id: string;
  name: string;
  accountName: string;
  accountId: number;
  state: string;
  issue?: string;
  recipients: number;
  counts: Record<string, number>;
  parts: Part[];
  rows?: Recipient[];
  interval: number;
  startHour: number;
  endHour: number;
  scheduledAt?: string;
  createdAt?: string;
  canEdit?: boolean;
  canCopy?: boolean;
};
type Audience = { rows: { peer: string; name: string }[]; excluded: number };
type Bootstrap = {
  canSend: boolean;
  workerReady: boolean;
  accounts: { id: number; name: string; status: string; avatarSrc?: string }[];
  tags: { id: string; name: string }[];
  templates: { id: string; name: string; text: string }[];
};
const labels: Record<string, string> = {
  draft: 'Bản nháp',
  running: 'Đang chạy / chờ lịch',
  paused: 'Tạm dừng',
  cancelled: 'Đã hủy',
  completed: 'Hoàn tất',
  queued: 'Chờ gửi',
  preparing: 'Đang chuẩn bị',
  sending: 'Đang gửi',
  sent: 'Đã gửi',
  failed: 'Chưa gửi được',
  unknown: 'Chưa xác nhận',
  skipped: 'Đã bỏ qua',
};
async function command(body: Record<string, unknown>, signal?: AbortSignal) {
  const r = await teamFetch('/api/zalo-team/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.message || 'Chưa thực hiện được thao tác.');
  return data;
}
export function CampaignPage() {
  const access = useAccountAccess();
  const sharedTags = useSharedTags();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false),
    [active, setActive] = useState(''),
    [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [account, setAccount] = useState(''),
    [type, setType] = useState('person'),
    [match, setMatch] = useState('any');
  const [include, setInclude] = useState<string[]>([]),
    [exclude, setExclude] = useState<string[]>([]);
  const [peers, setPeers] = useState<string[]>([]),
    [search, setSearch] = useState('');
  const [recipientView, setRecipientView] = useState<'results' | 'selected'>('results');
  const [audiencePage, setAudiencePage] = useState(0);
  const [name, setName] = useState(''),
    [text, setText] = useState(''),
    [interval, setInterval] = useState(10);
  const [startHour, setStartHour] = useState(8),
    [endHour, setEndHour] = useState(20),
    [schedule, setSchedule] = useState('');
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [confirm, setConfirm] = useState<Campaign | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; revision: string } | null>(null);
  const [actionDialog, setActionDialog] = useState<'delete' | 'requeue' | 'cancel' | null>(null);
  const [actionTarget, setActionTarget] = useState<Campaign | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [listPage, setListPage] = useState(0);
  const [listQuery, setListQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setListQuery(listSearch.trim());
      setListPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [listSearch]);
  const lastCreate = useRef({ payload: '', id: '' });
  const bootstrap = useQuery<Bootstrap>({
    queryKey: ['campaigns', 'bootstrap'],
    enabled: !!access,
    queryFn: ({ signal }) => command({ kind: 'bootstrap' }, signal),
    staleTime: 60000,
    retry: false,
  });
  const list = useQuery<{ items: Campaign[]; pagination?: ListPaginationData }>({
    queryKey: ['campaigns', 'list', listPage, listQuery, stateFilter],
    enabled: !!access && !editing && !active,
    queryFn: ({ signal }) =>
      command(
        { kind: 'list', page: listPage, limit: 25, search: listQuery, state: stateFilter },
        signal,
      ),
    staleTime: 15000,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.items.some((c) => c.state === 'running') ? 20000 : false,
    refetchIntervalInBackground: false,
  });
  const detail = useQuery<Campaign>({
    queryKey: ['campaigns', 'detail', active, page],
    enabled: !!access && !!active && !editing,
    queryFn: ({ signal }) => command({ kind: 'detail', id: active, page }, signal),
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.state === 'running' ||
      q.state.data?.counts.preparing ||
      q.state.data?.counts.sending
        ? 10000
        : false,
    refetchIntervalInBackground: false,
  });
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thực hiện được thao tác.');
    } finally {
      setBusy(false);
    }
  }
  function invalidateAudience() {
    setPeers([]);
    setAudiencePage(0);
    setSearch('');
    setRecipientView('results');
  }
  function toggleTag(id: string, current: string[], setter: (v: string[]) => void) {
    setter(current.includes(id) ? current.filter((t) => t !== id) : [...current, id]);
    invalidateAudience();
  }
  const filters = {
    accountId: Number(account),
    type,
    match,
    includeTags: include,
    excludeTags: exclude,
  };
  const filterKey = JSON.stringify(filters);
  const [settledFilterKey, setSettledFilterKey] = useState(filterKey);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledFilterKey(filterKey), 300);
    return () => window.clearTimeout(timer);
  }, [filterKey]);
  const audienceQuery = useQuery<Audience>({
    queryKey: ['campaigns', 'audience', filterKey],
    enabled: !!access && editing && !!account && filterKey === settledFilterKey,
    queryFn: ({ signal }) => command({ kind: 'audience', ...JSON.parse(filterKey) }, signal),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const audienceLoading =
    !!account &&
    (filterKey !== settledFilterKey || audienceQuery.isPending || audienceQuery.isFetching);
  const audience = !audienceLoading && !audienceQuery.isError ? audienceQuery.data : undefined;
  const directoryKind = type === 'group' ? 'groups' : 'friends';
  const directory = useQuery<DirectoryData>({
    queryKey: ['directory-avatars', Number(account), directoryKind, 0],
    enabled: !!access && editing && !!account,
    queryFn: ({ signal }) => directoryRequest(Number(account), { kind: directoryKind }, signal),
    staleTime: 5 * 60000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const recipientProfiles = new Map(directory.data?.items?.map((person) => [person.id, person]));
  const tags = (bootstrap.data?.tags || []).map((tag) => ({
    ...tag,
    color: sharedTags.data?.tags.find((t) => t.id === tag.id)?.color || '#8b98a9',
  }));
  const selectedPeers = new Set(peers);
  const selectedRows = audience?.rows.filter((r) => selectedPeers.has(r.peer)) || [];
  const recipientUnit = type === 'group' ? 'nhóm' : 'người';
  function showSelected() {
    setRecipientView('selected');
    setSearch('');
    setAudiencePage(0);
  }
  async function create() {
    if (!audience || !selectedRows.length) {
      throw Error('Hãy chọn người nhận từ danh sách hiện tại.');
    }
    const payload = {
      kind: editTarget ? 'update' : 'create',
      ...(editTarget || {}),
      ...filters,
      name,
      text,
      peers: selectedRows.map((r) => r.peer),
      assetIds: assets.map((a) => a.id),
      interval,
      startHour,
      endHour,
    };
    const serialized = JSON.stringify(payload);
    if (lastCreate.current.payload !== serialized)
      lastCreate.current = { payload: serialized, id: crypto.randomUUID() };
    const result: Campaign = await command({ ...payload, requestId: lastCreate.current.id });
    setActive(result.id);
    setPage(0);
    setEditing(false);
    setEditTarget(null);
    setSchedule('');
    client.setQueryData(['campaigns', 'detail', result.id, 0], result);
    await client.invalidateQueries({ queryKey: ['campaigns', 'list'] });
  }
  async function openEditor(copy: boolean, id = active) {
    if (!id) return;
    const data = await command({ kind: 'edit', id });
    if (!copy && data.state !== 'draft') throw Error('Chỉ sửa được chiến dịch còn ở bản nháp.');
    setActive(id);
    setEditTarget(copy ? null : { id, revision: data.revision });
    lastCreate.current = { payload: '', id: '' };
    setName(copy ? `${data.name} (bản sao)`.slice(0, 100) : data.name);
    setAccount(String(data.accountId));
    setType(data.filters.type);
    setMatch(data.filters.match || 'any');
    setInclude(data.filters.includeTags || []);
    setExclude(data.filters.excludeTags || []);
    setPeers(data.peers);
    setText(data.text);
    setInterval(data.interval);
    setStartHour(data.startHour);
    setEndHour(data.endHour);
    setAssets(
      data.assets.map((asset: CampaignAsset) => ({
        ...asset,
        previewUrl: campaignAssetUrl(data.id, asset.id),
      })),
    );
    setSearch('');
    setAudiencePage(0);
    setRecipientView('selected');
    setSchedule('');
    setEditing(true);
  }
  async function manageCampaign() {
    const target = actionTarget || detail.data;
    if (!actionDialog || !target) return;
    const id = target.id;
    const kind = actionDialog;
    const result = await command({ kind, id });
    setActionDialog(null);
    setActionTarget(null);
    if (kind === 'delete') {
      setActive('');
      setPage(0);
    } else {
      setActive(id);
      setPage(0);
      client.setQueryData(['campaigns', 'detail', id, 0], result);
      if (kind === 'requeue') setConfirm(result);
    }
    await client.invalidateQueries({ queryKey: ['campaigns'] });
  }
  async function transition(kind: string, id = active) {
    await command({
      kind,
      id,
      ...(kind === 'start' && schedule
        ? { scheduledAt: new Date(schedule + ':00+07:00').toISOString() }
        : {}),
    });
    setConfirm(null);
    await client.invalidateQueries({ queryKey: ['campaigns'] });
  }
  const rows =
    (recipientView === 'selected' ? selectedRows : audience?.rows)?.filter((r) =>
      r.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
    ) || [];
  const visibleAudiencePage = Math.min(audiencePage, Math.max(0, Math.ceil(rows.length / 50) - 1));
  const c = detail.data;
  const dialogCampaign = actionTarget || c;
  function newCampaign() {
    setEditTarget(null);
    setName('');
    setText('');
    setAssets([]);
    setPeers([]);
    setSchedule('');
    lastCreate.current = { payload: '', id: '' };
    setEditing(true);
    setActive('');
  }
  function openCampaign(id: string) {
    setActive(id);
    setSchedule('');
    setPage(0);
    setEditing(false);
  }
  function loadCampaign(id: string): Promise<Campaign> {
    return client.fetchQuery({
      queryKey: ['campaigns', 'detail', id, 0],
      queryFn: ({ signal }) => command({ kind: 'detail', id, page: 0 }, signal),
      staleTime: 10000,
    });
  }
  function campaignAction(id: string, action: CampaignAction) {
    if (action === 'view') {
      openCampaign(id);
      return;
    }
    void act(async () => {
      if (action === 'copy' || action === 'edit') {
        await openEditor(action === 'copy', id);
        return;
      }
      const target = await loadCampaign(id);
      if (action === 'delete' || action === 'cancel' || action === 'requeue') {
        setActionTarget(target);
        setActionDialog(action);
      } else if (action === 'start' || action === 'resume') {
        openCampaign(id);
        setConfirm(target);
      } else await transition('pause', id);
    });
  }
  const issue = error || bootstrap.error?.message || list.error?.message || detail.error?.message;
  return (
    <ZaloTeamShell activePage="campaigns" label="Gửi hàng loạt">
      <TeamManagementLayout
        title="Gửi hàng loạt"
        navigationLabel="Điều hướng gửi hàng loạt"
        classNames={{
          layout: styles.layout,
          sidebar: styles.sidebar,
          sidebarTitle: styles.sidebarTitle,
        }}
        navigation={
          <>
            <button
              className={teamStyles.directoryTab}
              aria-pressed={!editing}
              aria-current={!editing ? 'page' : undefined}
              onClick={() => {
                setEditing(false);
                setActive('');
              }}
            >
              <Icon name="documents" size={24} />
              Chiến dịch
            </button>
            <button
              className={teamStyles.directoryTab}
              aria-pressed={editing}
              aria-current={editing ? 'page' : undefined}
              disabled={!bootstrap.data?.canSend || busy}
              onClick={newCampaign}
            >
              <Icon name="edit" size={24} />
              Tạo chiến dịch
            </button>
          </>
        }
      >
        <section className={styles.page} aria-label={editing ? 'Tạo chiến dịch' : 'Chiến dịch'}>
          <header className={teamStyles.directoryHeader}>
            <Icon name={editing ? 'edit' : 'documents'} size={24} />
            <h1>
              {editing ? (editTarget ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch') : 'Chiến dịch'}
            </h1>
            <button
              className={styles.refresh}
              aria-label="Tải lại chiến dịch"
              disabled={busy}
              onClick={() => void client.invalidateQueries({ queryKey: ['campaigns'] })}
            >
              Tải lại
            </button>
          </header>
          <div className={`${styles.body} ${editing ? styles.editingBody : ''}`}>
            {issue && (
              <div className={styles.notice} role="alert">
                {issue}
              </div>
            )}
            {bootstrap.data && !bootstrap.data.canSend && (
              <div className={styles.notice}>Bạn chưa được cấp quyền gửi chiến dịch.</div>
            )}
            {bootstrap.data && !bootstrap.data.workerReady && (
              <div className={styles.notice}>
                Dịch vụ gửi chiến dịch chưa sẵn sàng. Bạn vẫn có thể chuẩn bị bản nháp.
              </div>
            )}
            {editing ? (
              <div className={styles.composer}>
                <section className={styles.recipientPane} aria-label="Chọn người nhận">
                  <div className={styles.paneHeading}>
                    <h2>Người nhận</h2>
                    <span className={styles.count} aria-live="polite">
                      {selectedRows.length} {recipientUnit} đã chọn
                    </span>
                  </div>
                  <div className={styles.recipientControls}>
                    <label className={styles.field}>
                      Tài khoản gửi
                      <TeamSelect
                        aria-label="Tài khoản gửi"
                        value={account}
                        disabled={busy}
                        onChange={(e) => {
                          setAccount(e.target.value);
                          invalidateAudience();
                        }}
                        options={[
                          { value: '', label: 'Chọn tài khoản' },
                          ...(bootstrap.data?.accounts || []).map((a) => ({
                            value: String(a.id),
                            label: a.name,
                            icon: (
                              <Avatar
                                conversation={{
                                  name: a.name,
                                  avatarSrc: a.avatarSrc,
                                  color: '#e5efff',
                                }}
                                size={24}
                              />
                            ),
                            disabled: a.status !== 'connected',
                          })),
                        ]}
                      />
                    </label>
                    <div className={styles.recipientTabs} role="group" aria-label="Loại hội thoại">
                      {[
                        ['person', 'Bạn bè'],
                        ['group', 'Nhóm'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          aria-pressed={type === value}
                          disabled={busy}
                          onClick={() => {
                            if (type === value) return;
                            setType(value);
                            invalidateAudience();
                          }}
                        >
                          <Icon
                            name={value === 'group' ? 'directoryGroups' : 'directoryFriends'}
                            size={20}
                          />
                          {label}
                        </button>
                      ))}
                    </div>
                    <details className={styles.filters}>
                      <summary>
                        <Icon name="tag" size={17} />
                        <span>
                          Lọc theo thẻ
                          {include.length + exclude.length
                            ? ` (${include.length + exclude.length})`
                            : ''}
                        </span>
                        <Icon name="chevronDown" size={14} />
                      </summary>
                      <div className={styles.filterContent}>
                        <span className={styles.muted}>Có thẻ</span>
                        <div className={styles.tags}>
                          {tags.map((t) => (
                            <label key={t.id}>
                              <input
                                type="checkbox"
                                disabled={busy}
                                checked={include.includes(t.id)}
                                onChange={() => toggleTag(t.id, include, setInclude)}
                              />
                              <TagMarker color={t.color} />
                              {t.name}
                            </label>
                          ))}
                        </div>
                        {include.length > 1 && (
                          <TeamSelect
                            aria-label="Cách khớp thẻ"
                            value={match}
                            disabled={busy}
                            onChange={(e) => {
                              setMatch(e.target.value);
                              invalidateAudience();
                            }}
                            options={[
                              { value: 'any', label: 'Có một trong các thẻ' },
                              { value: 'all', label: 'Có đủ các thẻ' },
                            ]}
                          />
                        )}
                        <details>
                          <summary>
                            <span>Loại trừ thẻ{exclude.length ? ` (${exclude.length})` : ''}</span>
                            <Icon name="chevronDown" size={14} />
                          </summary>
                          <div className={styles.tags}>
                            {tags.map((t) => (
                              <label key={t.id}>
                                <input
                                  type="checkbox"
                                  disabled={busy}
                                  checked={exclude.includes(t.id)}
                                  onChange={() => toggleTag(t.id, exclude, setExclude)}
                                />
                                <TagMarker color={t.color} />
                                {t.name}
                              </label>
                            ))}
                          </div>
                        </details>
                        {!bootstrap.data?.tags.length && (
                          <span className={styles.muted}>Chưa có thẻ chung.</span>
                        )}
                      </div>
                    </details>
                    {!!(include.length + exclude.length) && (
                      <div className={styles.filterSummary} aria-label="Bộ lọc đang áp dụng">
                        {include.length > 0 && (
                          <span>
                            Có {match === 'all' ? 'đủ' : 'một trong'}:{' '}
                            {tags
                              .filter((t) => include.includes(t.id))
                              .map((t) => (
                                <span className={styles.tagLabel} key={t.id}>
                                  <TagMarker color={t.color} />
                                  {t.name}
                                </span>
                              ))}
                          </span>
                        )}
                        {exclude.length > 0 && (
                          <span>
                            Loại trừ:{' '}
                            {tags
                              .filter((t) => exclude.includes(t.id))
                              .map((t) => (
                                <span className={styles.tagLabel} key={t.id}>
                                  <TagMarker color={t.color} />
                                  {t.name}
                                </span>
                              ))}
                          </span>
                        )}
                        <button
                          className={styles.textButton}
                          disabled={busy}
                          onClick={() => {
                            setInclude([]);
                            setExclude([]);
                            invalidateAudience();
                          }}
                        >
                          Xóa bộ lọc
                        </button>
                      </div>
                    )}
                  </div>
                  {audience ? (
                    <>
                      <div className={styles.audienceTabs} aria-label="Danh sách người nhận">
                        <button
                          aria-pressed={recipientView === 'results'}
                          onClick={() => {
                            setRecipientView('results');
                            setAudiencePage(0);
                            setSearch('');
                          }}
                        >
                          Kết quả lọc ({audience.rows.length})
                        </button>
                        <button aria-pressed={recipientView === 'selected'} onClick={showSelected}>
                          Đã chọn ({selectedRows.length})
                        </button>
                      </div>
                      <div className={styles.searchBox}>
                        <Icon name="search" size={17} />
                        <input
                          aria-label="Tìm trong tệp khách"
                          placeholder={
                            recipientView === 'selected'
                              ? 'Tìm trong danh sách đã chọn'
                              : 'Tìm theo tên'
                          }
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setAudiencePage(0);
                          }}
                        />
                      </div>
                      <div className={styles.selectionBar}>
                        <label>
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả kết quả"
                            ref={(input) => {
                              if (input)
                                input.indeterminate =
                                  rows.some((r) => selectedPeers.has(r.peer)) &&
                                  !rows.every((r) => selectedPeers.has(r.peer));
                            }}
                            disabled={!rows.length || busy}
                            checked={!!rows.length && rows.every((r) => selectedPeers.has(r.peer))}
                            onChange={(e) =>
                              setPeers(
                                e.target.checked
                                  ? Array.from(new Set([...peers, ...rows.map((r) => r.peer)]))
                                  : peers.filter((p) => !rows.some((r) => r.peer === p)),
                              )
                            }
                          />
                          Chọn tất cả {rows.length} {recipientUnit}
                          {search ? ' tìm thấy' : ''}
                        </label>
                        {!!selectedRows.length && (
                          <button
                            className={styles.textButton}
                            disabled={busy}
                            onClick={() => setPeers([])}
                          >
                            Bỏ tất cả
                          </button>
                        )}
                      </div>
                      <div className={styles.recipientList}>
                        {rows
                          .slice(visibleAudiencePage * 50, (visibleAudiencePage + 1) * 50)
                          .map((r) => (
                            <label
                              className={styles.recipientRow}
                              key={r.peer}
                              data-selected={selectedPeers.has(r.peer)}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${r.name}`}
                                disabled={busy}
                                checked={selectedPeers.has(r.peer)}
                                onChange={(e) =>
                                  setPeers(
                                    e.target.checked
                                      ? [...peers, r.peer]
                                      : peers.filter((p) => p !== r.peer),
                                  )
                                }
                              />
                              <Avatar
                                conversation={{
                                  ...recipientProfiles.get(r.peer),
                                  name: r.name,
                                  group: type === 'group',
                                  color: '#e5efff',
                                }}
                                size={36}
                              />
                              <span className={styles.recipientName} title={r.name}>
                                {r.name}
                              </span>
                            </label>
                          ))}
                        {!rows.length && (
                          <p className={styles.empty}>
                            {recipientView === 'selected' && !selectedRows.length
                              ? 'Chưa chọn người nhận. Mở Kết quả lọc rồi tích chọn.'
                              : 'Không có người nhận phù hợp.'}
                          </p>
                        )}
                      </div>
                      <div className={styles.listFooter}>
                        <span>
                          {audience.excluded
                            ? `${audience.excluded} đã loại trừ`
                            : `${selectedRows.length} ${recipientUnit} đã chọn`}
                        </span>
                        <div>
                          <button
                            aria-label="Trang người nhận trước"
                            disabled={!visibleAudiencePage}
                            onClick={() => setAudiencePage(visibleAudiencePage - 1)}
                          >
                            ‹
                          </button>
                          <span>
                            {visibleAudiencePage + 1}/{Math.max(1, Math.ceil(rows.length / 50))}
                          </span>
                          <button
                            aria-label="Trang người nhận sau"
                            disabled={(visibleAudiencePage + 1) * 50 >= rows.length}
                            onClick={() => setAudiencePage(visibleAudiencePage + 1)}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyRecipients}>
                      <Icon name="contact" size={38} />
                      <strong role="status">
                        {!account
                          ? 'Chọn tài khoản gửi'
                          : audienceLoading
                            ? 'Đang tìm người nhận…'
                            : 'Chưa tải được danh sách'}
                      </strong>
                      <span>
                        {!account
                          ? 'Danh sách bạn bè và nhóm sẽ hiện ở đây.'
                          : audienceLoading
                            ? 'Đang cập nhật theo lựa chọn của bạn.'
                            : audienceQuery.error?.message}
                      </span>
                      {!!account && !audienceLoading && (
                        <button onClick={() => void audienceQuery.refetch()}>Thử lại</button>
                      )}
                    </div>
                  )}
                </section>
                <section className={styles.messagePane} aria-label="Soạn chiến dịch">
                  <div className={styles.messageBody}>
                    <label className={styles.field}>
                      Tên chiến dịch
                      <input
                        placeholder="Ví dụ: Thông báo lịch nghỉ"
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <div className={styles.contentHeading}>
                      <h2>Nội dung tin nhắn</h2>
                      <div className={styles.templateSelect}>
                        <TeamSelect
                          aria-label="Mẫu tin"
                          appearance="chip"
                          value=""
                          onChange={(e) => {
                            const t = bootstrap.data?.templates.find(
                              (t) => t.id === e.target.value,
                            );
                            if (t) setText(t.text);
                          }}
                          options={[
                            { value: '', label: 'Mẫu tin' },
                            ...(bootstrap.data?.templates || []).map((t) => ({
                              value: t.id,
                              label: t.name,
                            })),
                          ]}
                        />
                      </div>
                    </div>
                    <CampaignMessageComposer
                      accountId={account ? Number(account) : undefined}
                      value={text}
                      onChange={setText}
                      assets={assets}
                      busy={busy}
                      onRemove={(id) =>
                        setAssets((current) => current.filter((asset) => asset.id !== id))
                      }
                      onFiles={(files) =>
                        void act(async () => {
                          if (files.length + assets.length > 3) throw Error('Tối đa 3 tệp.');
                          for (const file of files) {
                            if (!file.size || file.size > 25 * 1024 * 1024)
                              throw Error('Tệp phải có dữ liệu và không quá 25 MB.');
                            const form = new FormData();
                            form.append('kind', 'asset');
                            form.append('accountId', account);
                            form.append('file', file);
                            const response = await fetch('/api/zalo-team/campaigns', {
                              method: 'POST',
                              body: form,
                            });
                            const asset = await response.json();
                            if (!response.ok) throw Error(asset.message || 'Chưa tải được tệp.');
                            setAssets((current) => [...current, { ...asset, file }]);
                          }
                        })
                      }
                    />
                    <div className={styles.editorTools}>
                      <button
                        disabled={!text.trim() || !name.trim() || busy}
                        onClick={() =>
                          void act(async () => {
                            await command({
                              kind: 'template',
                              requestId: crypto.randomUUID(),
                              name,
                              text,
                            });
                            await bootstrap.refetch();
                          })
                        }
                      >
                        Lưu mẫu
                      </button>
                    </div>
                    <details className={styles.sendSettings}>
                      <summary>
                        <Icon name="settings" size={18} />
                        <span>Cài đặt gửi</span>
                        <span className={styles.settingsSummary}>
                          {interval} giây/tin · {startHour}:00–{endHour}:00
                        </span>
                        <Icon name="chevronDown" size={14} />
                      </summary>
                      <div className={styles.settingsFields}>
                        <label className={styles.field}>
                          Giãn cách (giây)
                          <input
                            type="number"
                            min={10}
                            max={3600}
                            value={interval}
                            onChange={(e) => setInterval(Number(e.target.value))}
                          />
                        </label>
                        <label className={styles.field}>
                          Từ giờ
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={startHour}
                            onChange={(e) => setStartHour(Number(e.target.value))}
                          />
                        </label>
                        <label className={styles.field}>
                          Đến giờ
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={endHour}
                            onChange={(e) => setEndHour(Number(e.target.value))}
                          />
                        </label>
                        <p className={styles.settingsNote}>
                          Giờ Việt Nam. Tối đa 2.000 người/lượt. Người đã ngừng nhận hoặc thuộc thẻ
                          loại trừ sẽ không nhận tin.
                        </p>
                      </div>
                    </details>
                  </div>
                  <footer className={styles.composeFooter}>
                    <span>
                      <strong>{selectedRows.length}</strong> {recipientUnit} đã chọn{' '}
                      <span className={styles.muted}>
                        · {Number(!!text.trim()) + assets.length} phần tin
                      </span>
                    </span>
                    <button
                      className={styles.primary}
                      disabled={
                        !selectedRows.length ||
                        !name.trim() ||
                        (!text.trim() && !assets.length) ||
                        busy
                      }
                      onClick={() => void act(() => create())}
                    >
                      {editTarget ? 'Lưu thay đổi' : 'Xem trước'}
                    </button>
                  </footer>
                </section>
              </div>
            ) : active ? (
              c ? (
                <CampaignReview
                  key={c.id}
                  campaign={c}
                  labels={labels}
                  busy={busy}
                  workerReady={!!bootstrap.data?.workerReady}
                  schedule={schedule}
                  onSchedule={setSchedule}
                  page={page}
                  onPage={setPage}
                  onConfirm={() => setConfirm(c)}
                  onTransition={(kind) =>
                    kind === 'cancel' ? setActionDialog('cancel') : void act(() => transition(kind))
                  }
                  onEdit={() => void act(() => openEditor(false))}
                  onCopy={() => void act(() => openEditor(true))}
                  onDelete={() => setActionDialog('delete')}
                  onRequeue={() => setActionDialog('requeue')}
                  onBack={() => {
                    setActive('');
                    setPage(0);
                  }}
                  onRetry={(deliveryId) =>
                    void act(async () => {
                      await command({ kind: 'retry', id: active, deliveryId });
                      await detail.refetch();
                    })
                  }
                  onSuppress={(r) =>
                    void act(async () => {
                      await command({
                        kind: 'suppress',
                        id: active,
                        recipientId: r.id,
                        suppressed: !r.suppressed,
                      });
                      await detail.refetch();
                      setError(
                        r.suppressed
                          ? `${r.name} có thể nhận chiến dịch mới. Các phần đã bỏ qua không tự gửi lại.`
                          : `${r.name} đã được loại khỏi các lượt gửi tiếp theo của tài khoản này.`,
                      );
                    })
                  }
                />
              ) : (
                <p>Đang tải chiến dịch…</p>
              )
            ) : (
              <CampaignList
                items={list.data?.items || []}
                accounts={bootstrap.data?.accounts || []}
                labels={labels}
                search={listSearch}
                onSearch={setListSearch}
                filter={stateFilter}
                onFilter={(value) => {
                  setStateFilter(value);
                  setListPage(0);
                }}
                pagination={list.data?.pagination}
                onPage={setListPage}
                busy={busy || !bootstrap.data?.canSend}
                loading={list.isPending}
                onOpen={openCampaign}
                load={loadCampaign}
                onAction={campaignAction}
              />
            )}
          </div>
        </section>
      </TeamManagementLayout>
      {confirm && (
        <TeamDialog
          title="Xác nhận gửi chiến dịch"
          className={styles.dialog}
          onClose={() => !busy && setConfirm(null)}
        >
          <div className={styles.dialogBody}>
            {error && (
              <p role="alert" className={styles.notice}>
                {error}
              </p>
            )}
            <p>
              <strong>{confirm.name}</strong>
            </p>
            <p>
              {confirm.state === 'paused'
                ? `Tiếp tục ${confirm.counts.queued || 0} phần tin chưa gửi`
                : `Gửi tới ${confirm.recipients} người/nhóm`}{' '}
              bằng tài khoản <strong>{confirm.accountName}</strong>.
            </p>
            <p>
              {confirm.state === 'draft' && schedule
                ? `Hẹn giờ ${schedule.replace('T', ' ')} (Việt Nam).`
                : 'Bắt đầu trong khung giờ đã chọn.'}{' '}
              Tin đã gửi không được thu hồi khi hủy chiến dịch.
            </p>
            <div className={styles.toolbar}>
              <button disabled={busy} onClick={() => setConfirm(null)}>
                Quay lại
              </button>
              <button
                className={styles.primary}
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    transition(confirm.state === 'paused' ? 'resume' : 'start', confirm.id),
                  )
                }
              >
                Gửi chiến dịch
              </button>
            </div>
          </div>
        </TeamDialog>
      )}
      {actionDialog && dialogCampaign && (
        <TeamDialog
          title={
            actionDialog === 'delete'
              ? 'Xóa chiến dịch?'
              : actionDialog === 'cancel'
                ? 'Hủy phần chưa gửi?'
                : 'Chuẩn bị gửi tiếp?'
          }
          className={styles.dialog}
          onClose={() => {
            if (!busy) {
              setActionDialog(null);
              setActionTarget(null);
            }
          }}
        >
          <div className={styles.dialogBody}>
            <strong>{dialogCampaign.name}</strong>
            <p>
              {actionDialog === 'delete'
                ? 'Chiến dịch sẽ được gỡ khỏi danh sách. Tin đã gửi trên Zalo vẫn giữ nguyên.'
                : actionDialog === 'cancel'
                  ? 'Dừng các phần chưa gửi. Tin đã gửi không được thu hồi.'
                  : 'Đưa các phần bị bỏ qua, lỗi trước khi gửi hoặc đã hủy về hàng chờ. Giữ nguyên phần đã gửi. Người đã ngừng nhận vẫn được loại trừ. Bạn sẽ xác nhận trước khi bắt đầu gửi.'}
            </p>
            {error && (
              <p role="alert" className={styles.notice}>
                {error}
              </p>
            )}
            <div className={styles.toolbar}>
              <button
                disabled={busy}
                onClick={() => {
                  setActionDialog(null);
                  setActionTarget(null);
                }}
              >
                Quay lại
              </button>
              <button
                className={actionDialog === 'delete' ? styles.dangerButton : styles.primary}
                disabled={busy}
                onClick={() => void act(manageCampaign)}
              >
                {busy
                  ? 'Đang xử lý…'
                  : actionDialog === 'delete'
                    ? 'Xóa chiến dịch'
                    : actionDialog === 'cancel'
                      ? 'Hủy phần chưa gửi'
                      : 'Chuẩn bị gửi tiếp'}
              </button>
            </div>
          </div>
        </TeamDialog>
      )}
    </ZaloTeamShell>
  );
}
