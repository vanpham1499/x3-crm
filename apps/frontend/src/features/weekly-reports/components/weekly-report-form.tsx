'use client';

import { useEffect, useState, type ReactNode } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { IconButton, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { PageHeader } from '@/components/shell/page-header';
import { WeeklyReportAttachmentsPanel } from '@/features/weekly-reports/components/weekly-report-attachments-panel';
import { WeeklyCycleNavigator } from '@/features/weekly-reports/components/weekly-cycle-navigator';
import { getApiFieldErrors } from '@/lib/api-error';
import {
  addDaysToDateString,
  getCurrentIsoWeekMondayString,
  getFirstEligibleReportWeekStart,
  getIsoWeekMondayString,
  getIsoWeekdayFromDateString,
  getReportWeekdayLabel,
  getTodayDateString,
  getWeeklyReportCycle,
} from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';
import api from '@/services/api/client';
import type { ProjectItem } from '@/types/project';
import type {
  ProjectWeeklySetting,
  WeeklyReport,
  WeeklyReportItemFormValue,
} from '@/types/weekly-report';

type WeeklyReportFormProps = {
  mode: 'create' | 'edit';
  report?: WeeklyReport | null;
  projects: ProjectItem[];
  defaultProjectId?: string;
  defaultWeekStart?: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  pendingImageUrls?: string[];
  onPendingImageUrlsChange?: (urls: string[]) => void;
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

const ITEM_STATUS_LABELS: Record<string, string> = {
  open: 'Đang mở',
  in_progress: 'Đang xử lý',
  done: 'Hoàn thành',
};

function emptyItem(): WeeklyReportItemFormValue {
  return {
    id: createItemId(),
    itemType: 'problem',
    content: '',
    status: 'open',
  };
}

export function WeeklyReportForm({
  mode,
  report,
  projects,
  defaultProjectId,
  defaultWeekStart,
  isSubmitting,
  onSubmit,
  pendingImageUrls,
  onPendingImageUrlsChange,
  headerActions,
}: WeeklyReportFormProps) {
  const currentWeekStart = getCurrentIsoWeekMondayString();
  const requestedWeekStart = getIsoWeekMondayString(defaultWeekStart || currentWeekStart);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [cycleWeekStart, setCycleWeekStart] = useState(
    requestedWeekStart > currentWeekStart ? currentWeekStart : requestedWeekStart,
  );
  const [weeklyCondition, setWeeklyCondition] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('0');
  const [summary, setSummary] = useState('');
  const [items, setItems] = useState<WeeklyReportItemFormValue[]>([emptyItem()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedProject = projects.find((project) => String(project.id) === projectId) || null;
  const isReadOnly = Boolean(report && report.status !== 'draft');

  const { data: projectSettings, isFetching: isProjectSettingsLoading } = useQuery<
    ProjectWeeklySetting[]
  >({
    queryKey: ['project-weekly-settings', 'form', projectId],
    queryFn: () =>
      api
        .get<ProjectWeeklySetting[]>('/project-weekly-settings', {
          params: { project_id: projectId },
        })
        .then((response) => response.data),
    enabled: mode === 'create' && Boolean(projectId),
  });
  const selectedSetting = projectSettings?.find((setting) => setting.isActive !== false);
  const projectStartDate = selectedProject?.startDate || '';
  const createCycle = projectStartDate
    ? getWeeklyReportCycle(cycleWeekStart, selectedSetting?.reportWeekday, projectStartDate)
    : null;
  const reportDueDate =
    report?.dueDate || (report?.weekEndDate ? addDaysToDateString(report.weekEndDate, 1) : '');
  const displayedCycle = report
    ? {
        weekStart: reportDueDate ? getIsoWeekMondayString(reportDueDate) : '',
        weekEnd: reportDueDate ? addDaysToDateString(getIsoWeekMondayString(reportDueDate), 6) : '',
        dueDate: reportDueDate,
        periodStartDate: report.weekStartDate,
        periodEndDate: report.weekEndDate,
      }
    : createCycle;

  useEffect(() => {
    if (mode !== 'create') return;

    const setting = projectId ? projectSettings?.[0] : undefined;

    setMonthlyBudget(String(setting?.monthlyBudget ?? '0'));
  }, [mode, projectId, projectSettings]);

  useEffect(() => {
    if (mode !== 'create' || !selectedSetting?.reportWeekday || !projectStartDate) return;

    const firstEligibleWeek = getFirstEligibleReportWeekStart(
      cycleWeekStart,
      selectedSetting.reportWeekday,
      projectStartDate,
    );
    const allowedWeek = firstEligibleWeek > currentWeekStart ? currentWeekStart : firstEligibleWeek;

    if (allowedWeek !== cycleWeekStart) {
      setCycleWeekStart(allowedWeek);
    }
  }, [currentWeekStart, cycleWeekStart, mode, projectStartDate, selectedSetting?.reportWeekday]);

  useEffect(() => {
    if (!report) return;

    setProjectId(idToString(report.projectId));
    if (reportDueDate) {
      setCycleWeekStart(getIsoWeekMondayString(reportDueDate));
    }
    setWeeklyCondition(report.weeklyCondition || '');
    setMonthlyBudget(String(report.monthlyBudget ?? '0'));
    setSummary(report.summary || '');
    setItems(
      report.items && report.items.length > 0
        ? report.items.map((item) => ({
            id: item.id || createItemId(),
            itemType: item.itemType || 'problem',
            content: item.title || item.content || '',
            status: item.status || 'open',
          }))
        : [emptyItem()],
    );
  }, [report, reportDueDate]);

  const updateItem = (itemId: number, values: Partial<WeeklyReportItemFormValue>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...values } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => [...current, emptyItem()]);
  };

  const deleteItem = (itemId: number) => {
    setItems((current) => {
      if (current.length === 1) return current;
      return current.filter((item) => item.id !== itemId);
    });
  };

  const submitForm = async () => {
    const payload: Record<string, unknown> = {
      weeklyCondition: weeklyCondition.trim() || null,
      monthlyBudget: Number(monthlyBudget) || 0,
      summary: summary.trim() || null,
      items: items
        .filter((item) => item.content.trim())
        .map((item) => ({
          itemType: item.itemType,
          item_type: item.itemType,
          content: item.content.trim(),
          status: item.status,
        })),
    };

    if (mode === 'create') {
      payload.projectId = projectId ? Number(projectId) : null;
      payload.project_id = projectId ? Number(projectId) : null;
      payload.cycleWeekStart = cycleWeekStart;
      payload.cycle_week_start = cycleWeekStart;
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
        if (
          !isSubmitting &&
          !isReadOnly &&
          (mode === 'edit' || (projectId && selectedSetting && displayedCycle))
        ) {
          submitForm();
        }
      }}
    >
      <PageHeader
        title={
          mode === 'edit'
            ? isReadOnly
              ? 'Chi tiết báo cáo tuần'
              : 'Chỉnh sửa báo cáo tuần'
            : 'Thêm báo cáo tuần'
        }
        currentLabel={mode === 'edit' ? (isReadOnly ? 'Chi tiết' : 'Chỉnh sửa') : undefined}
        actions={headerActions}
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <FormSection title="Thông tin báo cáo">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(150px,0.8fr)_minmax(170px,0.8fr)]">
            <div
              className={`min-h-10 rounded-lg border bg-slate-50 px-3 py-2 ${
                fieldErrors.projectId ? 'border-rose-400' : 'border-slate-200'
              }`}
            >
              <span className="block text-[11px] font-semibold text-slate-500">Dự án</span>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                <strong
                  className="min-w-0 flex-1 truncate text-sm text-slate-900"
                  title={
                    [selectedProject?.projectCode, selectedProject?.projectName]
                      .filter(Boolean)
                      .join(' - ') || undefined
                  }
                >
                  {[selectedProject?.projectCode, selectedProject?.projectName]
                    .filter(Boolean)
                    .join(' - ') || (projectId ? `Dự án #${projectId}` : 'Chưa xác định dự án')}
                </strong>
                <span className="whitespace-nowrap rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">
                  Loại {selectedProject?.projectType || '-'}
                </span>
                <span className="whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  {selectedProject?.statusOption?.label ||
                    report?.projectStatus ||
                    'Chưa có trạng thái'}
                </span>
              </div>
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

            <MoneyInput
              fullWidth
              size="small"
              label="Chi tiêu / tuần"
              value={monthlyBudget}
              disabled={isReadOnly}
              onValueChange={setMonthlyBudget}
              className={compactFormFieldClassName}
            />
          </div>
          {fieldErrors.projectId ? (
            <p role="alert" className="-mt-2 text-xs font-semibold text-rose-600">
              {fieldErrors.projectId}
            </p>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-slate-800">Kỳ báo cáo</span>
              {mode === 'create' &&
              displayedCycle &&
              displayedCycle.dueDate < getTodayDateString() ? (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                  Báo cáo bù
                </span>
              ) : null}
            </div>

            <WeeklyCycleNavigator
              weekStart={displayedCycle?.weekStart || cycleWeekStart}
              disabled={mode === 'edit' || isReadOnly}
              maxWeekStart={currentWeekStart}
              onChange={(weekStart) => {
                const eligibleWeek = getFirstEligibleReportWeekStart(
                  weekStart,
                  selectedSetting?.reportWeekday,
                  projectStartDate,
                );
                setCycleWeekStart(
                  eligibleWeek > currentWeekStart ? currentWeekStart : eligibleWeek,
                );
              }}
            />

            {selectedProject && mode === 'create' && isProjectSettingsLoading ? (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Đang tải lịch báo cáo của dự án...
              </p>
            ) : selectedProject && mode === 'create' && !selectedSetting ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">
                Dự án chưa có lịch báo cáo tuần. Vui lòng cập nhật Sales phụ trách và Thứ báo cáo
                trong dự án trước.
              </p>
            ) : selectedProject && mode === 'create' && !projectStartDate ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">
                Dự án chưa có ngày bắt đầu. Vui lòng cập nhật ngày bắt đầu dự án trước khi tạo báo
                cáo tuần.
              </p>
            ) : selectedProject && mode === 'create' && !displayedCycle ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-amber-700">
                Dự án chưa phát sinh kỳ báo cáo có thể tạo tính đến tuần hiện tại.
              </p>
            ) : displayedCycle ? (
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-slate-500">Hạn báo cáo</span>{' '}
                  <strong className="text-slate-900">
                    {getReportWeekdayLabel(
                      selectedSetting?.reportWeekday ||
                        getIsoWeekdayFromDateString(displayedCycle.dueDate),
                    )}{' '}
                    · {formatDate(displayedCycle.dueDate)}
                  </strong>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-slate-500">Dữ liệu</span>{' '}
                  <strong className="text-slate-900">
                    {formatDate(displayedCycle.periodStartDate)} –{' '}
                    {formatDate(displayedCycle.periodEndDate)}
                  </strong>
                </div>
              </div>
            ) : null}

            {fieldErrors.cycleWeekStart ? (
              <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">
                {fieldErrors.cycleWeekStart}
              </p>
            ) : null}
          </div>

          <FormInputField
            multiline
            minRows={3}
            label="Tóm tắt báo cáo"
            value={summary}
            disabled={isReadOnly}
            onChange={(event) => setSummary(event.target.value)}
          />
        </FormSection>

        <div className="space-y-6">
          {mode === 'edit' && report ? (
            <WeeklyReportAttachmentsPanel
              mode="existing"
              reportId={report.id}
              attachments={report.attachments || []}
              readOnly={isReadOnly}
            />
          ) : (
            <WeeklyReportAttachmentsPanel
              mode="pending"
              imageUrls={pendingImageUrls || []}
              onImageUrlsChange={onPendingImageUrlsChange || (() => {})}
            />
          )}
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
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
                >
                  <div className="grid items-start gap-3 sm:grid-cols-[130px_minmax(0,1fr)_145px_36px]">
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
                      label="Nội dung"
                      value={item.content}
                      disabled={isReadOnly}
                      onChange={(event) => updateItem(item.id, { content: event.target.value })}
                    />
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
                </div>
              ))}
            </div>
          </FormSection>
        </div>
      </div>

      {!isReadOnly && (
        <FormActionBar
          cancelHref="/weekly-reports"
          submitLabel={mode === 'create' ? 'Tạo báo cáo' : 'Lưu thay đổi'}
          isSubmitting={isSubmitting}
          submitDisabled={
            mode === 'create' &&
            (!projectId || !selectedSetting || !displayedCycle || isProjectSettingsLoading)
          }
          submitIcon={<SaveRoundedIcon />}
        />
      )}
    </form>
  );
}
