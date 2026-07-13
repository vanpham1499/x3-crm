'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, IconButton, MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { MoneyInput } from '@/components/form/money-input';
import { WeeklyReportAttachmentsPanel } from '@/features/weekly-reports/components/weekly-report-attachments-panel';
import { getApiFieldErrors } from '@/lib/api-error';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';
import type {
  ProjectWeeklySetting,
  WeeklyReport,
  WeeklyReportItemFormValue,
} from '@/types/weekly-report';

type WeeklyReportFormProps = {
  mode: 'create' | 'edit';
  report?: WeeklyReport | null;
  projects: ProjectItem[];
  users: User[];
  defaultProjectId?: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
};

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function createItemId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  problem: 'Vấn đề',
  solution: 'Giải pháp',
  action: 'Hành động',
  note: 'Ghi chú',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  done: 'Hoàn thành',
};

function emptyItem(): WeeklyReportItemFormValue {
  return {
    id: createItemId(),
    itemType: 'problem',
    title: '',
    content: '',
    priority: 'medium',
    status: 'open',
    dueDate: '',
    assigneeUserId: '',
  };
}

export function WeeklyReportForm({
  mode,
  report,
  projects,
  users,
  defaultProjectId,
  isSubmitting,
  onSubmit,
  pendingFiles,
  onPendingFilesChange,
}: WeeklyReportFormProps) {
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [weekStartDate, setWeekStartDate] = useState('');
  const [weekEndDate, setWeekEndDate] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [weeklyCondition, setWeeklyCondition] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('0');
  const [managementFeeRate, setManagementFeeRate] = useState('0');
  const [problemSolution, setProblemSolution] = useState('');
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [items, setItems] = useState<WeeklyReportItemFormValue[]>([emptyItem()]);
  const [defaultAssigneeUserId, setDefaultAssigneeUserId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const previousDefaultAssigneeRef = useRef('');

  const selectedProject = projects.find((project) => String(project.id) === projectId) || null;
  const isReadOnly = report?.status === 'approved';

  const { data: projectSettings } = useQuery<ProjectWeeklySetting[]>({
    queryKey: ['project-weekly-settings', 'form', projectId],
    queryFn: () =>
      api
        .get<ProjectWeeklySetting[]>('/project-weekly-settings', { params: { project_id: projectId } })
        .then((response) => response.data),
    enabled: mode === 'create' && Boolean(projectId),
  });

  useEffect(() => {
    if (mode !== 'create') return;

    const setting = projectId ? projectSettings?.[0] : undefined;

    setMonthlyBudget(String(setting?.monthlyBudget ?? '0'));
    setManagementFeeRate(String(setting?.managementFeeRate ?? '0'));
    setDefaultAssigneeUserId(setting?.reportOwnerUserId ? String(setting.reportOwnerUserId) : '');
  }, [mode, projectId, projectSettings]);

  useEffect(() => {
    if (mode !== 'create') return;

    setProjectStatus(selectedProject?.statusOption?.label || '');
  }, [mode, selectedProject]);

  useEffect(() => {
    if (mode !== 'create') return;

    const previousDefault = previousDefaultAssigneeRef.current;
    setItems((current) =>
      current.map((item) =>
        item.assigneeUserId === previousDefault
          ? { ...item, assigneeUserId: defaultAssigneeUserId }
          : item,
      ),
    );
    previousDefaultAssigneeRef.current = defaultAssigneeUserId;
  }, [mode, defaultAssigneeUserId]);

  useEffect(() => {
    if (!report) return;

    setProjectId(idToString(report.projectId));
    setWeekStartDate(report.weekStartDate || '');
    setWeekEndDate(report.weekEndDate || '');
    setProjectStatus(report.projectStatus || '');
    setWeeklyCondition(report.weeklyCondition || '');
    setMonthlyBudget(String(report.monthlyBudget ?? '0'));
    setManagementFeeRate(String(report.managementFeeRate ?? '0'));
    setProblemSolution(report.problemSolution || '');
    setSummary(report.summary || '');
    setNextAction(report.nextAction || '');
    setItems(
      report.items && report.items.length > 0
        ? report.items.map((item) => ({
            id: item.id || createItemId(),
            itemType: item.itemType || 'problem',
            title: item.title || '',
            content: item.content || '',
            priority: item.priority || 'medium',
            status: item.status || 'open',
            dueDate: item.dueDate || '',
            assigneeUserId: idToString(item.assigneeUserId),
          }))
        : [emptyItem()],
    );
  }, [report]);

  const updateItem = (itemId: number, values: Partial<WeeklyReportItemFormValue>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...values } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { ...emptyItem(), assigneeUserId: mode === 'create' ? defaultAssigneeUserId : '' },
    ]);
  };

  const deleteItem = (itemId: number) => {
    setItems((current) => {
      if (current.length === 1) return current;
      return current.filter((item) => item.id !== itemId);
    });
  };

  const submitForm = async () => {
    const payload: Record<string, unknown> = {
      weekStartDate: weekStartDate || null,
      weekEndDate: weekEndDate || null,
      projectStatus: projectStatus.trim() || null,
      weeklyCondition: weeklyCondition.trim() || null,
      monthlyBudget: Number(monthlyBudget) || 0,
      managementFeeRate: Number(managementFeeRate) || 0,
      problemSolution: problemSolution.trim() || null,
      summary: summary.trim() || null,
      nextAction: nextAction.trim() || null,
      items: items
        .filter((item) => item.content.trim())
        .map((item) => ({
          itemType: item.itemType,
          item_type: item.itemType,
          title: item.title.trim() || null,
          content: item.content.trim(),
          priority: item.priority,
          status: item.status,
          dueDate: item.dueDate || null,
          due_date: item.dueDate || null,
          assigneeUserId: item.assigneeUserId ? Number(item.assigneeUserId) : null,
          assignee_user_id: item.assigneeUserId ? Number(item.assigneeUserId) : null,
        })),
    };

    if (mode === 'create') {
      payload.projectId = projectId ? Number(projectId) : null;
      payload.project_id = projectId ? Number(projectId) : null;
    }

    try {
      setFieldErrors({});
      await onSubmit(payload);
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error));
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            {mode === 'edit' ? 'Chỉnh sửa báo cáo tuần' : 'Thêm báo cáo tuần'}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Báo cáo tuần</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">{mode === 'edit' ? 'Chỉnh sửa' : 'Thêm mới'}</span>
          </div>
        </div>

        <Button component={Link} href="/weekly-reports" variant="outlined">
          Quay lại
        </Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Thông tin báo cáo</h2>
          </div>

          <div className="space-y-4 p-6">
            <Autocomplete
              options={projects}
              value={selectedProject}
              disabled={mode === 'edit'}
              onChange={(_, value) => setProjectId(idToString(value?.id))}
              getOptionLabel={(option) =>
                `${option.projectCode || ''} - ${option.projectName || ''}`
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Dự án"
                  error={Boolean(fieldErrors.projectId)}
                  helperText={fieldErrors.projectId}
                />
              )}
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Trạng thái dự án
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {!selectedProject
                  ? 'Chọn dự án trước'
                  : selectedProject.statusOption?.label || 'Dự án chưa có trạng thái'}
              </p>
              {fieldErrors.projectStatus && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {fieldErrors.projectStatus}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                fullWidth
                type="date"
                label="Từ ngày *"
                value={weekStartDate}
                disabled={isReadOnly}
                onChange={(event) => setWeekStartDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(fieldErrors.weekStartDate)}
                helperText={fieldErrors.weekStartDate}
              />
              <TextField
                fullWidth
                type="date"
                label="Đến ngày *"
                value={weekEndDate}
                disabled={isReadOnly}
                onChange={(event) => setWeekEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(fieldErrors.weekEndDate)}
                helperText={fieldErrors.weekEndDate}
              />
            </div>

            <TextField
              select
              fullWidth
              label="Tình trạng tuần"
              value={weeklyCondition}
              disabled={isReadOnly}
              onChange={(event) => setWeeklyCondition(event.target.value)}
            >
              <MenuItem value="">Chưa đánh giá</MenuItem>
              <MenuItem value="Tốt">Tốt</MenuItem>
              <MenuItem value="Cần theo dõi">Cần theo dõi</MenuItem>
              <MenuItem value="Rủi ro">Rủi ro</MenuItem>
            </TextField>

            <div className="grid gap-4 md:grid-cols-2">
              <MoneyInput
                fullWidth
                label="Ngân sách/tháng"
                value={monthlyBudget}
                disabled={isReadOnly}
                onValueChange={setMonthlyBudget}
              />
              <TextField
                fullWidth
                type="number"
                label="% Phí quản lý"
                value={managementFeeRate}
                disabled={isReadOnly}
                onChange={(event) => setManagementFeeRate(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
            </div>

            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Vấn đề - Giải pháp"
              value={problemSolution}
              disabled={isReadOnly}
              onChange={(event) => setProblemSolution(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Tóm tắt"
              value={summary}
              disabled={isReadOnly}
              onChange={(event) => setSummary(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Hành động tiếp theo"
              value={nextAction}
              disabled={isReadOnly}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
        </section>

        <div className="xl:col-span-5">
          {mode === 'edit' && report ? (
            <WeeklyReportAttachmentsPanel
              mode="existing"
              reportId={report.id}
              attachments={report.attachments || []}
            />
          ) : (
            <WeeklyReportAttachmentsPanel
              mode="pending"
              files={pendingFiles || []}
              onFilesChange={onPendingFilesChange || (() => {})}
            />
          )}
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Chi tiết vấn đề / hành động</h2>
            </div>
            {!isReadOnly && (
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={addItem}
                className="!bg-slate-900 hover:!bg-slate-800"
              >
                Thêm dòng
              </Button>
            )}
          </div>

          <div className="space-y-4 p-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid items-start gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[130px_minmax(0,1fr)_120px_140px_38px]"
              >
                <TextField
                  select
                  fullWidth
                  label="Loại"
                  size="small"
                  value={item.itemType}
                  disabled={isReadOnly}
                  onChange={(event) => updateItem(item.id, { itemType: event.target.value })}
                >
                  {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <div className="space-y-2 lg:col-span-1">
                  <TextField
                    fullWidth
                    label="Tiêu đề"
                    size="small"
                    value={item.title}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Nội dung"
                    size="small"
                    value={item.content}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { content: event.target.value })}
                  />
                </div>
                <TextField
                  select
                  fullWidth
                  label="Ưu tiên"
                  size="small"
                  value={item.priority}
                  disabled={isReadOnly}
                  onChange={(event) => updateItem(item.id, { priority: event.target.value })}
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <div className="space-y-2">
                  <TextField
                    select
                    fullWidth
                    label="Trạng thái"
                    size="small"
                    value={item.status}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { status: event.target.value })}
                  >
                    {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    label="Người phụ trách"
                    size="small"
                    value={item.assigneeUserId}
                    disabled={isReadOnly}
                    onChange={(event) =>
                      updateItem(item.id, { assigneeUserId: event.target.value })
                    }
                  >
                    <MenuItem value="">Chưa chọn</MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user.id} value={String(user.id)}>
                        {user.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
                {!isReadOnly && (
                  <IconButton
                    size="small"
                    color="error"
                    disabled={items.length === 1}
                    onClick={() => deleteItem(item.id)}
                    title="Xóa dòng"
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </div>
            ))}

            {!isReadOnly && (
              <div className="flex justify-end">
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  disabled={isSubmitting || (mode === 'create' && !projectId)}
                  onClick={submitForm}
                  className="!bg-slate-900 hover:!bg-slate-800"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu báo cáo'}
                </Button>
              </div>
            )}
          </div>
      </section>
    </div>
  );
}
