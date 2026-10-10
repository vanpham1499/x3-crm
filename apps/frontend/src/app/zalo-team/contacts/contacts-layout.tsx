'use client';
import { VirtualList } from '@/features/zalo-team/components/virtual-list';
import { TeamSelect } from '../../../features/zalo-team/components/team-select';
import {
  useSharedTags,
  matchesTags,
  TagChips,
  TagNotice,
} from '@/features/zalo-team/components/shared-tags';
import { ProfileDialog } from '@/features/zalo-team/components/profile-dialog';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZaloTeamShell } from '@/features/zalo-team/components/workspace-shell';
import { SearchInput } from '@/features/zalo-team/components/primitives';
import { Icon, IconButton, type IconName } from '@/features/zalo-team/components/icon';
import { Avatar } from '@/features/zalo-team/components/avatar';
import { AccountSelect } from '@/features/zalo-team/components/account-select';
import { TeamDialog } from '@/features/zalo-team/components/dialog';
import { InboxCreateDialog } from '@/features/zalo-team/components/inbox-create-dialog';
import { GroupManagementDialog } from '@/features/zalo-team/components/group-management';
import { ConversationSettingsProvider } from '@/features/zalo-team/components/conversation-settings-controls';
import {
  directoryRequest,
  directoryConversation,
  type DirectoryPerson,
  type DirectoryData,
  type DirectoryAction,
} from '@/features/zalo-team/directory';
import type { Conversation, ConversationListResponse } from '@/features/zalo-team/types';
import { subscribeChanges, affects } from '@/features/zalo-team/live';
import styles from '@/features/zalo-team/zalo-team.module.css';
type Tab = 'friends' | 'groups' | 'requests' | 'invitations';
type Account = ConversationListResponse['accounts'][number];
const tabs: { id: Tab; name: string; icon: IconName }[] = [
  { id: 'friends', name: 'Danh sách bạn bè', icon: 'directoryFriends' },
  { id: 'groups', name: 'Danh sách nhóm và cộng đồng', icon: 'directoryGroups' },
  { id: 'requests', name: 'Lời mời kết bạn', icon: 'directoryRequests' },
  { id: 'invitations', name: 'Lời mời vào nhóm và cộng đồng', icon: 'directoryInvites' },
];
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
export default function ContactsLayout() {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [accountId, setAccountId] = useState(''),
    [tab, setTab] = useState<Tab>('friends'),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [accountsLoaded, setAccountsLoaded] = useState(false),
    [retry, setRetry] = useState(0),
    [create, setCreate] = useState<'friend' | 'group' | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/zalo-team/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error();
        if (!c.signal.aborted) {
          setAccounts(d.accounts);
          setAccountsLoaded(true);
          setAccountId((old) => old || String(d.accounts[0]?.id || ''));
          setError('');
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError('Chưa tải được tài khoản.');
      });
    return () => c.abort();
  }, [retry]);
  const account = accounts.find((a) => String(a.id) === accountId);
  return (
    <ZaloTeamShell activePage="contacts" label="Danh bạ Zalo Team">
      <section
        className={`${styles.inbox} ${styles.directorySidebar}`}
        aria-label="Điều hướng danh bạ"
      >
        <div className={styles.searchRow}>
          <SearchInput label="Tìm kiếm danh bạ" value={search} onValueChange={setSearch} />
          <IconButton
            icon="addContact"
            label="Thêm bạn"
            size={20}
            onClick={() => setCreate('friend')}
          />
          <IconButton icon="group" label="Tạo nhóm" size={20} onClick={() => setCreate('group')} />
        </div>
        <div className={styles.directoryAccount}>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            placeholder={accountsLoaded ? 'Chưa liên kết tài khoản' : 'Đang tải…'}
            onChange={(value) => {
              setAccountId(value);
              setSearch('');
              setCreate(null);
            }}
          />
        </div>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={styles.directoryTab}
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setSearch('');
            }}
          >
            <Icon name={t.icon} size={24} />
            {t.name}
          </button>
        ))}
        {error && (
          <p role="alert" className={styles.listNotice}>
            {error}
            <button onClick={() => setRetry((n) => n + 1)}>Tải lại</button>
          </p>
        )}
      </section>
      {account ? (
        <DirectoryPane key={account.id + ':' + tab} account={account} tab={tab} search={search} />
      ) : (
        <section className={styles.directoryMain}>
          <p className={styles.emptyList}>
            {accountsLoaded
              ? 'Chưa có tài khoản. Vào Liên kết tài khoản để thêm tài khoản Zalo.'
              : error || 'Đang tải tài khoản…'}
          </p>
        </section>
      )}
      {create && account && (
        <InboxCreateDialog
          kind={create}
          initialAccountId={account.id}
          accounts={[account]}
          onClose={() => setCreate(null)}
        />
      )}
    </ZaloTeamShell>
  );
}
function DirectoryPane({ account, tab, search }: { account: Account; tab: Tab; search: string }) {
  const directoryScroll = useRef<HTMLDivElement>(null);
  const tags = useSharedTags();
  const router = useRouter(),
    alive = useRef(true),
    loaded = useRef(false),
    lock = useRef(false);
  const [data, setData] = useState<DirectoryData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState(tab === 'groups' ? 'recent' : 'az'),
    [label, setLabel] = useState(''),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0);
  const [menu, setMenu] = useState<{ person: DirectoryPerson; x: number; y: number } | null>(null),
    [profile, setProfile] = useState<DirectoryPerson | null>(null),
    [prepared, setPrepared] = useState<Conversation | null>(null),
    [dialog, setDialog] = useState<'profile' | 'rename' | 'leave' | null>(null),
    [confirm, setConfirm] = useState<{
      person: DirectoryPerson;
      kind: 'block' | 'unblock' | 'remove' | 'reject' | 'cancel' | 'accept' | 'join' | 'decline';
    } | null>(null),
    [uncertain, setUncertain] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null),
    title = tabs.find((t) => t.id === tab)!;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (account.state !== 'connected' || account.error) {
      setLoading(false);
      setError('Tài khoản chưa kết nối. Vui lòng kết nối lại tại Liên kết tài khoản.');
      return;
    }
    const c = new AbortController();
    setLoading(!loaded.current);
    setError('');
    directoryRequest(
      account.id,
      tab === 'invitations' ? { kind: tab, page: 0 } : { kind: tab },
      c.signal,
    )
      .then((d) => {
        if (!c.signal.aborted) {
          loaded.current = true;
          setData(d);
          setPage(0);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError('Chưa tải được danh bạ. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [account.id, account.state, account.error, tab, retry]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = subscribeChanges((e) => {
      if (!affects(e, 'directory', account.id)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setRetry((n) => n + 1), 400);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [account.id]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
        if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
      },
      key = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMenu(null);
      };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  const changed = () => {
    setMenu(null);
    setDialog(null);
    setConfirm(null);
    setUncertain(false);
    setRetry((n) => n + 1);
  };
  async function prepare(p: DirectoryPerson, mode: 'chat' | 'profile' | 'rename' | 'leave') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMenu(null);
    setError('');
    try {
      if (mode === 'chat') {
        router.push(
          `/zalo-team?directoryAccount=${account.id}&directoryPeer=${encodeURIComponent(p.id)}`,
        );
        return;
      }
      const opened = await directoryRequest(account.id, { kind: 'open', id: p.id });
      if (opened.status !== 'opened') throw Error();
      const detail =
        mode === 'profile'
          ? await directoryRequest(account.id, { kind: 'profile', id: p.id })
          : null;
      if (!alive.current) return;
      setPrepared(directoryConversation(p, account));
      setProfile(detail?.person || p);
      setDialog(mode);
    } catch {
      if (alive.current) setError('Chưa mở được liên hệ. Hãy tải lại danh sách.');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function act(action: DirectoryAction) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const d = await directoryRequest(account.id, action);
      if (!alive.current) return;
      if (d.status !== 'confirmed') {
        setUncertain(true);
        throw Error();
      }
      changed();
    } catch {
      if (alive.current) {
        setUncertain(true);
        setError(
          'Chưa xác nhận được kết quả. Tải lại danh sách để kiểm tra trước khi thao tác tiếp.',
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const ask = (p: DirectoryPerson, kind: NonNullable<typeof confirm>['kind']) => {
    setMenu(null);
    setDialog(null);
    setConfirm({ person: p, kind });
    setUncertain(false);
    setError('');
  };
  function matches(p: DirectoryPerson) {
    return (
      normalize(p.name).includes(normalize(search)) &&
      normalize(p.name).includes(normalize(query)) &&
      matchesTags(tags.data, `${account.id}:${p.id}`, label ? [label] : [])
    );
  }
  const rows = (data?.items || [])
    .filter(matches)
    .sort((a, b) =>
      sort === 'recent'
        ? (b.updatedAt || 0) - (a.updatedAt || 0)
        : sort === 'old'
          ? (a.updatedAt || 0) - (b.updatedAt || 0)
          : (sort === 'za' ? -1 : 1) * a.name.localeCompare(b.name, 'vi'),
    );
  const row = (p: DirectoryPerson) => (
    <div key={p.id} className={styles.directoryRow}>
      <button
        className={styles.directoryPerson}
        disabled={busy}
        onClick={() => void prepare(p, 'chat')}
        aria-label={`Nhắn tin với ${p.name}`}
      >
        <Avatar conversation={{ ...p, color: '#cbd6e4' }} size={48} />
        <span>
          <strong>{p.name}</strong>
          <TagChips source={`${account.id}:${p.id}`} />
          {p.group && <small>{p.memberCount || 0} thành viên</small>}
        </span>
      </button>
      <button
        aria-label={`Thao tác với ${p.name}`}
        className={styles.directoryMore}
        disabled={busy}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({
            person: p,
            x: Math.max(8, r.right - 230),
            y: Math.min(r.bottom, window.innerHeight - 250),
          });
        }}
      >
        <Icon name="more" size={20} />
      </button>
    </div>
  );
  const requests = (items: DirectoryPerson[], outgoing = false) => (
    <>
      <h3>
        {outgoing ? 'Lời mời đã gửi' : 'Lời mời đã nhận'} ({items.length})
      </h3>
      <div className={styles.directoryCards}>
        {items.filter(matches).map((p) => (
          <article key={p.id} className={styles.directoryRequest}>
            <button
              className={styles.directoryPerson}
              onClick={() => void prepare(p, 'profile')}
              disabled={busy}
            >
              <Avatar conversation={{ ...p, color: '#d0dbea' }} size={48} />
              <span>
                <strong>{p.name}</strong>
                {!!p.time && (
                  <small>
                    {new Date(p.time < 1e12 ? p.time * 1000 : p.time).toLocaleDateString('vi-VN')}
                  </small>
                )}
              </span>
            </button>
            {p.message && <p>{p.message}</p>}
            <div className={styles.directoryCardActions}>
              {outgoing ? (
                <button disabled={busy} onClick={() => ask(p, 'cancel')}>
                  Thu hồi lời mời
                </button>
              ) : (
                <>
                  <button disabled={busy} onClick={() => ask(p, 'reject')}>
                    Từ chối
                  </button>
                  <button
                    disabled={busy}
                    className={styles.directoryPrimary}
                    onClick={() => ask(p, 'accept')}
                  >
                    Đồng ý
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
  return (
    <section className={styles.directoryMain} aria-label={title.name}>
      <TagNotice />
      <header className={styles.directoryHeader}>
        <Icon name={title.icon} size={24} />
        <h1>{title.name}</h1>
        <button aria-label="Tải lại danh bạ" onClick={() => setRetry((n) => n + 1)}>
          Tải lại
        </button>
      </header>
      <div ref={directoryScroll} className={styles.directoryBody}>
        {error && (
          <p role="alert" className={styles.directoryError}>
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Đang tải danh bạ…</p>
        ) : data && (tab === 'friends' || tab === 'groups') ? (
          <>
            <h3>
              {tab === 'friends' ? 'Bạn bè' : 'Nhóm và cộng đồng'} ({data.items?.length || 0})
            </h3>
            <div className={styles.directoryList}>
              <div className={styles.directoryFilters}>
                <SearchInput
                  label={tab === 'friends' ? 'Tìm bạn' : 'Tìm nhóm'}
                  placeholder={tab === 'friends' ? 'Tìm bạn' : 'Tìm kiếm...'}
                  value={query}
                  onValueChange={setQuery}
                />
                <TeamSelect
                  aria-label="Sắp xếp danh bạ"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="az">Tên (A-Z)</option>
                  <option value="za">Tên (Z-A)</option>
                  {tab === 'groups' && (
                    <>
                      <option value="recent">Hoạt động (mới → cũ)</option>
                      <option value="old">Hoạt động (cũ → mới)</option>
                    </>
                  )}
                </TeamSelect>
                <TeamSelect
                  aria-label="Lọc phân loại"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {tags.data?.tags
                    .filter((t) => !t.archived)
                    .map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.name}
                      </option>
                    ))}
                </TeamSelect>
              </div>
              {!rows.length && (
                <p className={styles.directoryEmpty}>
                  Không tìm thấy {tab === 'friends' ? 'bạn bè' : 'nhóm'}.
                </p>
              )}
              <VirtualList
                items={rows}
                scrollRef={directoryScroll}
                estimate={76}
                resetKey={`${account.id}:${tab}:${query}:${search}:${label}:${sort}`}
                pinnedKey={menu?.person.id}
                itemKey={(p) => p.id}
                render={(p, i) => {
                  const letter = normalize(p.name)[0]?.toUpperCase() || '#',
                    previous = i ? normalize(rows[i - 1].name)[0]?.toUpperCase() : '';
                  return (
                    <div key={p.id}>
                      {tab === 'friends' && letter !== previous && (
                        <h4 className={styles.directoryLetter}>{letter}</h4>
                      )}
                      {row(p)}
                    </div>
                  );
                }}
              />
            </div>
          </>
        ) : data && tab === 'requests' ? (
          <>
            {requests(data.incoming || [])}
            {requests(data.outgoing || [], true)}
            {!data.incoming?.length && !data.outgoing?.length && (
              <p className={styles.directoryEmpty}>Bạn chưa có lời mời kết bạn.</p>
            )}
          </>
        ) : data && tab === 'invitations' ? (
          <>
            {!rows.length ? (
              <p className={styles.directoryEmpty}>Không có lời mời vào nhóm và cộng đồng</p>
            ) : (
              <div className={styles.directoryCards}>
                {rows.map((p) => (
                  <article key={p.id} className={styles.directoryRequest}>
                    <div className={styles.directoryPerson}>
                      <Avatar conversation={{ ...p, color: '#d0dbea' }} size={48} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.memberCount} thành viên</small>
                      </span>
                    </div>
                    <p>
                      {p.inviter
                        ? p.inviter + ' đã mời bạn tham gia nhóm.'
                        : 'Bạn được mời tham gia nhóm.'}
                    </p>
                    <div className={styles.directoryCardActions}>
                      <button disabled={busy || p.pending} onClick={() => ask(p, 'decline')}>
                        Từ chối
                      </button>
                      <button
                        className={styles.directoryPrimary}
                        disabled={busy || p.pending}
                        onClick={() => ask(p, 'join')}
                      >
                        {p.pending ? 'Chờ phê duyệt' : 'Tham gia'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {data.hasMore && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await directoryRequest(account.id, {
                      kind: 'invitations',
                      page: page + 1,
                    });
                    if (alive.current) {
                      setData((old) => ({
                        ...d,
                        items: [...(old?.items || []), ...(d.items || [])],
                      }));
                      setPage((p) => p + 1);
                    }
                  } catch {
                    setError('Chưa tải được trang tiếp theo.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Xem thêm
              </button>
            )}
          </>
        ) : null}
      </div>
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Thao tác với ${menu.person.name}`}
          className={styles.directoryMenu}
          style={{ left: menu.x, top: menu.y }}
        >
          <small>{account.name}</small>
          {!menu.person.group && (
            <button role="menuitem" onClick={() => void prepare(menu.person, 'profile')}>
              Xem thông tin
            </button>
          )}
          <button
            role="menuitem"
            onClick={() => {
              tags.pick(directoryConversation(menu.person, account));
              setMenu(null);
            }}
          >
            Phân loại
          </button>
          {menu.person.group ? (
            <button
              role="menuitem"
              className={styles.directoryDanger}
              onClick={() => void prepare(menu.person, 'leave')}
            >
              Rời nhóm
            </button>
          ) : (
            <>
              <button role="menuitem" onClick={() => void prepare(menu.person, 'rename')}>
                Đặt tên gợi nhớ
              </button>
              <button
                role="menuitem"
                onClick={() => ask(menu.person, menu.person.blocked ? 'unblock' : 'block')}
              >
                {menu.person.blocked ? 'Bỏ chặn người này' : 'Chặn người này'}
              </button>
              <button
                role="menuitem"
                className={styles.directoryDanger}
                onClick={() => ask(menu.person, 'remove')}
              >
                Xóa bạn
              </button>
            </>
          )}
        </div>
      )}
      {(dialog === 'profile' || dialog === 'rename') && profile && prepared && (
        <ConversationSettingsProvider conversation={prepared}>
          <ProfileDialog
            person={profile}
            conversation={prepared}
            rename={dialog === 'rename'}
            onClose={changed}
            onChat={() => void prepare(profile, 'chat')}
            onBlock={() => ask(profile, profile.blocked ? 'unblock' : 'block')}
            onRemove={() => ask(profile, 'remove')}
          />
        </ConversationSettingsProvider>
      )}
      {dialog === 'leave' && prepared && (
        <GroupManagementDialog
          conversation={prepared}
          onClose={() => setDialog(null)}
          onChanged={changed}
        />
      )}
      {confirm && (
        <TeamDialog
          title={
            {
              remove: 'Xóa bạn',
              block: 'Chặn người này',
              unblock: 'Bỏ chặn',
              reject: 'Từ chối lời mời',
              cancel: 'Thu hồi lời mời',
              accept: 'Đồng ý kết bạn',
              join: 'Tham gia nhóm',
              decline: 'Từ chối lời mời nhóm',
            }[confirm.kind]
          }
          onClose={() => !busy && setConfirm(null)}
        >
          <div className={styles.directoryConfirm}>
            <p>
              <strong>{confirm.person.name}</strong>
            </p>
            <p>
              Thực hiện bằng tài khoản <strong>{account.name}</strong>.
            </p>
            {confirm.kind === 'remove' && <p>Bạn và người này sẽ không còn là bạn bè trên Zalo.</p>}
            {confirm.kind === 'block' && <p>Người này sẽ không thể nhắn tin và gọi cho bạn.</p>}
            {uncertain && <p role="alert">{error}</p>}
          </div>
          <footer className={styles.inboxCreateFooter}>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Hủy
            </button>
            <button
              className={styles.inboxCreatePrimary}
              disabled={busy || uncertain}
              onClick={() => void act({ kind: confirm.kind, id: confirm.person.id })}
            >
              {busy ? 'Đang xử lý…' : 'Xác nhận'}
            </button>
          </footer>
        </TeamDialog>
      )}
    </section>
  );
}
