'use client';

import { CursorPaginationBar } from '@/components/table/cursor-pagination-bar';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ZaloTeamShell } from './workspace-shell';
import { TeamManagementLayout } from './management-layout';
import { TeamSelect } from './team-select';
import { Icon } from './icon';
import { workspaceRequest, workUrl, workStates, type WorkTask, type WorkState } from '../workspace';
import { formatTime, WorkStatus, WorkPerson, WorkMenu, WorkEmpty } from './work-ui';
import { WorkTaskDialog } from './lazy-work-task-dialog';
import styles from './work-collaboration.module.css';
import zalo from '../zalo-team.module.css';

type Row = WorkTask & {
  accountId: number;
  conversationId: string;
  conversationName: string;
  accountName: string;
  state: WorkState;
  updatedAt: string;
  canEdit?: boolean;
};
type Board = {
  remindersReady: boolean;
  canManage: boolean;
  counts: {
    openTasks: number;
    overdue: number;
    needsAction: number;
    waitingCustomer: number;
    unassigned: number;
  };
  items: Row[];
  hasMore: boolean;
  workload: { id: number; name: string; total: number }[];
};
export function WorkBoard() {
  const [scope, setScope] = useState('mine'),
    [view, setView] = useState('tasks'),
    [filter, setFilter] = useState('open'),
    [state, setState] = useState(''),
    [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Row | null>(null);
  const [person, setPerson] = useState('');
  const query = useQuery<Board>({
    queryKey: ['workspace', 'board', scope, view, filter, state, person, page],
    queryFn: ({ signal }) =>
      workspaceRequest(
        {
          kind: 'board',
          scope,
          view,
          taskFilter: filter,
          workState: state || null,
          personId: person && person !== 'unassigned' ? Number(person) : null,
          unassigned: person === 'unassigned',
          page,
        },
        signal,
      ),
    staleTime: 15000,
    retry: false,
  });
  const data = query.data;
  const [manager, setManager] = useState(false);
  useEffect(() => {
    if (data) setManager(data.canManage);
  }, [data?.canManage]);
  const changeView = (next: string, value: string) => {
    setView(next);
    setPerson('');
    if (next === 'tasks') setFilter(value);
    else setState(value);
    setPage(0);
  };
  return (
    <ZaloTeamShell activePage="work" label="Công việc Zalo Team">
      <TeamManagementLayout
        title="Công việc"
        navigationLabel="Điều hướng công việc"
        navigation={
          <>
            <button
              className={zalo.directoryTab}
              aria-pressed={scope === 'mine'}
              onClick={() => {
                setScope('mine');
                setPerson('');
                setState('');
                setFilter('open');
                setView('tasks');
                setPage(0);
              }}
            >
              <Icon name="documents" size={22} />
              Việc của tôi
            </button>
            {manager && (
              <button
                className={zalo.directoryTab}
                aria-pressed={scope === 'team'}
                onClick={() => {
                  setScope('team');
                  setPerson('');
                  setState('');
                  setFilter('open');
                  setView('tasks');
                  setPage(0);
                }}
              >
                <Icon name="group" size={22} />
                Điều hành đội
              </button>
            )}
          </>
        }
      >
        <section className={styles.board}>
          <header className={styles.header}>
            <h1>
              <Icon name={scope === 'team' ? 'group' : 'documents'} size={22} />
              {scope === 'team' ? 'Điều hành đội' : 'Việc của tôi'}
            </h1>
            <button disabled={query.isFetching} onClick={() => void query.refetch()}>
              Tải lại
            </button>
          </header>
          <div className={styles.body}>
            {query.isError && (
              <p className={styles.error} role="alert">
                {query.error.message} <button onClick={() => void query.refetch()}>Thử lại</button>
              </p>
            )}
            {query.isPending && <p role="status">Đang tải công việc…</p>}
            {data && !query.isError && (
              <>
                <div className={styles.metrics}>
                  <button
                    aria-pressed={view === 'tasks' && filter === 'open' && !person}
                    onClick={() => changeView('tasks', 'open')}
                  >
                    <span>Việc đang mở</span>
                    <strong>{data.counts.openTasks}</strong>
                  </button>
                  <button
                    aria-pressed={view === 'tasks' && filter === 'overdue' && !person}
                    onClick={() => changeView('tasks', 'overdue')}
                  >
                    <span>Quá hạn</span>
                    <strong className={data.counts.overdue ? styles.error : ''}>
                      {data.counts.overdue}
                    </strong>
                  </button>
                  <button
                    aria-pressed={view === 'conversations' && state === 'needs_action' && !person}
                    onClick={() => changeView('conversations', 'needs_action')}
                  >
                    <span>Hội thoại cần xử lý</span>
                    <strong>{data.counts.needsAction}</strong>
                  </button>
                  <button
                    aria-pressed={
                      view === 'conversations' && state === 'waiting_customer' && !person
                    }
                    onClick={() => changeView('conversations', 'waiting_customer')}
                  >
                    <span>Đang chờ khách</span>
                    <strong>{data.counts.waitingCustomer}</strong>
                  </button>
                </div>
                {scope === 'team' && data.workload.length > 0 && (
                  <details className={styles.workloadDetails}>
                    <summary>
                      Phân bổ công việc <span>{data.workload.length} nhân sự</span>
                    </summary>
                    <div className={styles.workload}>
                      {data.workload.map((p) => (
                        <button
                          key={p.id}
                          aria-pressed={person === String(p.id)}
                          onClick={() => {
                            setPerson(String(p.id));
                            setView('tasks');
                            setFilter('open');
                            setPage(0);
                          }}
                        >
                          <WorkPerson name={p.name} />
                          <strong>{p.total}</strong>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <div className={styles.card}>
                  <div className={styles.filters}>
                    {scope === 'team' && (
                      <button
                        className={styles.unassignedFilter}
                        aria-pressed={person === 'unassigned'}
                        onClick={() => {
                          setView('conversations');
                          setState('');
                          setPerson(person === 'unassigned' ? '' : 'unassigned');
                          setPage(0);
                        }}
                      >
                        Chưa phân công <span>{data.counts.unassigned}</span>
                      </button>
                    )}
                    {person && (
                      <button
                        onClick={() => {
                          setPerson('');
                          setPage(0);
                        }}
                      >
                        Bỏ lọc {person === 'unassigned' ? 'chưa phân công' : 'nhân sự'}
                      </button>
                    )}
                    <div className={styles.viewTabs} aria-label="Loại danh sách công việc">
                      <button
                        aria-pressed={view === 'tasks'}
                        onClick={() => changeView('tasks', 'open')}
                      >
                        Công việc
                      </button>
                      <button
                        aria-pressed={view === 'conversations'}
                        onClick={() => changeView('conversations', '')}
                      >
                        Hội thoại
                      </button>
                    </div>
                    {view === 'tasks' ? (
                      <TeamSelect
                        aria-label="Lọc tiến độ công việc"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(0);
                        }}
                        options={[
                          { value: 'open', label: 'Đang mở' },
                          { value: 'overdue', label: 'Quá hạn' },
                          { value: 'done', label: 'Hoàn thành / đã hủy' },
                          { value: 'all', label: 'Tất cả công việc' },
                        ]}
                      />
                    ) : (
                      <TeamSelect
                        aria-label="Lọc trạng thái hội thoại"
                        value={state}
                        onChange={(e) => {
                          setState(e.target.value);
                          setPage(0);
                        }}
                        options={[
                          { value: '', label: 'Tất cả trạng thái' },
                          ...Object.entries(workStates).map(([value, label]) => ({ value, label })),
                        ]}
                      />
                    )}
                  </div>
                  {!data.items.length ? (
                    <div className={styles.emptyResult}>
                      <WorkEmpty
                        label={
                          view === 'tasks'
                            ? 'Không có công việc phù hợp'
                            : 'Không có hội thoại phù hợp'
                        }
                      />
                      {(person || (view === 'tasks' ? filter !== 'open' : !!state)) && (
                        <button onClick={() => changeView(view, view === 'tasks' ? 'open' : '')}>
                          Bỏ bộ lọc
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{view === 'tasks' ? 'Công việc' : 'Hội thoại'}</th>
                            <th>{view === 'tasks' ? 'Người thực hiện' : 'Người phụ trách'}</th>
                            <th>{view === 'tasks' ? 'Hạn xử lý' : 'Cập nhật gần nhất'}</th>
                            <th>Trạng thái</th>
                            <th>
                              <span className={styles.srOnly}>Thao tác</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((r) => (
                            <tr key={r.id}>
                              <td>
                                {view === 'tasks' && r.canEdit ? (
                                  <button
                                    className={styles.titleButton}
                                    onClick={() => setEditing(r)}
                                  >
                                    {r.title}
                                  </button>
                                ) : (
                                  <Link href={workUrl(r.accountId, r.conversationId)}>
                                    {view === 'tasks' ? r.title : r.conversationName}
                                  </Link>
                                )}
                                <small className={styles.muted}>
                                  {r.accountName}
                                  {view === 'tasks' ? ` · ${r.conversationName}` : ''}
                                </small>
                              </td>
                              <td>
                                <WorkPerson name={r.assignee} />
                              </td>
                              <td className={r.overdue ? styles.error : ''}>
                                {formatTime(view === 'tasks' ? r.dueAt : r.updatedAt)}
                                {r.overdue && <small>Quá hạn</small>}
                              </td>
                              <td>
                                <WorkStatus value={view === 'tasks' ? r.status : r.state} />
                              </td>
                              <td className={styles.rowActions}>
                                <WorkMenu
                                  label={`Thao tác ${view === 'tasks' ? r.title : r.conversationName}`}
                                  items={[
                                    ...(view === 'tasks' && r.canEdit
                                      ? [
                                          {
                                            label: 'Chỉnh sửa công việc',
                                            onClick: () => setEditing(r),
                                          },
                                        ]
                                      : []),
                                    {
                                      label: 'Mở hội thoại',
                                      href: workUrl(
                                        r.accountId,
                                        r.conversationId,
                                        r.sourceMessageId,
                                        r.sourceMessageTime,
                                      ),
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <CursorPaginationBar
                    page={page + 1}
                    hasMore={data.hasMore}
                    disabled={query.isFetching}
                    onPageChange={(value) => setPage(value - 1)}
                  />
                </div>
                {!data.remindersReady && (
                  <p className={styles.error} role="status">
                    Dịch vụ nhắc hạn chưa hoạt động. Công việc vẫn được lưu; nhờ quản trị khởi động
                    dịch vụ nhắc hạn.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </TeamManagementLayout>
      {editing && (
        <WorkTaskDialog
          accountId={editing.accountId}
          conversationId={editing.conversationId}
          task={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </ZaloTeamShell>
  );
}
