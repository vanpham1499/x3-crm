'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conversation } from '../types';
import {
  workspaceRequest,
  publishWorkspace,
  workRef,
  workStates,
  type Workspace,
  type CrmLink,
} from '../workspace';
import { TeamSelect } from './team-select';
import { TeamDialog } from './dialog';
import { SearchInput } from './primitives';
import { WorkCollaboration } from './work-collaboration';
import { WorkPerson, WorkMenu, formatTime } from './work-ui';
import styles from './workspace-panel.module.css';

const kinds = { customer: 'Khách hàng', lead: 'Lead', project: 'Dự án' };
const actionLabels: Record<string, string> = {
  claim: 'Nhận phụ trách',
  assign: 'Bàn giao',
  state: 'Đổi trạng thái',
  link: 'Liên kết hồ sơ',
  unlink: 'Gỡ liên kết hồ sơ',
  note: 'Thêm ghi chú nội bộ',
  task_create: 'Tạo công việc',
  task_edit: 'Sửa công việc',
  task_status: 'Cập nhật tiến độ công việc',
};
const date = formatTime;
export function WorkspacePanel({ conversation }: { conversation: Conversation }) {
  const client = useQueryClient();
  const key = ['workspace', 'detail', conversation.accountId, conversation.conversationId];
  const query = useQuery<Workspace>({
    queryKey: key,
    enabled: !!conversation.accountId && !!conversation.conversationId,
    queryFn: ({ signal }) => workspaceRequest({ kind: 'read', ...workRef(conversation) }, signal),
    staleTime: 15000,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [linking, setLinking] = useState(false),
    [assignment, setAssignment] = useState(false);
  const [person, setPerson] = useState('');
  const [removing, setRemoving] = useState<CrmLink | null>(null);
  const data = query.data;
  async function change(body: Record<string, unknown>) {
    if (!data || busy) return false;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const next = await workspaceRequest<Workspace>({
        ...body,
        ...workRef(conversation),
        revision: data.revision,
      });
      publishWorkspace(client, conversation.accountId, conversation.conversationId, next);
      setSaved(
        body.kind === 'note'
          ? 'Đã lưu ghi chú nội bộ.'
          : String(body.kind).startsWith('task_')
            ? 'Đã cập nhật công việc.'
            : body.kind === 'claim'
              ? 'Bạn đã nhận phụ trách hội thoại này.'
              : body.kind === 'state'
                ? `Đã chuyển sang ${workStates[next.state].toLowerCase()}.`
                : body.kind === 'link'
                  ? 'Đã liên kết hồ sơ CRM.'
                  : body.kind === 'unlink'
                    ? 'Đã gỡ liên kết. Hồ sơ CRM vẫn được giữ.'
                    : 'Đã lưu người phụ trách.',
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.');
      // A timeout may have committed. Read back; never replay a write automatically.
      await query.refetch();
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel} aria-label="Khách hàng và công việc">
      <div className={styles.heading}>
        <h3>Theo dõi hội thoại</h3>
        <button
          aria-label="Tải lại hồ sơ hội thoại"
          onClick={() => void query.refetch()}
          disabled={busy || query.isFetching}
        >
          Tải lại
        </button>
      </div>
      {query.isPending && (
        <p className={styles.muted} role="status">
          Đang tải hồ sơ…
        </p>
      )}
      {query.isError && (
        <p className={styles.error} role="alert">
          {query.error.message}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className={styles.success} role="status">
          {saved}
        </p>
      )}
      {data && !query.isError && (
        <>
          <div className={styles.assignmentCard}>
            <div className={styles.field}>
              <span className={styles.muted}>Người phụ trách</span>
              <WorkPerson name={data.assignee?.name} />
              {data.assignmentUnavailable && (
                <span>Người phụ trách trước không còn quyền sử dụng.</span>
              )}
            </div>
            <div className={styles.actions}>
              {data.canClaim && (
                <button
                  className={`${styles.button} ${styles.primary}`}
                  disabled={busy}
                  onClick={() => void change({ kind: 'claim' })}
                >
                  Nhận phụ trách
                </button>
              )}
              {data.canManage && (
                <button
                  className={styles.button}
                  disabled={busy}
                  onClick={() => {
                    setPerson(String(data.assignee?.id || ''));
                    setAssignment(true);
                  }}
                >
                  {data.assignee ? 'Bàn giao' : 'Phân công'}
                </button>
              )}
            </div>
            <label className={styles.field}>
              <span className={styles.stepTitle}>Tiến độ xử lý</span>
              <TeamSelect
                aria-label="Trạng thái xử lý hội thoại"
                value={data.state}
                disabled={busy || !data.canEdit}
                onChange={(e) => void change({ kind: 'state', state: e.target.value })}
                options={Object.entries(workStates).map(([value, label]) => ({ value, label }))}
              />
            </label>
          </div>
          <details className={styles.crmDetails}>
            <summary>
              Hồ sơ CRM <span>{data.links.length}</span>
            </summary>
            <div className={styles.crmBody}>
              <div className={styles.heading}>
                <span className={styles.muted}>Hồ sơ liên kết</span>
                {data.canEdit && (
                  <button disabled={busy} onClick={() => setLinking(true)}>
                    {data.links.length ? 'Thêm hồ sơ' : 'Liên kết hồ sơ'}
                  </button>
                )}
              </div>
              {!data.links.length && !data.restrictedLinks && (
                <p className={styles.muted}>Chưa liên kết hồ sơ.</p>
              )}
              {data.links.map((link) => (
                <article className={styles.link} key={`${link.kind}:${link.id}`}>
                  <div className={styles.heading}>
                    <span className={styles.muted}>{kinds[link.kind]}</span>
                    {data.canEdit && (
                      <WorkMenu
                        label={`Thao tác hồ sơ ${link.code}`}
                        disabled={busy}
                        items={[
                          { label: 'Gỡ liên kết', danger: true, onClick: () => setRemoving(link) },
                        ]}
                      />
                    )}
                  </div>
                  <a
                    href={`/${link.kind === 'customer' ? 'customers' : link.kind === 'lead' ? 'leads' : 'projects'}/${link.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.code} · {link.name}
                  </a>
                  {link.service && <p>Dịch vụ: {link.service}</p>}
                  {link.status && <p>Trạng thái: {link.status}</p>}
                  {link.sales && <p>Sale: {link.sales}</p>}
                  {link.manager && <p>Quản lý: {link.manager}</p>}
                  {link.endDate && <p>Hết hạn: {link.endDate.split('-').reverse().join('/')}</p>}
                </article>
              ))}
              {data.restrictedLinks && (
                <p className={styles.muted}>Một số hồ sơ nằm ngoài quyền xem CRM của bạn.</p>
              )}
              {!data.canEdit && (
                <p className={styles.muted}>Người phụ trách và quản lý được cập nhật công việc.</p>
              )}
            </div>
          </details>
          <WorkCollaboration conversation={conversation} data={data} busy={busy} change={change} />
          <details className={styles.historyDetails}>
            <summary>Lịch sử cập nhật</summary>
            <ol className={styles.history}>
              {data.events.map((event) => (
                <li key={event.id}>
                  {event.actor} · {actionLabels[event.action] || 'Cập nhật'}
                  {event.state ? `: ${workStates[event.state]}` : ''}
                  {event.action === 'assign' || event.action === 'claim'
                    ? ` → ${event.assignee || 'Chưa phân công'}`
                    : ''}
                  <time>{date(event.at)}</time>
                </li>
              ))}
              {!data.events.length && <li>Chưa có cập nhật.</li>}
            </ol>
          </details>
        </>
      )}
      {assignment && data && (
        <TeamDialog
          title="Phân công hội thoại"
          onClose={() => {
            if (!busy) setAssignment(false);
          }}
          className={styles.dialog}
        >
          <div className={styles.dialogBody}>
            <p>{conversation.name}</p>
            <label className={styles.field}>
              <span>Người phụ trách mới</span>
              <TeamSelect
                aria-label="Người phụ trách mới"
                value={person}
                disabled={busy}
                onChange={(e) => setPerson(e.target.value)}
                options={[
                  { value: '', label: 'Chưa phân công' },
                  ...(data.assignee && !data.candidates.some((p) => p.id === data.assignee?.id)
                    ? [
                        {
                          value: String(data.assignee.id),
                          label: `${data.assignee.name} · Hiện tại`,
                          disabled: true,
                        },
                      ]
                    : []),
                  ...data.candidates.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </label>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.button}
                disabled={busy}
                onClick={() => setAssignment(false)}
              >
                Hủy
              </button>
              <button
                className={`${styles.button} ${styles.primary}`}
                disabled={busy || person === String(data.assignee?.id || '')}
                onClick={async () => {
                  if (await change({ kind: 'assign', assigneeId: person ? Number(person) : null }))
                    setAssignment(false);
                }}
              >
                {busy ? 'Đang lưu…' : 'Lưu phân công'}
              </button>
            </div>
          </div>
        </TeamDialog>
      )}
      {linking && (
        <LinkPicker
          conversation={conversation}
          links={data?.links || []}
          busy={busy}
          error={error}
          onClose={() => {
            if (!busy) setLinking(false);
          }}
          onSave={async (link) => {
            if (await change({ kind: 'link', entityKind: link.kind, entityId: link.id }))
              setLinking(false);
          }}
        />
      )}
      {removing && (
        <TeamDialog
          title="Gỡ liên kết hồ sơ"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
          className={styles.dialog}
        >
          <div className={styles.dialogBody}>
            <p>
              Gỡ {removing.code} · {removing.name} khỏi hội thoại này? Hồ sơ CRM vẫn được giữ.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button className={styles.button} disabled={busy} onClick={() => setRemoving(null)}>
                Hủy
              </button>
              <button
                className={styles.button}
                disabled={busy}
                onClick={async () => {
                  if (
                    await change({
                      kind: 'unlink',
                      entityKind: removing.kind,
                      entityId: removing.id,
                    })
                  )
                    setRemoving(null);
                }}
              >
                Gỡ liên kết
              </button>
            </div>
          </div>
        </TeamDialog>
      )}
    </section>
  );
}

function LinkPicker({
  conversation,
  links,
  busy,
  error,
  onClose,
  onSave,
}: {
  conversation: Conversation;
  links: CrmLink[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (link: CrmLink) => Promise<void>;
}) {
  const customer = links.find((l) => l.kind === 'customer');
  const [kind, setKind] = useState<CrmLink['kind']>(customer ? 'project' : 'customer'),
    [search, setSearch] = useState(''),
    [term, setTerm] = useState(''),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<CrmLink | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(0);
      setSelected(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery<{ items: CrmLink[]; hasMore: boolean }>({
    queryKey: ['workspace', 'lookup', conversation.accountId, kind, term, page, customer?.id],
    queryFn: ({ signal }) =>
      workspaceRequest(
        {
          kind: 'lookup',
          accountId: conversation.accountId,
          entityKind: kind,
          search: term,
          page,
          ...(kind === 'project' && customer ? { customerId: customer.id } : {}),
        },
        signal,
      ),
    retry: false,
  });
  return (
    <TeamDialog
      title="Liên kết hồ sơ CRM"
      onClose={onClose}
      className={`${styles.dialog} ${styles.linkDialog}`}
    >
      <div className={`${styles.dialogBody} ${styles.linkBody}`}>
        <div className={styles.linkContext}>
          <span className={styles.muted}>Hội thoại</span>
          <p>{conversation.name}</p>
        </div>
        {customer && kind === 'project' && (
          <p className={styles.muted}>
            Dự án của {customer.code} · {customer.name}
          </p>
        )}
        <TeamSelect
          aria-label="Loại hồ sơ CRM"
          value={kind}
          disabled={busy}
          onChange={(e) => {
            setKind(e.target.value as CrmLink['kind']);
            setPage(0);
            setSelected(null);
          }}
          options={Object.entries(kinds).map(([value, label]) => ({ value, label }))}
        />
        <SearchInput
          label="Tìm hồ sơ theo tên hoặc mã"
          placeholder="Tìm theo tên hoặc mã hồ sơ"
          value={search}
          onValueChange={setSearch}
        />
        {query.isPending && <p role="status">Đang tìm hồ sơ…</p>}
        {query.isError && (
          <p className={styles.error} role="alert">
            {query.error.message} <button onClick={() => void query.refetch()}>Thử lại</button>
          </p>
        )}
        <div
          className={styles.results}
          role="group"
          aria-label="Hồ sơ CRM phù hợp"
          aria-busy={query.isFetching}
        >
          {!query.isError &&
            query.data?.items.map((item) => (
              <button
                key={`${item.kind}:${item.id}`}
                className={styles.result}
                disabled={busy || links.some((l) => l.kind === item.kind && l.id === item.id)}
                aria-pressed={selected?.kind === item.kind && selected?.id === item.id}
                onClick={() => setSelected(item)}
              >
                <span className={styles.resultMarker} aria-hidden="true" />
                <span className={styles.resultContent}>
                  <strong
                    className={styles.resultName}
                    title={item.code ? `${item.code} - ${item.name}` : item.name}
                  >
                    {item.code ? `${item.code} - ${item.name}` : item.name}
                  </strong>
                  <span className={styles.resultMeta}>
                    {item.sales && <span>Sale: {item.sales}</span>}
                    {item.service && <span>{item.service}</span>}
                    {links.some((l) => l.kind === item.kind && l.id === item.id) && (
                      <span>Đã liên kết</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
        </div>
        {!query.isError && query.data && !query.data.items.length && (
          <p className={styles.muted}>Không có hồ sơ phù hợp trong quyền của bạn.</p>
        )}
        <div className={styles.linkPagination}>
          <button
            className={styles.button}
            disabled={busy || page === 0 || query.isFetching}
            onClick={() => {
              setPage((p) => p - 1);
              setSelected(null);
            }}
          >
            Trước
          </button>
          <span className={styles.muted}>Trang {page + 1}</span>
          <button
            className={styles.button}
            disabled={busy || !query.data?.hasMore || query.isFetching}
            onClick={() => {
              setPage((p) => p + 1);
              setSelected(null);
            }}
          >
            Sau
          </button>
        </div>
        {selected && !query.isError && (
          <p className={styles.linkSelection} role="status">
            <span className={styles.muted}>Đã chọn: </span>
            {selected.code ? `${selected.code} - ${selected.name}` : selected.name}
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={`${styles.actions} ${styles.linkFooter}`}>
          <button className={styles.button} disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={
              busy || !selected || query.isError || query.isFetching || search.trim() !== term
            }
            onClick={() => selected && void onSave(selected)}
          >
            {busy ? 'Đang lưu…' : 'Xác nhận liên kết'}
          </button>
        </div>
      </div>
    </TeamDialog>
  );
}
