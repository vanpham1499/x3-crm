'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { ReportTemplatePicker } from './report-template-picker';
import { insertTemplateText } from '../template-text';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { WeeklyReportCustomerPreviewDialog } from './weekly-report-customer-preview-dialog';
import { Alert, AlertTitle, Button, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { WeeklyReportMoneyInput } from './weekly-report-money-input';
import {
  getWeeklyReportCurrency,
  parseWeeklyReportAmount,
  weeklyReportMoneyDefaults,
  calculateWeeklyBudget,
} from '@/lib/weekly-report-money';
import { PageHeader } from '@/components/shell/page-header';
import { WeeklyReportAttachmentsPanel } from '@/features/weekly-reports/components/weekly-report-attachments-panel';
import { WeeklyReportConversation } from '@/features/weekly-reports/components/weekly-report-conversation';
import { WeeklyCycleNavigator } from '@/features/weekly-reports/components/weekly-cycle-navigator';
import { getApiFieldErrors } from '@/lib/api-error';
import {
  WEEKLY_CONDITION_OPTION_GROUP,
  WEEKLY_REPORT_CURRENCY_OPTION_GROUP,
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
import { formatUserLabel } from '@/lib/user-utils';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type {
  ProjectWeeklySetting,
  WeeklyReport,
  WeeklyReportMessageDraft,
  WeeklyReportCurrency,
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

function getCurrencyOptionCode(option: AppOption): WeeklyReportCurrency {
  return getWeeklyReportCurrency(option.value || option.key);
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
  const [currency, setCurrency] = useState<WeeklyReportCurrency>('VND');
  const [pendingCurrency, setPendingCurrency] = useState<WeeklyReportCurrency | null>(null);
  const [monthlyBudgetSnapshot, setMonthlyBudgetSnapshot] = useState('0.00');
  const initializedMoneyProject = useRef<string | null>(null);
  const moneyEdited = useRef(false);
  const [weeklyCondition, setWeeklyCondition] = useState('');
  const [weeklySpendAmount, setWeeklySpendAmount] = useState('0');
  const [savedAverageWeeklyBudget, setAverageWeeklyBudget] = useState('0');
  const [remainingAccountBudget, setRemainingAccountBudget] = useState('');
  const [totalBudget, setTotalBudget] = useState('0');
  const [summary, setSummary] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [insertionUndo, setInsertionUndo] = useState<{ before: string; after: string } | null>(
    null,
  );
  const summaryCaret = useRef<number | undefined>(undefined);
  const summaryInput = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    setInsertionUndo(null);
    summaryCaret.current = undefined;
    setSuggestionsOpen(false);
  }, [report?.id, projectId]);
  const [draftMessages, setDraftMessages] = useState<WeeklyReportMessageDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [imagesBusy, setImagesBusy] = useState(false);
  const [imageReport, setImageReport] = useState<WeeklyReport | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const imageRequestLock = useRef(false);
  const totalChanged =
    !report ||
    currency !== getWeeklyReportCurrency(report.currency) ||
    parseWeeklyReportAmount(totalBudget) !==
      parseWeeklyReportAmount(report.totalBudget ?? report.monthlyBudget ?? '0');
  const averageWeeklyBudget = totalChanged
    ? calculateWeeklyBudget(totalBudget)
    : savedAverageWeeklyBudget;
  const hasUnsavedChanges = Boolean(
    report &&
    (totalChanged ||
      weeklyCondition.trim() !== (report.weeklyCondition || '').trim() ||
      summary.trim() !== (report.summary || '').trim() ||
      parseWeeklyReportAmount(weeklySpendAmount) !==
        parseWeeklyReportAmount(report.weeklySpendAmount ?? '0') ||
      parseWeeklyReportAmount(remainingAccountBudget) !==
        parseWeeklyReportAmount(report.remainingAccountBudget)),
  );

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
  const { data: currencyOptions = [], isFetching: isCurrencyOptionsLoading } = useQuery<
    AppOption[]
  >({
    queryKey: ['options', WEEKLY_REPORT_CURRENCY_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', {
          params: { groups: WEEKLY_REPORT_CURRENCY_OPTION_GROUP },
        })
        .then((response) => response.data),
  });
  const selectableCurrencyOptions = currencyOptions.filter(
    (option) => option.isActive || getCurrencyOptionCode(option) === currency,
  );
  const hasCurrentCurrencyOption = currencyOptions.some(
    (option) => getCurrencyOptionCode(option) === currency,
  );
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
    if (
      mode !== 'create' ||
      !projectId ||
      !projectSettings ||
      initializedMoneyProject.current === projectId
    )
      return;
    initializedMoneyProject.current = projectId;
    if (moneyEdited.current) return;
    const defaults = weeklyReportMoneyDefaults(currency, selectedSetting?.monthlyBudget);
    setAverageWeeklyBudget(defaults.averageWeeklyBudget);
    setTotalBudget(defaults.totalBudget);
    setMonthlyBudgetSnapshot(defaults.monthlyBudget);
  }, [mode, projectId, projectSettings, currency, selectedSetting?.monthlyBudget]);

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
    setCurrency(getWeeklyReportCurrency(report.currency));
    setMonthlyBudgetSnapshot(String(report.monthlyBudget ?? '0.00'));
    setPendingCurrency(null);
    setWeeklyCondition(report.weeklyCondition || '');
    setWeeklySpendAmount(String(report.weeklySpendAmount ?? '0'));
    setAverageWeeklyBudget(String(report.averageWeeklyBudget ?? '0'));
    setRemainingAccountBudget(String(report.remainingAccountBudget ?? ''));
    setTotalBudget(String(report.totalBudget ?? report.monthlyBudget ?? '0'));
    setSummary(report.summary || '');
    // An attachment/presence refetch must not erase unsaved text or amounts.
  }, [
    report?.id,
    report?.projectId,
    report?.currency,
    report?.monthlyBudget,
    report?.weeklyCondition,
    report?.weeklySpendAmount,
    report?.averageWeeklyBudget,
    report?.remainingAccountBudget,
    report?.totalBudget,
    report?.summary,
    reportDueDate,
  ]);

  const applyCurrency = (next: WeeklyReportCurrency) => {
    moneyEdited.current = true;
    setCurrency(next);
    setWeeklySpendAmount('');
    setAverageWeeklyBudget('');
    setRemainingAccountBudget('');
    setTotalBudget('');
    setMonthlyBudgetSnapshot('0.00');
    setPendingCurrency(null);
    setFieldErrors({});
  };

  useEffect(() => {
    if (mode !== 'create' || isCurrencyOptionsLoading || currencyOptions.length === 0) return;

    const currentOption = currencyOptions.find(
      (option) => getCurrencyOptionCode(option) === currency,
    );
    if (currentOption?.isActive) return;

    const firstActive = currencyOptions.find((option) => option.isActive);
    if (!firstActive) return;

    moneyEdited.current = true;
    setCurrency(getCurrencyOptionCode(firstActive));
    setWeeklySpendAmount('');
    setAverageWeeklyBudget('');
    setRemainingAccountBudget('');
    setTotalBudget('');
    setMonthlyBudgetSnapshot('0.00');
    setPendingCurrency(null);
    setFieldErrors({});
  }, [currency, currencyOptions, isCurrencyOptionsLoading, mode]);

  const submitForm = async () => {
    const normalizedWeeklyCondition = weeklyCondition.trim();

    if (!normalizedWeeklyCondition) {
      setFieldErrors({ weeklyCondition: 'Vui lòng chọn tình trạng tuần.' });
      return;
    }

    const amounts = { weeklySpendAmount, averageWeeklyBudget, remainingAccountBudget, totalBudget };
    const moneyPayload: Record<string, string | null> = {};
    const errors: Record<string, string> = {};
    for (const [field, raw] of Object.entries(amounts)) {
      if (field === 'remainingAccountBudget' && raw.trim() === '') {
        moneyPayload[field] = null;
        continue;
      }
      const amount = parseWeeklyReportAmount(raw);
      if (amount === null)
        errors[field] =
          'Nhập số tiền không âm theo ' +
          currency +
          ', tối đa 2 chữ số thập phân; nhập 0 nếu không phát sinh.';
      else moneyPayload[field] = amount;
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    const payload: Record<string, unknown> = {
      weeklyCondition: normalizedWeeklyCondition,
      currency,
      currencyChangeConfirmed: Boolean(
        report && currency !== getWeeklyReportCurrency(report.currency),
      ),
      monthlyBudget: monthlyBudgetSnapshot,
      ...moneyPayload,
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
      return (await onSubmit(payload)) as WeeklyReport;
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error));
    }
  };

  const takeImage = async () => {
    if (!report || imagesBusy || isSubmitting || imageRequestLock.current) return;
    imageRequestLock.current = true;
    setPreparingImage(true);
    try {
      const saved = !isReadOnly && hasUnsavedChanges ? await submitForm() : report;
      if (saved?.id) setImageReport(saved);
    } finally {
      setPreparingImage(false);
      imageRequestLock.current = false;
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {report && (
              <PrimaryActionButton
                tone="secondary"
                startIcon={<PhotoCameraRoundedIcon />}
                disabled={isSubmitting || imagesBusy || preparingImage}
                onClick={takeImage}
              >
                {preparingImage
                  ? 'Đang chuẩn bị ảnh...'
                  : !isReadOnly && hasUnsavedChanges
                    ? 'Lưu và lấy ảnh'
                    : 'Lấy ảnh'}
              </PrimaryActionButton>
            )}
            {headerActions}
          </div>
        }
      />

      {report?.status === 'rejected' && report.rejectionReason ? (
        <Alert severity="error" className="mb-5 !rounded-xl !border !border-rose-200">
          <AlertTitle className="!font-bold">Báo cáo đã bị từ chối</AlertTitle>
          <p className="whitespace-pre-wrap text-sm leading-6">{report.rejectionReason}</p>
          <p className="mt-1 text-xs font-semibold text-rose-700">
            {report.rejecter ? `Người từ chối: ${formatUserLabel(report.rejecter)}` : null}
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
                required
                disabled={isReadOnly}
                error={Boolean(fieldErrors.weeklyCondition)}
                helperText={fieldErrors.weeklyCondition}
                onChange={(event) => {
                  setWeeklyCondition(event.target.value);
                  if (fieldErrors.weeklyCondition) {
                    setFieldErrors((current) => ({ ...current, weeklyCondition: '' }));
                  }
                }}
              >
                <MenuItem value="" disabled>
                  Chọn tình trạng tuần
                </MenuItem>
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

          <FormSection
            title="3. Đánh giá & phương án triển khai"
            action={
              !isReadOnly ? (
                <Button
                  type="button"
                  className="!shrink-0 !min-h-11"
                  startIcon={<LightbulbOutlinedIcon />}
                  disabled={isSubmitting}
                  onClick={() => setSuggestionsOpen(true)}
                >
                  Gợi ý
                </Button>
              ) : undefined
            }
          >
            <FormInputField
              multiline
              minRows={4}
              label="Ghi chú gửi khách"
              value={summary}
              inputRef={summaryInput}
              onSelect={() => {
                summaryCaret.current = summaryInput.current?.selectionStart;
              }}
              disabled={isReadOnly}
              helperText="Đây là nội dung duy nhất của mục 3 xuất hiện trong bản gửi khách."
              onChange={(event) => {
                setSummary(event.target.value);
                setInsertionUndo(null);
              }}
            />
            {insertionUndo && summary === insertionUndo.after && !isReadOnly && (
              <div
                className="flex items-center justify-between gap-3 text-sm text-slate-500"
                role="status"
              >
                <span>Đã chèn nội dung gợi ý</span>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSummary(insertionUndo.before);
                    setInsertionUndo(null);
                    summaryCaret.current = undefined;
                  }}
                >
                  Hoàn tác
                </Button>
              </div>
            )}

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
              onBusyChange={setImagesBusy}
            />
          ) : (
            <WeeklyReportAttachmentsPanel
              mode="pending"
              title="1. Tổng quan"
              imageUrls={pendingImageUrls || []}
              onImageUrlsChange={onPendingImageUrlsChange || (() => {})}
            />
          )}
          <FormSection title="2. Chi tiêu tuần qua">
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
              <FormSelectField
                label="Đơn vị tiền tệ"
                value={currency}
                disabled={
                  isReadOnly ||
                  isSubmitting ||
                  isCurrencyOptionsLoading ||
                  (mode === 'create' && isProjectSettingsLoading)
                }
                error={Boolean(fieldErrors.currency)}
                helperText={fieldErrors.currency}
                onChange={(event) => {
                  const next = getWeeklyReportCurrency(event.target.value);
                  if (next === currency) return;
                  if (
                    report ||
                    [
                      weeklySpendAmount,
                      averageWeeklyBudget,
                      remainingAccountBudget,
                      totalBudget,
                    ].some((value) => Number(parseWeeklyReportAmount(value)) > 0)
                  )
                    setPendingCurrency(next);
                  else applyCurrency(next);
                }}
              >
                {selectableCurrencyOptions.map((option) => {
                  const code = getCurrencyOptionCode(option);
                  const label = option.label.trim();
                  const displayLabel = label.toUpperCase().startsWith(code)
                    ? label
                    : `${code} — ${label}`;

                  return (
                    <MenuItem key={option.id} value={code} disabled={!option.isActive}>
                      {displayLabel}
                      {!option.isActive ? ' (Tạm tắt)' : ''}
                    </MenuItem>
                  );
                })}
                {currency && !hasCurrentCurrencyOption ? (
                  <MenuItem value={currency}>{currency} (Dữ liệu cũ)</MenuItem>
                ) : null}
                {isCurrencyOptionsLoading ? (
                  <MenuItem disabled>Đang tải đơn vị tiền tệ...</MenuItem>
                ) : selectableCurrencyOptions.length === 0 ? (
                  <MenuItem disabled>Chưa có đơn vị tiền tệ được cấu hình</MenuItem>
                ) : null}
              </FormSelectField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <WeeklyReportMoneyInput
                fullWidth
                size="small"
                label="Chi phí"
                value={weeklySpendAmount}
                currency={currency}
                required
                error={Boolean(fieldErrors.weeklySpendAmount)}
                helperText={fieldErrors.weeklySpendAmount}
                disabled={
                  isReadOnly || isSubmitting || (mode === 'create' && isProjectSettingsLoading)
                }
                onValueChange={(value) => {
                  moneyEdited.current = true;
                  setWeeklySpendAmount(value);
                  setFieldErrors((current) => ({ ...current, weeklySpendAmount: '' }));
                }}
                className={compactFormFieldClassName}
              />
              <WeeklyReportMoneyInput
                fullWidth
                size="small"
                label="Ngân sách trung bình / tuần"
                value={averageWeeklyBudget}
                currency={currency}
                required
                error={Boolean(fieldErrors.averageWeeklyBudget)}
                helperText={
                  fieldErrors.averageWeeklyBudget ||
                  (totalChanged ? 'Tổng ngân sách / 30 × 7' : undefined)
                }
                readOnly
                disabled={
                  isReadOnly || isSubmitting || (mode === 'create' && isProjectSettingsLoading)
                }
                onValueChange={() => {}}
                className={compactFormFieldClassName}
              />
              <WeeklyReportMoneyInput
                fullWidth
                size="small"
                label="Ngân sách tài khoản còn lại"
                value={remainingAccountBudget}
                currency={currency}
                placeholder="Không có số liệu"
                error={Boolean(fieldErrors.remainingAccountBudget)}
                helperText={fieldErrors.remainingAccountBudget}
                disabled={
                  isReadOnly || isSubmitting || (mode === 'create' && isProjectSettingsLoading)
                }
                onValueChange={(value) => {
                  moneyEdited.current = true;
                  setRemainingAccountBudget(value.trim() === '' ? '' : value);
                  setFieldErrors((current) => ({ ...current, remainingAccountBudget: '' }));
                }}
                className={compactFormFieldClassName}
              />
              <WeeklyReportMoneyInput
                fullWidth
                size="small"
                label="Tổng ngân sách"
                value={totalBudget}
                currency={currency}
                required
                error={Boolean(fieldErrors.totalBudget)}
                helperText={fieldErrors.totalBudget}
                disabled={
                  isReadOnly || isSubmitting || (mode === 'create' && isProjectSettingsLoading)
                }
                onValueChange={(value) => {
                  moneyEdited.current = true;
                  setTotalBudget(value);
                  setFieldErrors((current) => ({ ...current, totalBudget: '' }));
                }}
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
      <ConfirmDialog
        open={pendingCurrency !== null}
        title="Đổi đơn vị tiền tệ?"
        description={
          'Các số tiền đang nhập trên form sẽ được xóa để nhập lại theo ' +
          (pendingCurrency || '') +
          '. Không tự chuyển đổi tỷ giá. Số liệu đã lưu chỉ thay đổi khi bạn lưu báo cáo.'
        }
        confirmText="Đổi và nhập lại"
        onClose={() => setPendingCurrency(null)}
        onConfirm={() => {
          if (pendingCurrency) applyCurrency(pendingCurrency);
        }}
      />
      <ReportTemplatePicker
        open={suggestionsOpen && !isReadOnly}
        onClose={() => setSuggestionsOpen(false)}
        serviceId={selectedProject?.serviceId}
        onInsert={(texts) => {
          if (isReadOnly || isSubmitting) return;
          const result = insertTemplateText(summary, texts, summaryCaret.current);
          setInsertionUndo({ before: summary, after: result.text });
          setSummary(result.text);
          summaryCaret.current = result.caret;
        }}
      />
      {imageReport && (
        <WeeklyReportCustomerPreviewDialog
          key={imageReport.id}
          report={imageReport}
          autoCopyImage
          onClose={() => setImageReport(null)}
        />
      )}
    </form>
  );
}
