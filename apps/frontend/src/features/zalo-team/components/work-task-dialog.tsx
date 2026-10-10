'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TeamDialog } from './dialog';
import { TeamSelect } from './team-select';
import { TeamDatePicker } from './team-date-picker';
import {
  workspaceRequest,
  publishWorkspace,
  taskStates,
  type Workspace,
  type WorkTask,
} from '../workspace';
import styles from './work-collaboration.module.css';

export function WorkTaskDialog({
  accountId,
  conversationId,
  task,
  source,
  onClose,
}: {
  accountId: number;
  conversationId: string;
  task?: WorkTask;
  source?: { id: string; text: string; time?: number };
  onClose: () => void;
}) {
  const client = useQueryClient();
  const key = ['workspace', 'detail', accountId, conversationId, ...(task ? [task.id] : [])];
  const query = useQuery<Workspace>({
    queryKey: key,
    queryFn: ({ signal }) =>
      workspaceRequest(
        { kind: 'read', accountId, conversationId, ...(task ? { taskId: task.id } : {}) },
        signal,
      ),
    retry: false,
    staleTime: 0,
  });
  const data = query.data;
  const [title, setTitle] = useState(task?.title || source?.text.slice(0, 120) || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task ? String(task.assigneeId) : '');
  const [due, setDue] = useState(task ? vietnamWall(task.dueAt) : '');
  const [validDate, setValidDate] = useState(false);
  const [repeat, setRepeat] = useState(task?.repeat || 'none');
  const [scheduleOpen, setScheduleOpen] = useState(!!task && task.repeat !== 'none');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [project, setProject] = useState(task?.projectId ? String(task.projectId) : '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const initialized = useRef(false);
  const [baseTaskRevision, setBaseTaskRevision] = useState<number | null>(null);
  function loadTask(latest: WorkTask) {
    setBaseTaskRevision(latest.revision);
    setTitle(latest.title);
    setDescription(latest.description || '');
    setAssignee(String(latest.assigneeId));
    setDue(vietnamWall(latest.dueAt));
    setRepeat(latest.repeat);
    setScheduleOpen(latest.repeat !== 'none');
    setStatus(latest.status);
    setProject(latest.projectId ? String(latest.projectId) : '');
    setError('');
  }
  useEffect(() => {
    if (!task || initialized.current || !data?.selectedTask) return;
    initialized.current = true;
    loadTask(data.selectedTask);
  }, [data?.selectedTask, task]);
  const conflict =
    !!task && baseTaskRevision !== null && data?.selectedTask?.revision !== baseTaskRevision;
  const chosen = assignee || String(data?.assignee?.id || data?.userId || '');
  const canEdit =
    data?.canEdit || (data?.selectedTask?.assigneeId === data?.userId && data?.canCollaborate);
  const candidates = data?.taskCandidates || [];
  const validAssignee = candidates.some((p) => String(p.id) === chosen);
  const projects = data?.links.filter((l) => l.kind === 'project') || [];
  const selectedProject = projects.find((p) => String(p.id) === project);
  async function submit() {
    if (!data || busy || conflict || !validAssignee || (task && baseTaskRevision === null)) return;
    setBusy(true);
    setError('');
    try {
      const next = await workspaceRequest<Workspace>({
        kind: task ? 'task_edit' : 'task_create',
        accountId,
        conversationId,
        revision: data.revision,
        ...(task
          ? {
              taskId: task.id,
              taskRevision: baseTaskRevision,
              taskStatus: status,
            }
          : {}),
        title,
        description,
        taskAssigneeId: Number(chosen),
        dueAt: repeat === 'renewal' ? new Date().toISOString() : `${due}:00+07:00`,
        repeat,
        projectId: repeat !== 'none' && project ? Number(project) : null,
        ...(!task && source ? { sourceMessageId: source.id, sourceTime: source.time } : {}),
      });
      publishWorkspace(client, accountId, conversationId, next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được công việc.');
      await query.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamDialog
      title={task ? 'Chỉnh sửa công việc' : 'Tạo công việc'}
      onClose={() => {
        if (!busy) onClose();
      }}
      className={styles.dialog}
    >
      <div className={styles.form}>
        {query.isPending && <p role="status">Đang tải phân công…</p>}
        {query.isError && (
          <p role="alert">
            {query.error.message} <button onClick={() => void query.refetch()}>Thử lại</button>
          </p>
        )}
        {data && !canEdit && (
          <div className={styles.notice}>
            {data.canClaim ? 'Chưa có người phụ trách.' : 'Bạn chưa có quyền sửa công việc này.'}
            {data.canClaim && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const next = await workspaceRequest<Workspace>({
                      kind: 'claim',
                      accountId,
                      conversationId,
                      revision: data.revision,
                    });
                    publishWorkspace(client, accountId, conversationId, next);
                    await query.refetch();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Chưa nhận được việc.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Nhận phụ trách
              </button>
            )}
          </div>
        )}
        <fieldset
          className={styles.formFields}
          disabled={busy || query.isPending || query.isError || !canEdit}
        >
          <label>
            Tên công việc *
            <input
              autoFocus
              placeholder="Tên việc cần xử lý"
              maxLength={240}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className={styles.formRow}>
            <label>
              Người thực hiện *
              <TeamSelect
                disabled={busy || query.isPending || query.isError || !canEdit}
                aria-label="Người thực hiện"
                value={chosen}
                onChange={(e) => setAssignee(e.target.value)}
                options={[
                  ...(!validAssignee && chosen
                    ? [
                        {
                          value: chosen,
                          label: (task?.assignee || 'Người phụ trách') + ' · Không còn phù hợp',
                          disabled: true,
                        },
                      ]
                    : []),
                  ...candidates.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </label>
            {task && (
              <label>
                Trạng thái
                <TeamSelect
                  disabled={busy || query.isPending || query.isError || !canEdit}
                  aria-label="Trạng thái công việc"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkTask['status'])}
                  options={Object.entries(taskStates).map(([value, label]) => ({ value, label }))}
                />
              </label>
            )}
          </div>
          {repeat !== 'renewal' && (
            <TeamDatePicker
              label="Hạn xử lý (giờ Việt Nam) *"
              labelPlacement="above"
              disabled={busy || !canEdit}
              withTime
              value={due}
              onChange={setDue}
              clearable={false}
              onValidityChange={setValidDate}
            />
          )}
          <label>
            Chi tiết
            <textarea
              rows={3}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <details
            className={styles.scheduleDetails}
            open={scheduleOpen}
            onToggle={(e) => setScheduleOpen(e.currentTarget.open)}
          >
            <summary>
              Nhắc theo dự án
              {repeat === 'weekly' ? ' · Hằng tuần' : repeat === 'renewal' ? ' · Gia hạn' : ''}
            </summary>
            <div className={styles.scheduleBody}>
              <label>
                Loại việc
                <TeamSelect
                  disabled={busy || query.isPending || query.isError || !canEdit}
                  aria-label="Loại công việc"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as WorkTask['repeat'])}
                  options={[
                    { value: 'none', label: 'Công việc / nhắc hẹn' },
                    { value: 'weekly', label: 'Báo cáo tuần theo dự án' },
                    { value: 'renewal', label: 'Nhắc gia hạn dự án' },
                  ]}
                />
              </label>
              {repeat !== 'none' && (
                <label>
                  Dự án đã liên kết *
                  <TeamSelect
                    disabled={busy || query.isPending || query.isError || !canEdit}
                    aria-label="Dự án nhắc việc"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    options={[
                      { value: '', label: 'Chọn dự án' },
                      ...projects.map((p) => ({
                        value: String(p.id),
                        label: `${p.code} · ${p.name}`,
                      })),
                    ]}
                  />
                </label>
              )}
              {repeat === 'renewal' && (
                <p className={styles.notice}>
                  {selectedProject?.endDate
                    ? `Hết hạn dự án: ${selectedProject.endDate.split('-').reverse().join('/')} · Nhắc trước 7 ngày, 09:00`
                    : !project
                      ? projects.length
                        ? 'Chọn dự án cần nhắc gia hạn.'
                        : 'Hội thoại chưa liên kết dự án.'
                      : 'Dự án chưa có ngày hết hạn.'}
                </p>
              )}
            </div>
          </details>
        </fieldset>
        {source && (
          <p className={styles.notice}>
            Tin nhắn nguồn: {source.text.slice(0, 100) || 'Tệp đính kèm'}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {conflict && data?.selectedTask && (
          <div className={styles.notice} role="alert">
            Công việc đã được cập nhật ở nơi khác.
            <button disabled={busy} onClick={() => loadTask(data.selectedTask!)}>
              Tải bản mới
            </button>
          </div>
        )}
        <footer>
          <button disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            className={styles.primary}
            disabled={
              busy ||
              query.isError ||
              conflict ||
              (!!task && baseTaskRevision === null) ||
              !canEdit ||
              !title.trim() ||
              !validAssignee ||
              (repeat === 'renewal' && !selectedProject?.endDate) ||
              (repeat !== 'renewal' && (!due || !validDate)) ||
              (repeat !== 'none' && !project)
            }
            onClick={() => void submit()}
          >
            {busy ? 'Đang lưu…' : 'Lưu công việc'}
          </button>
        </footer>
      </div>
    </TeamDialog>
  );
}
function vietnamWall(value: string) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
  return parts.replace(' ', 'T');
}
