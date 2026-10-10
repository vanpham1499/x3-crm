'use client';
import { teamFetch, backgroundRead, teamApiPolicy } from '@/features/zalo-team/request';

import { TeamSelect } from './team-select';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { TeamDialog } from './dialog';
import { Icon } from './icon';
import type { Conversation } from '../types';
import styles from '../zalo-team.module.css';
export type SharedTag = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  count: number;
};
type TagData = {
  revision: number;
  canManage: boolean;
  tags: SharedTag[];
  assignments: Record<string, string[]>;
  unavailable: string[];
  batches: {
    id: string;
    createdAt: string;
    rolledBack: boolean;
    result: { added: number; pending: number; preserved: number };
  }[];
};
type Preview = {
  id: string;
  labels: {
    key: string;
    accountName: string;
    name: string;
    color: string;
    count: number;
    pending: number;
    targetId?: string | null;
  }[];
  unavailable: string[];
};
type Mapping = { key: string; targetId: string | null; name: string; color: string; skip: boolean };
type TagsContext = {
  data: TagData | null;
  error: string;
  busy: boolean;
  refresh: () => void;
  act: (v: Record<string, unknown>) => Promise<boolean>;
  manage: () => void;
  pick: (c: Conversation) => void;
};
const Context = createContext<TagsContext | null>(null);
async function request(v: Record<string, unknown>) {
  const r = await teamFetch('/api/zalo-team/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || 'Chưa xử lý được thẻ.');
  return d;
}
export function useSharedTags() {
  const c = useContext(Context);
  if (!c) throw Error('SharedTagsProvider missing');
  return c;
}
export function SharedTagsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TagData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [manager, setManager] = useState(false),
    [person, setPerson] = useState<Conversation | null>(null);
  const live = useRef(true),
    lock = useRef(false),
    reading = useRef(false),
    generation = useRef(0),
    uncertain = useRef(false);
  const refresh = useCallback(async (explicit = false) => {
    if (reading.current || lock.current || (uncertain.current && !explicit)) return;
    reading.current = true;
    const start = generation.current;
    try {
      const d = await request({ kind: 'read' });
      if (live.current && start === generation.current) {
        setData(d);
        setError('');
        uncertain.current = false;
      }
    } catch (e) {
      if (live.current && start === generation.current) setError((e as Error).message);
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    live.current = true;
    const focus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const open = () => setManager(true);

    window.addEventListener('zalo-team-group-updated', focus);
    window.addEventListener('zalo-team-manage-tags', open);
    const stop = backgroundRead(() => refresh(), teamApiPolicy.tagsInterval);
    return () => {
      live.current = false;
      stop();

      window.removeEventListener('zalo-team-group-updated', focus);
      window.removeEventListener('zalo-team-manage-tags', open);
    };
  }, [refresh]);
  async function act(v: Record<string, unknown>) {
    if (lock.current || !data || uncertain.current) return false;
    lock.current = true;
    generation.current++;
    setBusy(true);
    setError('');
    try {
      const r = await request({ revision: data.revision, ...v, requestId: crypto.randomUUID() });
      if (live.current) setData(r.data);
      return true;
    } catch (e) {
      uncertain.current = true;
      if (live.current) setError((e as Error).message);
      return false;
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  const root =
    typeof document === 'undefined' ? null : document.querySelector(`.${styles.workspace}`);
  return (
    <Context.Provider
      value={{
        data,
        error,
        busy,
        refresh: () => void refresh(true),
        act,
        manage: () => setManager(true),
        pick: setPerson,
      }}
    >
      {children}
      {manager &&
        root &&
        createPortal(<TagManager onClose={() => !busy && setManager(false)} />, root)}
      {person &&
        root &&
        createPortal(
          <TagPicker conversation={person} onClose={() => !busy && setPerson(null)} />,
          root,
        )}
    </Context.Provider>
  );
}
export function TagNotice() {
  const { error, refresh } = useSharedTags();
  return error ? (
    <div className={styles.tagNotice} role="alert">
      {error} <button onClick={refresh}>Tải lại thẻ</button>
    </div>
  ) : null;
}
export function TagMarker({ color }: { color: string }) {
  return (
    <svg
      className={styles.tagMarker}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ color }}
    >
      <path
        fill="currentColor"
        d="M2 3h7.2a1 1 0 0 1 .7.3l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-.7.3H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}
export function TagChips({ source, limit = 2 }: { source: string; limit?: number }) {
  const { data } = useSharedTags();
  const ids = data?.assignments[source] || [],
    tags = data?.tags.filter((t) => !t.archived && ids.includes(t.id)) || [];
  return (
    <span className={styles.tagChips}>
      {tags.slice(0, limit).map((t) => (
        <span
          key={t.id}
          className={styles.tagChip}

          title={t.name}
        >
          <TagMarker color={t.color} />
          <span>{t.name}</span>
        </span>
      ))}
      {tags.length > limit && (
        <span
          className={styles.tagOverflow}
          title={tags
            .slice(limit)
            .map((t) => t.name)
            .join(', ')}
        >
          +{tags.length - limit}
        </span>
      )}
    </span>
  );
}
export function ConversationTagIcon({
  source,
  onClick,
}: {
  source: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  const { data } = useSharedTags();
  const ids = data?.assignments[source] || [];
  const tags = data?.tags.filter((tag) => !tag.archived && ids.includes(tag.id)) || [];
  const ref = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(8, Math.min(rect.left - 12, window.innerWidth - 228)),
        top: rect.bottom + 8,
      });
  };
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [position]);
  if (!tags.length) return null;
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.conversationTagIcon}
        aria-label={`Thẻ: ${tags.map((tag) => tag.name).join(', ')}`}
        aria-describedby={position ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocus={show}
        onBlur={() => setPosition(null)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setPosition(null);
        }}
        onClick={onClick}
      >
        <TagMarker color={tags[0].color} />
      </button>
      {position &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={styles.conversationTagTooltip}
            style={position}
          >
            {tags.map((tag) => tag.name).join(', ')}
          </span>,
          document.body,
        )}
    </>
  );
}
export function ConversationTags({ conversation }: { conversation: Conversation }) {
  const { pick, data } = useSharedTags();
  const ids = data?.assignments[String(conversation.id)] || [];
  const hasTags = data?.tags.some((tag) => !tag.archived && ids.includes(tag.id));
  return (
    <button
      className={styles.conversationTags}
      title="Phân loại hội thoại"
      aria-label={`Phân loại ${conversation.name}`}
      disabled={!data}
      onClick={() => pick(conversation)}
    >
      {hasTags ? (
        <TagChips source={String(conversation.id)} />
      ) : (
        <>
          <Icon name="tag" size={16} />
          <span>Phân loại</span>
        </>
      )}
    </button>
  );
}
function TagPicker({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { data, busy, act, manage } = useSharedTags(),
    [search, setSearch] = useState('');
  const source = String(conversation.id),
    ids = data?.assignments[source] || [];
  return (
    <TeamDialog title="Phân loại hội thoại" onClose={onClose}>
      <div className={styles.tagBody}>
        <strong>{conversation.name}</strong>
        <p className={styles.tagHint}>
          Thẻ dùng chung trong Zalo Team. Nhóm đã liên kết áp dụng cho các tài khoản đang truy cập
          được.
        </p>
        <TagNotice />
        <input
          className={styles.tagInput}
          placeholder="Tìm thẻ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {data?.assignments[source] === undefined ? (
          <p>Chưa xác minh được hội thoại. Tải lại thẻ sau khi mở hội thoại.</p>
        ) : (
          <div className={styles.tagChoices}>
            {data.tags
              .filter(
                (t) =>
                  !t.archived &&
                  t.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
              )
              .map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(t.id)}
                    disabled={busy}
                    onChange={(e) =>
                      void act({ kind: 'assign', source, id: t.id, active: e.target.checked })
                    }
                  />
                  <TagMarker color={t.color} />
                  {t.name}
                </label>
              ))}
          </div>
        )}
        {!data?.tags.some((t) => !t.archived) && (
          <p>Chưa có thẻ chung. Tạo thẻ hoặc nhập từ Zalo để bắt đầu.</p>
        )}
        <button className={styles.tagLink} onClick={manage}>
          Quản lý thẻ
        </button>
      </div>
      <footer className={styles.inboxCreateFooter}>
        <button onClick={onClose}>Đóng</button>
      </footer>
    </TeamDialog>
  );
}
export function TagFilter({
  value,
  onChange,
  mode,
  onModeChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  mode: 'any' | 'all';
  onModeChange: (v: 'any' | 'all') => void;
}) {
  const { data, manage, error, refresh } = useSharedTags(),
    [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (
        !root.current?.contains(e.target as Node) &&
        !(e.target as Element).closest('[data-team-select-menu]')
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className={styles.tagFilter} ref={root}>
      <button
        className={styles.tagFilterTrigger}
        data-active={open || value.length > 0}
        aria-label="Phân loại hội thoại"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>Phân loại</span>
        {value.length > 0 && <span className={styles.tagFilterCount}>{value.length}</span>}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div
          className={styles.tagFilterMenu}
          role="dialog"
          aria-label="Lọc theo thẻ phân loại"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <strong>Theo thẻ phân loại</strong>
          {error ? (
            <button onClick={refresh}>Chưa tải được thẻ · Tải lại</button>
          ) : !data ? (
            <p>Đang tải thẻ…</p>
          ) : (
            <>
              {[
                { id: '__none', name: 'Chưa gắn thẻ', color: '#98a2b3' },
                ...data.tags.filter((t) => !t.archived),
              ].map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    checked={value.includes(t.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked ? [...value, t.id] : value.filter((id) => id !== t.id),
                      )
                    }
                  />
                  <TagMarker color={t.color} />
                  {t.name}
                </label>
              ))}
              <TeamSelect
                aria-label="Điều kiện lọc thẻ"
                value={mode}
                onChange={(e) => onModeChange(e.target.value as 'any' | 'all')}
              >
                <option value="any">Có bất kỳ thẻ đã chọn</option>
                <option value="all">Có đủ tất cả thẻ đã chọn</option>
              </TeamSelect>
              <button onClick={() => onChange([])}>Bỏ lọc</button>
            </>
          )}
          <button
            onClick={() => {
              setOpen(false);
              manage();
            }}
          >
            Quản lý thẻ
          </button>
        </div>
      )}
    </div>
  );
}
export function matchesTags(
  data: TagData | null,
  source: string,
  selected: string[],
  mode: 'any' | 'all' = 'any',
) {
  if (!selected.length) return true;
  if (!data) return false;
  const ids = data.assignments[source] || [];
  return mode === 'all'
    ? selected.every((id) => (id === '__none' ? !ids.length : ids.includes(id)))
    : selected.some((id) => (id === '__none' ? !ids.length : ids.includes(id)));
}
function TagManager({ onClose }: { onClose: () => void }) {
  const { data, busy, error, refresh, act } = useSharedTags();
  const [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [edit, setEdit] = useState<{
      id?: string;
      name: string;
      color: string;
      revision: number;
    } | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [target, setTarget] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null),
    [mapping, setMapping] = useState<Mapping[]>([]),
    [loading, setLoading] = useState(false),
    [localError, setLocalError] = useState(''),
    [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<{ text: string; action: Record<string, unknown> } | null>(
    null,
  );
  const manage = !!data?.canManage;
  async function loadPreview() {
    setLoading(true);
    setLocalError('');
    try {
      const p: Preview = await request({ kind: 'preview' });
      setPreview(p);
      setMapping(
        p.labels.map((l) => ({
          key: l.key,
          targetId:
            l.targetId ||
            data?.tags.find(
              (t) =>
                !t.archived &&
                t.name.trim().toLocaleLowerCase('vi') === l.name.trim().toLocaleLowerCase('vi'),
            )?.id ||
            null,
          name: l.name,
          color: /^#[a-f0-9]{6}$/i.test(l.color) ? l.color : '#0068ff',
          skip: false,
        })),
      );
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function run(v: Record<string, unknown>) {
    if (await act(v)) {
      setEdit(null);
      setConfirm(null);
      setSelected([]);
      setTarget('');
      if (v.kind === 'import') {
        setPreview(null);
        setNotice('Đã nhập thẻ. Xem kết quả trong lịch sử bên dưới.');
      }
      return true;
    }
    return false;
  }
  const tags = (data?.tags || []).filter(
    (t) =>
      t.archived === archived &&
      t.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
  );
  return (
    <TeamDialog
      title={preview ? 'Đối chiếu thẻ cũ từ Zalo' : 'Quản lý thẻ chung'}
      onClose={() => !busy && !loading && onClose()}
      className={styles.tagManager}
    >
      <div className={styles.tagBody}>
        <TagNotice />
        {localError && <p role="alert">{localError}</p>}
        {notice && <p role="status">{notice}</p>}
        {data?.unavailable.length ? (
          <p className={styles.tagNotice}>
            Chưa đọc được: {data.unavailable.join(', ')}. Số hội thoại chỉ tính dữ liệu đang truy
            cập được.
          </p>
        ) : null}
        {preview ? (
          <>
            <p>
              Chọn thẻ chung cho từng thẻ nguồn. Các dòng cùng tên đích sẽ dùng chung một thẻ. Có
              thể sửa tên để giữ riêng ý nghĩa, ví dụ “Gia đình Duy”. Dữ liệu Zalo gốc giữ nguyên.
            </p>
            <p className={styles.tagHint}>
              Bản xem trước có hiệu lực 30 phút. Hội thoại ẩn chưa được nhập; mục chưa nhận diện sẽ
              được giữ trong bản ghi nguồn để đối chiếu.
            </p>
            <div className={styles.tagTableScroll}>
              <table className={styles.tagTable}>
                <thead>
                  <tr>
                    <th>Thẻ nguồn / tài khoản</th>
                    <th>Đã gắn</th>
                    <th>Thẻ chung</th>
                    <th>Màu</th>
                    <th>Bỏ qua</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.labels.map((l, i) => (
                    <tr key={l.key}>
                      <td>
                        <strong>{l.name}</strong>
                        <small>{l.accountName}</small>
                      </td>
                      <td>
                        {l.count}
                        {l.pending > 0 && <small>{l.pending} chờ nhận diện</small>}
                      </td>
                      <td>
                        <TeamSelect
                          aria-label={`Thẻ đích ${l.accountName} ${l.name}`}
                          value={mapping[i].targetId || ''}
                          onChange={(e) =>
                            setMapping((m) =>
                              m.map((x, j) =>
                                i === j ? { ...x, targetId: e.target.value || null } : x,
                              ),
                            )
                          }
                        >
                          <option value="">Tạo / gộp theo tên bên dưới</option>
                          {data?.tags
                            .filter((t) => !t.archived)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </TeamSelect>
                        {!mapping[i].targetId && (
                          <input
                            aria-label={`Tên thẻ chung ${l.accountName} ${l.name}`}
                            maxLength={80}
                            value={mapping[i].name}
                            onChange={(e) =>
                              setMapping((m) =>
                                m.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)),
                              )
                            }
                          />
                        )}
                      </td>
                      <td>
                        <input
                          type="color"
                          aria-label={`Màu ${l.accountName} ${l.name}`}
                          disabled={!!mapping[i].targetId}
                          value={mapping[i].color}
                          onChange={(e) =>
                            setMapping((m) =>
                              m.map((x, j) => (i === j ? { ...x, color: e.target.value } : x)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Bỏ qua ${l.accountName} ${l.name}`}
                          checked={mapping[i].skip}
                          onChange={(e) =>
                            setMapping((m) =>
                              m.map((x, j) => (i === j ? { ...x, skip: e.target.checked } : x)),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <strong>{mapping.filter((m) => !m.skip).length} thẻ nguồn</strong> được chọn ·{' '}
              {preview.labels.reduce((n, l, i) => n + (mapping[i].skip ? 0 : l.count), 0)} lượt gắn
              trước khi loại trùng.
            </p>
            <footer className={styles.inboxCreateFooter}>
              <button disabled={busy} onClick={() => setPreview(null)}>
                Quay lại
              </button>
              <button
                className={styles.inboxCreatePrimary}
                disabled={
                  busy || !!error || mapping.some((m) => !m.skip && !m.targetId && !m.name.trim())
                }
                onClick={() => void run({ kind: 'import', batchId: preview.id, mapping })}
              >
                {busy ? 'Đang nhập…' : 'Nhập thẻ đã đối chiếu'}
              </button>
            </footer>
          </>
        ) : (
          <>
            <p className={styles.tagHint}>
              Dùng chung giữa các tài khoản Zalo. Số hội thoại đã loại trùng nhóm liên kết và chỉ
              tính hội thoại bạn truy cập được.
            </p>
            <div className={styles.tagToolbar}>
              <input
                className={styles.tagInput}
                placeholder="Tìm thẻ chung"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button onClick={() => setArchived(!archived)}>
                {archived ? 'Đang sử dụng' : 'Đã lưu trữ'}
              </button>
              <button disabled={busy || loading} onClick={refresh}>
                Tải lại
              </button>
              {manage && (
                <>
                  <button
                    disabled={busy || loading}
                    onClick={() =>
                      setEdit({ name: '', color: '#0068ff', revision: data!.revision })
                    }
                  >
                    + Tạo thẻ
                  </button>
                  <button disabled={busy || loading} onClick={() => void loadPreview()}>
                    {loading ? 'Đang đọc nguồn…' : 'Nhập thẻ từ Zalo'}
                  </button>
                </>
              )}
            </div>
            {edit && (
              <form
                className={styles.tagEditor}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run({ kind: edit.id ? 'update' : 'create', ...edit });
                }}
              >
                <input
                  aria-label="Tên thẻ"
                  required
                  maxLength={80}
                  placeholder="Tên thẻ"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
                <input
                  aria-label="Màu thẻ"
                  type="color"
                  value={edit.color}
                  onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                />
                {edit.revision !== data?.revision && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest = data?.tags.find((t) => t.id === edit.id);
                      setEdit({
                        ...edit,
                        ...(latest ? { name: latest.name, color: latest.color } : {}),
                        revision: data!.revision,
                      });
                    }}
                  >
                    Danh mục đã đổi · Nạp bản mới
                  </button>
                )}
                <button
                  disabled={busy || !!error || edit.revision !== data?.revision}
                  className={styles.inboxCreatePrimary}
                >
                  Lưu
                </button>
                <button type="button" onClick={() => setEdit(null)}>
                  Hủy
                </button>
              </form>
            )}
            {selected.length > 0 && (
              <div className={styles.tagEditor}>
                <strong>{selected.length} thẻ nguồn</strong>
                <TeamSelect
                  aria-label="Thẻ đích khi gộp"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Chọn thẻ đích</option>
                  {data?.tags
                    .filter((t) => !t.archived && !selected.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </TeamSelect>
                <button
                  disabled={!target || busy}
                  onClick={() =>
                    setConfirm({
                      text: 'Chuyển các hội thoại của thẻ đã chọn sang thẻ đích và lưu trữ thẻ nguồn trong toàn workspace.',
                      action: { kind: 'merge', ids: selected, targetId: target },
                    })
                  }
                >
                  Gộp thẻ
                </button>
                <button onClick={() => setSelected([])}>Bỏ chọn</button>
              </div>
            )}
            <div className={styles.tagTableScroll}>
              <table className={`${styles.tagTable} ${styles.tagCatalogTable}`}>
                <thead>
                  <tr>
                    {manage && <th />}
                    <th>Tên thẻ</th>
                    <th>Hội thoại</th>
                    {manage && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t) => (
                    <tr key={t.id}>
                      {manage && (
                        <td>
                          <input
                            aria-label={`Chọn ${t.name} để gộp`}
                            type="checkbox"
                            checked={selected.includes(t.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, t.id]
                                  : selected.filter((id) => id !== t.id),
                              )
                            }
                          />
                        </td>
                      )}
                      <td>
                        <span className={styles.tagChip}>
                          <TagMarker color={t.color} />
                          <span>{t.name}</span>
                        </span>
                      </td>
                      <td>
                        <span className={styles.tagCount}>{t.count}</span>
                      </td>
                      {manage && (
                        <td>
                          <div className={styles.tagActions}>
                            <button
                              aria-label={`Sửa thẻ ${t.name}`}
                              title="Sửa thẻ"
                              disabled={busy}
                              onClick={() => setEdit({ ...t, revision: data!.revision })}
                            >
                              <Icon name="edit" size={18} />
                            </button>
                            {!t.archived && (
                              <>
                                <button
                                  title="Đưa lên"
                                  aria-label={`Đưa ${t.name} lên`}
                                  disabled={busy || data?.tags[0]?.id === t.id}
                                  onClick={() => {
                                    const ids = data!.tags.map((x) => x.id),
                                      i = ids.indexOf(t.id);
                                    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                                    void run({ kind: 'reorder', ids });
                                  }}
                                >
                                  <Icon name="chevronUp" size={16} />
                                </button>
                                <button
                                  title="Đưa xuống"
                                  aria-label={`Đưa ${t.name} xuống`}
                                  disabled={busy || data?.tags.at(-1)?.id === t.id}
                                  onClick={() => {
                                    const ids = data!.tags.map((x) => x.id),
                                      i = ids.indexOf(t.id);
                                    [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                                    void run({ kind: 'reorder', ids });
                                  }}
                                >
                                  <Icon name="chevronDown" size={16} />
                                </button>
                              </>
                            )}
                            <button
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  text: t.archived
                                    ? `Khôi phục thẻ “${t.name}” và các lượt gắn còn giữ?`
                                    : `Lưu trữ “${t.name}”? Thẻ sẽ ẩn khỏi bộ lọc nhưng các lượt gắn vẫn được giữ để khôi phục.`,
                                  action: { kind: 'archive', id: t.id, archived: !t.archived },
                                })
                              }
                            >
                              {t.archived ? 'Khôi phục' : 'Lưu trữ'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tags.length && (
                <p className={styles.tagEmpty}>
                  {data
                    ? 'Chưa có thẻ. Tạo thẻ mới hoặc nhập các thẻ đã gắn từ Zalo.'
                    : 'Đang tải thẻ…'}
                </p>
              )}
            </div>
            {!!data?.batches.length && (
              <details className={styles.tagHistory}>
                <summary>Lịch sử nhập thẻ ({data.batches.length})</summary>
                {data.batches.map((b) => (
                  <div key={b.id}>
                    <span>
                      {new Date(b.createdAt).toLocaleString('vi-VN')} · Thêm {b.result.added}, giữ
                      nguyên {b.result.preserved}, chờ {b.result.pending}
                    </span>
                    <button
                      disabled={busy || b.rolledBack}
                      onClick={() =>
                        setConfirm({
                          text: 'Hoàn tác các lượt gắn còn nguyên từ lần nhập này. Các sửa đổi thủ công sau đó và danh mục thẻ sẽ được giữ lại.',
                          action: { kind: 'rollback', batchId: b.id },
                        })
                      }
                    >
                      {b.rolledBack ? 'Đã hoàn tác' : 'Hoàn tác'}
                    </button>
                  </div>
                ))}
              </details>
            )}
            {!manage && (
              <p className={styles.tagHint}>Quản trị viên quản lý danh mục và nhập thẻ cũ.</p>
            )}
          </>
        )}
      </div>
      {confirm && (
        <TeamDialog title="Xác nhận thay đổi thẻ" onClose={() => !busy && setConfirm(null)}>
          <div className={styles.tagBody}>
            <p>{confirm.text}</p>
            <TagNotice />
          </div>
          <footer className={styles.inboxCreateFooter}>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Hủy
            </button>
            <button
              className={styles.inboxCreatePrimary}
              disabled={busy || !!error}
              onClick={() => void run(confirm.action)}
            >
              Xác nhận
            </button>
          </footer>
        </TeamDialog>
      )}
    </TeamDialog>
  );
}
