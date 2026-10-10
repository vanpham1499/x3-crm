'use client';
import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../types';
import {
  type Workspace,
  type WorkNote,
  type WorkTask,
  workspaceRequest,
  workRef,
  workUrl,
} from '../workspace';
import { TeamSelect } from './team-select';
import { WorkTaskDialog } from './lazy-work-task-dialog';
import { WorkStatus, WorkPerson, WorkMenu, WorkEmpty, formatTime } from './work-ui';
import styles from './work-collaboration.module.css';

export function WorkCollaboration({
  conversation,
  data,
  busy,
  change,
}: {
  conversation: Conversation;
  data: Workspace;
  busy: boolean;
  change: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<'tasks' | 'notes'>('tasks');
  const [body, setBody] = useState(''),
    [mentions, setMentions] = useState<number[]>([]);
  const [editing, setEditing] = useState<WorkTask | true | null>(null);
  const [older, setOlder] = useState<WorkNote[]>([]),
    [hasMore, setHasMore] = useState(data.hasMoreNotes);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const olderRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    olderRequest.current?.abort();
    olderRequest.current = null;
    setLoading(false);
    setOlder([]);
    setHasMore(data.hasMoreNotes);
    return () => olderRequest.current?.abort();
  }, [data.revision, data.hasMoreNotes]);
  const notes = [...data.notes, ...older];
  const openTasks = data.tasks.filter((t) => !['done', 'cancelled'].includes(t.status));
  const closedTasks = data.tasks.filter((t) => ['done', 'cancelled'].includes(t.status));
  const renderTask = (t: WorkTask) => {
    const canEdit = data.canEdit || (data.canCollaborate && t.assigneeId === data.userId);
    const update = (status: WorkTask['status']) =>
      void change({
        kind: 'task_status',
        taskId: t.id,
        taskRevision: t.revision,
        taskStatus: status,
      });
    const items = [
      ...(canEdit
        ? [
            { label: 'Chỉnh sửa', onClick: () => setEditing(t) },
            ...(['done', 'cancelled'].includes(t.status)
              ? [{ label: 'Mở lại', onClick: () => update('todo') }]
              : [
                  ...(t.status === 'todo'
                    ? [{ label: 'Bắt đầu làm', onClick: () => update('doing') }]
                    : []),
                  { label: 'Hoàn thành', onClick: () => update('done') },
                  { label: 'Hủy công việc', danger: true, onClick: () => update('cancelled') },
                ]),
          ]
        : []),
      ...(t.sourceMessageId
        ? [
            {
              label: 'Tin nhắn nguồn',
              href: workUrl(
                conversation.accountId,
                conversation.conversationId,
                t.sourceMessageId,
                t.sourceMessageTime,
              ),
            },
          ]
        : []),
    ];
    return (
      <article className={styles.task} key={t.id}>
        <div className={styles.taskHeading}>
          <strong>{t.title}</strong>
          {items.length > 0 && (
            <WorkMenu label={`Thao tác công việc ${t.title}`} disabled={busy} items={items} />
          )}
        </div>
        <WorkPerson name={t.assignee} />
        <div className={styles.row}>
          <WorkStatus value={t.status} />
          <time className={t.overdue ? styles.error : styles.muted}>
            {t.overdue ? 'Quá hạn · ' : ''}
            {formatTime(t.dueAt)}
          </time>
        </div>
        {t.description && (
          <details className={styles.taskDescription}>
            <summary>Chi tiết</summary>
            <p>{t.description}</p>
          </details>
        )}
      </article>
    );
  };
  async function loadOlder() {
    if (olderRequest.current) return;
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const r = await workspaceRequest<{ items: WorkNote[]; hasMore: boolean }>(
        {
          kind: 'notes',
          ...workRef(conversation),
          before: notes.at(-1)?.id || 0,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setOlder((v) => [...v, ...r.items]);
      setHasMore(r.hasMore);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Chưa tải được ghi chú.');
    } finally {
      if (olderRequest.current === controller) {
        olderRequest.current = null;
        setLoading(false);
      }
    }
  }
  return (
    <section className={styles.section} aria-label="Cộng tác nội bộ">
      <div className={styles.tabs}>
        <button aria-pressed={tab === 'tasks'} onClick={() => setTab('tasks')}>
          Công việc <span className={styles.count}>{data.openTaskCount ?? openTasks.length}</span>
        </button>
        <button aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>
          Ghi chú nội bộ
        </button>
      </div>
      {tab === 'notes' ? (
        <>
          {data.canCollaborate && (
            <div className={styles.noteForm}>
              <label>
                <span className={styles.srOnly}>Ghi chú cho đồng nghiệp</span>
                <textarea
                  disabled={busy}
                  rows={3}
                  placeholder="Thông tin bàn giao, lưu ý chăm khách…"
                  value={body}
                  maxLength={4000}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <div className={styles.noteToolbar}>
                <TeamSelect
                  disabled={busy || mentions.length >= 10}
                  aria-label="Nhắc đồng nghiệp"
                  value=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (id && !mentions.includes(id)) setMentions((v) => [...v, id]);
                  }}
                  options={[
                    { value: '', label: '@ Nhắc đồng nghiệp' },
                    ...data.colleagues
                      .filter((p) => !mentions.includes(p.id) && p.id !== data.userId)
                      .map((p) => ({ value: String(p.id), label: p.name })),
                  ]}
                />
                <button
                  className={styles.primary}
                  disabled={busy || !body.trim() || mentions.length > 10}
                  onClick={async () => {
                    if (await change({ kind: 'note', body, mentions })) {
                      setBody('');
                      setMentions([]);
                    }
                  }}
                >
                  {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
                </button>
              </div>
              <div className={styles.chips}>
                {mentions.map((id) => (
                  <button
                    disabled={busy}
                    key={id}
                    onClick={() => setMentions((v) => v.filter((x) => x !== id))}
                    aria-label={`Bỏ nhắc ${data.colleagues.find((p) => p.id === id)?.name}`}
                  >
                    @{data.colleagues.find((p) => p.id === id)?.name} ×
                  </button>
                ))}
              </div>
            </div>
          )}
          {!notes.length && <WorkEmpty label="Chưa có ghi chú" />}
          {notes.map((n) => (
            <article className={styles.note} key={n.id}>
              <div className={styles.noteHeading}>
                <WorkPerson name={n.author} />
                <time>{formatTime(n.at)}</time>
              </div>
              <p>{n.body}</p>
              {n.mentions.length > 0 && (
                <small>{n.mentions.map((m) => '@' + m.name).join(' · ')}</small>
              )}
            </article>
          ))}
          {hasMore && (
            <button disabled={loading} onClick={() => void loadOlder()}>
              {loading ? 'Đang tải…' : 'Ghi chú trước đó'}
            </button>
          )}
        </>
      ) : (
        <>
          <div className={styles.row}>
            <span className={styles.muted}>Đang mở ({data.openTaskCount ?? openTasks.length})</span>
            {data.canEdit && (
              <button className={styles.secondary} disabled={busy} onClick={() => setEditing(true)}>
                + Tạo việc
              </button>
            )}
          </div>
          {!openTasks.length && <WorkEmpty label="Không có việc đang mở" />}
          {openTasks.map(renderTask)}
          {closedTasks.length > 0 && (
            <details className={styles.closedTasks}>
              <summary>Đã kết thúc ({closedTasks.length})</summary>
              <div>{closedTasks.map(renderTask)}</div>
            </details>
          )}
          {data.hasMoreTasks && <a href="/zalo-team/work">Mở bảng công việc</a>}
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {editing && (
        <WorkTaskDialog
          {...workRef(conversation)}
          task={editing === true ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
