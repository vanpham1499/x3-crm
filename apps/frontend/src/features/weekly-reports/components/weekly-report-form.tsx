'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, IconButton, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { PageHeader } from '@/components/shell/page-header';
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
  headerActions?: ReactNode;
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
  headerActions,
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
        .get<ProjectWeeklySetting[]>('/project-weekly-settings', {
          params: { project_id: projectId },
        })
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
    <form
      className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSubmitting && !isReadOnly && (mode === 'edit' || projectId)) submitForm();
      }}
    >
      <PageHeader
        title={mode === 'edit' ? 'Chỉnh sửa báo cáo tuần' : 'Thêm báo cáo tuần'}
        currentLabel={mode === 'edit' ? 'Chỉnh sửa' : undefined}
        actions={headerActions}
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <FormSection title="Thông tin báo cáo">
            <Autocomplete
              options={projects}
              value={selectedProject}
              disabled={mode === 'edit'}
              onChange={(_, value) => setProjectId(idToString(value?.id))}
              getOptionLabel={(option) =>
                option.projectCode || option.projectName || `Dự án #${option.id}`
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Không tìm thấy dự án"
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  required
                  label="Dự án"
                  placeholder="Tìm theo mã dự án"
                  error={Boolean(fieldErrors.projectId)}
                  helperText={fieldErrors.projectId}
                />
              )}
            />

            <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-semibold text-slate-500">Trạng thái dự án</span>
              <span className="truncate text-sm font-bold text-slate-800">
                {!selectedProject
                  ? 'Chưa chọn dự án'
                  : selectedProject.statusOption?.label || 'Chưa có trạng thái'}
              </span>
            </div>
            {fieldErrors.projectStatus && (
              <p className="text-xs font-semibold text-red-600">{fieldErrors.projectStatus}</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormDatePicker
                label="Từ ngày"
                value={weekStartDate}
                required
                disabled={isReadOnly}
                error={Boolean(fieldErrors.weekStartDate)}
                helperText={fieldErrors.weekStartDate}
                onChange={setWeekStartDate}
              />
              <FormDatePicker
                label="Đến ngày"
                value={weekEndDate}
                required
                disabled={isReadOnly}
                error={Boolean(fieldErrors.weekEndDate)}
                helperText={fieldErrors.weekEndDate}
                onChange={setWeekEndDate}
              />
            </div>

            <FormSelectField
              label="Tình trạng tuần"
              value={weeklyCondition}
              disabled={isReadOnly}
              onChange={(event) => setWeeklyCondition(event.target.value)}
            >
              <MenuItem value="">Chưa đánh giá</MenuItem>
              <MenuItem value="Tốt">Tốt</MenuItem>
              <MenuItem value="Cần theo dõi">Cần theo dõi</MenuItem>
              <MenuItem value="Rủi ro">Rủi ro</MenuItem>
            </FormSelectField>

            <div className="grid gap-4 md:grid-cols-2">
              <MoneyInput
                fullWidth
                size="small"
                label="Ngân sách / tháng"
                value={monthlyBudget}
                disabled={isReadOnly}
                onValueChange={setMonthlyBudget}
                className={compactFormFieldClassName}
              />
              <FormInputField
                type="number"
                label="Phí quản lý (%)"
                value={managementFeeRate}
                disabled={isReadOnly}
                onChange={(event) => setManagementFeeRate(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
            </div>

            <FormInputField
              multiline
              minRows={3}
              label="Vấn đề - Giải pháp"
              value={problemSolution}
              disabled={isReadOnly}
              onChange={(event) => setProblemSolution(event.target.value)}
            />
            <FormInputField
              multiline
              minRows={2}
              label="Tóm tắt"
              value={summary}
              disabled={isReadOnly}
              onChange={(event) => setSummary(event.target.value)}
            />
            <FormInputField
              multiline
              minRows={2}
              label="Hành động tiếp theo"
              value={nextAction}
              disabled={isReadOnly}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </FormSection>
        </div>

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

      <div className="mt-6">
        <FormSection
          title="Chi tiết vấn đề / hành động"
          action={
            !isReadOnly ? (
              <TabActionButton startIcon={<AddRoundedIcon />} onClick={addItem}>
                Thêm dòng
              </TabActionButton>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/30 p-4">
                <div className="grid items-start gap-3 lg:grid-cols-[140px_minmax(220px,1fr)_130px_150px_36px]">
                  <FormSelectField
                    label="Loại"
                    value={item.itemType}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { itemType: event.target.value })}
                  >
                    {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                  <FormInputField
                    label="Tiêu đề"
                    value={item.title}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                  />
                  <FormSelectField
                    label="Ưu tiên"
                    value={item.priority}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { priority: event.target.value })}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                  <FormSelectField
                    label="Trạng thái"
                    value={item.status}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { status: event.target.value })}
                  >
                    {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                  {!isReadOnly ? (
                    <IconButton
                      size="small"
                      color="error"
                      disabled={items.length === 1}
                      onClick={() => deleteItem(item.id)}
                      title="Xóa dòng"
                      aria-label="Xóa dòng báo cáo"
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <span />
                  )}
                </div>

                <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
                  <FormInputField
                    multiline
                    minRows={2}
                    label="Nội dung"
                    value={item.content}
                    disabled={isReadOnly}
                    onChange={(event) => updateItem(item.id, { content: event.target.value })}
                  />
                  <FormSelectField
                    label="Người phụ trách"
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
                  </FormSelectField>
                  <FormDatePicker
                    label="Hạn xử lý"
                    value={item.dueDate}
                    disabled={isReadOnly}
                    onChange={(dueDate) => updateItem(item.id, { dueDate })}
                  />
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      </div>

      {!isReadOnly && (
        <FormActionBar
          cancelHref="/weekly-reports"
          submitLabel={mode === 'create' ? 'Tạo báo cáo' : 'Lưu thay đổi'}
          isSubmitting={isSubmitting}
          submitDisabled={mode === 'create' && !projectId}
          submitIcon={<SaveRoundedIcon />}
        />
      )}
    </form>
  );
}
