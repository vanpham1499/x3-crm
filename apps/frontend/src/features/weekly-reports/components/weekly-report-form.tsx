'use client';

import { useEffect, useState, type ReactNode } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Alert, AlertTitle, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { PageHeader } from '@/components/shell/page-header';
import { WeeklyReportAttachmentsPanel } from '@/features/weekly-reports/components/weekly-report-attachments-panel';
import { WeeklyReportConversation } from '@/features/weekly-reports/components/weekly-report-conversation';
import { WeeklyCycleNavigator } from '@/features/weekly-reports/components/weekly-cycle-navigator';
import { getApiFieldErrors } from '@/lib/api-error';
import {
  WEEKLY_CONDITION_OPTION_GROUP,
  getOptionColor,
  projectStatusRequiresWeeklyReport,
} from '@/lib/option-utils';
import {
  addDaysToDateString,
  getCurrentIsoWeekMondayString,
  getFirstEligibleReportWeekStart,
  getIsoWeekMondayString,
  getIsoWeekdayFromDateString,
  getReportWeekdayLabel,
  getTodayDateString,
  getWeeklyReportCycle,
  isReportWeekday,
} from '@/lib/weekly-report-schedule';
import { formatDate } from '@/lib/utils';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type {
  ProjectWeeklySetting,
  WeeklyReport,
  WeeklyReportMessageDraft,
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
  const [weeklySpendAmount, setWeeklySpendAmount] = useState('0');
  const [averageWeeklyBudget, setAverageWeeklyBudget] = useState('0');
  const [remainingAccountBudget, setRemainingAccountBudget] = useState('0');
  const [totalBudget, setTotalBudget] = useState('0');
  const [summary, setSummary] = useState('');
  const [draftMessages, setDraftMessages] = useState<WeeklyReportMessageDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedProject = projects.find((project) => String(project.id) === projectId) || null;
  const statusAllowsWeeklyReport = projectStatusRequiresWeeklyReport(selectedProject?.statusOption);
  const isReadOnly = Boolean(report && !['draft', 'rejected'].includes(report.status));

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
  const { data: weeklyConditionOptions = [], isFetching: isWeeklyConditionsLoading } = useQuery<
    AppOption[]
  >({
    queryKey: ['options', WEEKLY_CONDITION_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', {
          params: { groups: WEEKLY_CONDITION_OPTION_GROUP },
        })
        .then((response) => response.data),
  });
  const selectableWeeklyConditions = weeklyConditionOptions.filter(
    (option) => option.isActive || option.label === weeklyCondition,
  );
  const hasCurrentWeeklyCondition = weeklyConditionOptions.some(
    (option) => option.label === weeklyCondition,
  );
  const selectedSetting = projectSettings?.find((setting) => setting.isActive !== false);
  const scheduledReportWeekday = isReportWeekday(selectedSetting?.reportWeekday)
    ? selectedSetting.reportWeekday
    : null;
  const requiresWeeklyReport = Boolean(
    statusAllowsWeeklyReport && selectedSetting && scheduledReportWeekday,
  );
  const projectStartDate = selectedProject?.startDate || '';
  const createCycle = projectStartDate
    ? getWeeklyReportCycle(cycleWeekStart, scheduledReportWeekday, projectStartDate)
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
    const monthlyBudget = Number(setting?.monthlyBudget ?? 0);

    setAverageWeeklyBudget(String(monthlyBudget / 4));
    setTotalBudget(String(monthlyBudget));
  }, [mode, projectId, projectSettings]);

  useEffect(() => {
    if (mode !== 'create' || !scheduledReportWeekday || !projectStartDate) return;

    const firstEligibleWeek = getFirstEligibleReportWeekStart(
      cycleWeekStart,
      scheduledReportWeekday,
      projectStartDate,
    );
    const allowedWeek = firstEligibleWeek > currentWeekStart ? currentWeekStart : firstEligibleWeek;

    if (allowedWeek !== cycleWeekStart) {
      setCycleWeekStart(allowedWeek);
    }
  }, [currentWeekStart, cycleWeekStart, mode, projectStartDate, scheduledReportWeekday]);

  useEffect(() => {
    if (!report) return;

    setProjectId(idToString(report.projectId));
    if (reportDueDate) {
      setCycleWeekStart(getIsoWeekMondayString(reportDueDate));
    }
    setWeeklyCondition(report.weeklyCondition || '');
    setWeeklySpendAmount(String(report.weeklySpendAmount ?? '0'));
    setAverageWeeklyBudget(String(report.averageWeeklyBudget ?? '0'));
    setRemainingAccountBudget(String(report.remainingAccountBudget ?? '0'));
    setTotalBudget(String(report.totalBudget ?? report.monthlyBudget ?? '0'));
    setSummary(report.summary || '');
  }, [report, reportDueDate]);

  const submitForm = async () => {
    const payload: Record<string, unknown> = {
      weeklyCondition: weeklyCondition.trim() || null,
      weeklySpendAmount: Number(weeklySpendAmount) || 0,
      averageWeeklyBudget: Number(averageWeeklyBudget) || 0,
      remainingAccountBudget: Number(remainingAccountBudget) || 0,
      totalBudget: Number(totalBudget) || 0,
      summary: summary.trim() || null,
    };

    if (mode === 'create') {
      payload.projectId = projectId ? Number(projectId) : null;
      payload.project_id = projectId ? Number(projectId) : null;
      payload.cycleWeekStart = cycleWeekStart;
      payload.cycle_week_start = cycleWeekStart;
      payload.items = draftMessages.map((message) => ({
        itemType: 'message',
        item_type: 'message',
        content: message.content,
        status: 'open',
      }));
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
      noValidate
      className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !isSubmitting &&
          !isReadOnly &&
          (mode === 'edit' ||
            (requiresWeeklyReport && projectId && selectedSetting && displayedCycle))
        ) {
          submitForm();
        }
      }}
    >
      <PageHeader
        title={selectedProject?.projectName || report?.project?.projectName || 'Báo cáo tuần'}
        currentLabel={mode === 'edit' ? (isReadOnly ? 'Chi tiết' : 'Chỉnh sửa') : undefined}
        eyebrow={
          selectedProject?.projectCode || report?.project?.projectCode ? (
            <span className="inline-flex rounded-md bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
              {selectedProject?.projectCode || report?.project?.projectCode}
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      {report?.status === 'rejected' && report.rejectionReason ? (
        <Alert severity="error" className="mb-5 !rounded-xl !border !border-rose-200">
          <AlertTitle className="!font-bold">Báo cáo đã bị từ chối</AlertTitle>
          <p className="whitespace-pre-wrap text-sm leading-6">{report.rejectionReason}</p>
          <p className="mt-1 text-xs font-semibold text-rose-700">
            {report.rejecter?.name ? `Người từ chối: ${report.rejecter.name}` : null}
          </p>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <FormSection title="Thông tin báo cáo">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(176px,0.5fr)]">
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
                    Loại{' '}
                    {selectedProject?.projectType === 'N' || selectedProject?.projectType === 'O'
                      ? 'Không chọn'
                      : selectedProject?.projectType || '-'}
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
                error={Boolean(fieldErrors.weeklyCondition)}
                helperText={fieldErrors.weeklyCondition}
                onChange={(event) => setWeeklyCondition(event.target.value)}
              >
                <MenuItem value="">Chưa đánh giá</MenuItem>
                {selectableWeeklyConditions.map((option) => (
                  <MenuItem key={option.id} value={option.label} disabled={!option.isActive}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getOptionColor(option) }}
                      />
                      <span className="truncate">
                        {option.label}
                        {!option.isActive ? ' (Tạm tắt)' : ''}
                      </span>
                    </span>
                  </MenuItem>
                ))}
                {weeklyCondition && !hasCurrentWeeklyCondition ? (
                  <MenuItem value={weeklyCondition}>{weeklyCondition} (Dữ liệu cũ)</MenuItem>
                ) : null}
                {isWeeklyConditionsLoading ? (
                  <MenuItem disabled>Đang tải tình trạng...</MenuItem>
                ) : selectableWeeklyConditions.length === 0 ? (
                  <MenuItem disabled>Chưa có tình trạng được cấu hình</MenuItem>
                ) : null}
              </FormSelectField>
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
                    scheduledReportWeekday,
                    projectStartDate,
                  );
                  setCycleWeekStart(
                    eligibleWeek > currentWeekStart ? currentWeekStart : eligibleWeek,
                  );
                }}
              />

              {selectedProject && mode === 'create' && !statusAllowsWeeklyReport ? (
                <p role="status" className="mt-3 text-sm font-semibold text-amber-700">
                  Trạng thái {selectedProject.statusOption?.label || 'hiện tại'} không yêu cầu báo
                  cáo tuần. Không thể tạo báo cáo mới cho dự án này.
                </p>
              ) : selectedProject && mode === 'create' && isProjectSettingsLoading ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Đang tải lịch báo cáo của dự án...
                </p>
              ) : selectedProject && mode === 'create' && !requiresWeeklyReport ? (
                <p role="status" className="mt-3 text-sm font-semibold text-amber-700">
                  Thứ báo cáo của dự án đang là Chưa chọn nên dự án không cần báo cáo tuần. Vui lòng
                  cập nhật Project nếu muốn tạo báo cáo.
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
                        scheduledReportWeekday ||
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
          </FormSection>

          <FormSection title="3. Đánh giá & phương án triển khai">
            <FormInputField
              multiline
              minRows={4}
              label="Ghi chú gửi khách"
              value={summary}
              disabled={isReadOnly}
              helperText="Đây là nội dung duy nhất của mục 3 xuất hiện trong bản gửi khách."
              onChange={(event) => setSummary(event.target.value)}
            />

            <WeeklyReportConversation
              mode={mode}
              report={report}
              draftMessages={draftMessages}
              onDraftMessagesChange={setDraftMessages}
            />
          </FormSection>
        </div>

        <div className="space-y-6 xl:col-span-7">
          {mode === 'edit' && report ? (
            <WeeklyReportAttachmentsPanel
              mode="existing"
              title="1. Tổng quan"
              reportId={report.id}
              attachments={report.attachments || []}
              readOnly={isReadOnly}
            />
          ) : (
            <WeeklyReportAttachmentsPanel
              mode="pending"
              title="1. Tổng quan"
              imageUrls={pendingImageUrls || []}
              onImageUrlsChange={onPendingImageUrlsChange || (() => {})}
            />
          )}
          <FormSection title="2. Chỉ tiêu tuần qua">
            <div className="grid gap-3 md:grid-cols-2">
              <MoneyInput
                fullWidth
                size="small"
                label="Chi phí"
                value={weeklySpendAmount}
                disabled={isReadOnly}
                onValueChange={setWeeklySpendAmount}
                className={compactFormFieldClassName}
              />
              <MoneyInput
                fullWidth
                size="small"
                label="Ngân sách trung bình / tuần"
                value={averageWeeklyBudget}
                disabled={isReadOnly}
                onValueChange={setAverageWeeklyBudget}
                className={compactFormFieldClassName}
              />
              <MoneyInput
                fullWidth
                size="small"
                label="Ngân sách tài khoản còn lại"
                value={remainingAccountBudget}
                disabled={isReadOnly}
                onValueChange={setRemainingAccountBudget}
                className={compactFormFieldClassName}
              />
              <MoneyInput
                fullWidth
                size="small"
                label="Tổng ngân sách"
                value={totalBudget}
                disabled={isReadOnly}
                onValueChange={setTotalBudget}
                className={compactFormFieldClassName}
              />
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
            (!requiresWeeklyReport ||
              !projectId ||
              !selectedSetting ||
              !displayedCycle ||
              isProjectSettingsLoading)
          }
          submitIcon={<SaveRoundedIcon />}
        />
      )}
    </form>
  );
}
