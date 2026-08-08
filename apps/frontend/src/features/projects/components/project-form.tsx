'use client';

import { useMemo, useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { ExternalLinkAdornment } from '@/components/form/external-link-adornment';
import { FormInputField } from '@/components/form/form-input-field';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { applyApiErrorsToForm } from '@/lib/api-error';
import { projectStatusRequiresWeeklyReport } from '@/lib/option-utils';
import { generateProjectCode, getProjectDefaults, getRootServiceCode } from '@/lib/project-utils';
import { flattenServices } from '@/lib/service-utils';
import { getReportWeekdayLabel, REPORT_WEEKDAYS } from '@/lib/weekly-report-schedule';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ProjectCustomerSummary, ProjectFormValues, ProjectItem } from '@/types/project';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';
import type { WeeklyAssignmentSummary } from '@/types/weekly-report';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  project?: ProjectItem | null;
  initialCustomer?: ProjectCustomerSummary | null;
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  defaultValues?: Partial<ProjectFormValues>;
  cancelHref?: string;
  isSubmitting: boolean;
  /** True when the current user has no edit permission on this record — every field is disabled. */
  readOnly?: boolean;
  onSubmit: (values: ProjectFormValues) => Promise<unknown>;
};

function customerLabel(customer: ProjectCustomerSummary) {
  return [customer.customerCode, customer.customerName || customer.companyName]
    .filter(Boolean)
    .join(' - ');
}

function userLabel(user: User) {
  return [user.code, user.name || user.email].filter(Boolean).join(' - ');
}

function serviceLabel(service: ReturnType<typeof flattenServices>[number]) {
  return `${service.code} - ${service.pathName}`;
}

export function ProjectForm({
  mode,
  project,
  initialCustomer = null,
  services,
  users,
  statuses,
  defaultValues,
  cancelHref = '/projects',
  isSubmitting,
  readOnly = false,
  onSubmit,
}: ProjectFormProps) {
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const [selectedCustomer, setSelectedCustomer] = useState<ProjectCustomerSummary | null>(
    initialCustomer || project?.customer || null,
  );
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: getProjectDefaults(project, defaultValues),
  });
  const selectedServiceId = useWatch({ control, name: 'serviceId' }) || '';
  const projectName = useWatch({ control, name: 'projectName' }) || '';
  const projectType = useWatch({ control, name: 'projectType' }) || 'K';
  const planLinkValue = useWatch({ control, name: 'planLink' }) || '';
  const customerTrackingReportLinkValue =
    useWatch({ control, name: 'customerTrackingReportLink' }) || '';
  const selectedStatusOptionId = useWatch({ control, name: 'statusOptionId' }) || '';
  const selectedManagerUserId = useWatch({ control, name: 'managerUserId' }) || '';
  const weeklyReportWeekday = useWatch({ control, name: 'weeklyReportWeekday' }) || '';
  const reportWeekday = weeklyReportWeekday ? Number(weeklyReportWeekday) : null;
  const selectedStatus = statuses.find((status) => String(status.id) === selectedStatusOptionId);
  const statusAllowsWeeklyReport = projectStatusRequiresWeeklyReport(selectedStatus);
  const selectedManagerUser = users.find((user) => String(user.id) === selectedManagerUserId);
  const {
    data: weeklyAssignmentSummary,
    isFetching: isWeeklyAssignmentLoading,
    isError: isWeeklyAssignmentError,
  } = useQuery<WeeklyAssignmentSummary>({
    queryKey: [
      'project-weekly-settings',
      'assignment-summary',
      selectedManagerUserId,
      reportWeekday,
      project?.id || null,
    ],
    queryFn: () =>
      api
        .get<WeeklyAssignmentSummary>('/project-weekly-settings/assignment-summary', {
          params: {
            report_owner_user_id: selectedManagerUserId,
            report_weekday: reportWeekday,
            exclude_project_id: project?.id || undefined,
          },
        })
        .then((response) => response.data),
    enabled: Boolean(statusAllowsWeeklyReport && selectedManagerUserId && reportWeekday),
  });
  const selectedService = serviceOptions.find(
    (service) => String(service.id) === selectedServiceId,
  );
  const rootServiceCode = useMemo(
    () =>
      getRootServiceCode(services, selectedServiceId) ||
      selectedService?.parent?.code ||
      selectedService?.code ||
      '',
    [selectedService?.code, selectedService?.parent?.code, selectedServiceId, services],
  );
  const selectedCustomerCode = selectedCustomer?.customerCode || '';
  const generatedProjectCode = useMemo(
    () =>
      generateProjectCode({
        customerCode: selectedCustomerCode,
        rootServiceCode,
        projectType,
        projectName,
      }),
    [projectName, projectType, rootServiceCode, selectedCustomerCode],
  );
  const displayedProjectCode = generatedProjectCode || project?.projectCode || '';

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  return (
    <form noValidate className="flex w-full flex-1 flex-col gap-5" onSubmit={submitForm}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection title="Thông tin dự án">
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="customerId"
                control={control}
                rules={{ required: 'Vui lòng chọn khách hàng' }}
                render={({ field }) => (
                  <ServerPaginatedAutocomplete<ProjectCustomerSummary>
                    endpoint="/customers/lookup"
                    queryKey={['customers', 'lookup', 'project-form-autocomplete']}
                    label="Mã khách hàng "
                    value={selectedCustomer}
                    disabled={readOnly}
                    required
                    error={Boolean(errors.customerId)}
                    helperText={errors.customerId?.message}
                    placeholder="Nhập mã, tên, số điện thoại hoặc email"
                    getOptionLabel={customerLabel}
                    onChange={(customer) => {
                      setSelectedCustomer(customer);
                      field.onChange(customer ? String(customer.id) : '');
                    }}
                  />
                )}
              />

              <Controller
                name="serviceId"
                control={control}
                rules={{ required: 'Vui lòng chọn dịch vụ' }}
                render={({ field }) => {
                  const selectedServiceOption =
                    serviceOptions.find((service) => String(service.id) === field.value) || null;

                  return (
                    <Autocomplete
                      options={serviceOptions}
                      value={selectedServiceOption}
                      disabled={readOnly}
                      onChange={(_, nextValue) =>
                        field.onChange(nextValue?.id !== undefined ? String(nextValue.id) : '')
                      }
                      getOptionLabel={serviceLabel}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, state) => {
                        const keyword = state.inputValue.trim().toLowerCase();
                        if (!keyword) return options;

                        return options.filter((service) =>
                          [service.code, service.name, service.pathName]
                            .join(' ')
                            .toLowerCase()
                            .includes(keyword),
                        );
                      }}
                      renderInput={(params) => (
                        <FormInputField
                          {...params}
                          label="Dịch vụ "
                          disabled={readOnly}
                          placeholder="Tìm theo mã hoặc tên dịch vụ"
                          error={Boolean(errors.serviceId)}
                          helperText={errors.serviceId?.message}
                        />
                      )}
                    />
                  );
                }}
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_140px_minmax(0,1.25fr)] gap-2 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1.25fr)] md:gap-3">
              <Controller
                name="projectName"
                control={control}
                rules={{ required: 'Vui lòng nhập tên dự án' }}
                render={({ field }) => (
                  <FormInputField
                    {...field}
                    value={field.value || ''}
                    label="Tên dự án "
                    disabled={readOnly}
                    error={Boolean(errors.projectName)}
                    helperText={errors.projectName?.message}
                  />
                )}
              />
              <Controller
                name="projectType"
                control={control}
                rules={{ required: 'Chọn loại' }}
                render={({ field }) => (
                  <FormSelectField
                    {...field}
                    label="Loại "
                    disabled={readOnly}
                    error={Boolean(errors.projectType)}
                    helperText={errors.projectType?.message}
                  >
                    <MenuItem value="K">K</MenuItem>
                    <MenuItem value="M">M</MenuItem>
                    <MenuItem value="O">Không chọn</MenuItem>
                  </FormSelectField>
                )}
              />
              <Controller
                name="projectCode"
                control={control}
                render={({ field }) => (
                  <FormInputField
                    {...field}
                    value={displayedProjectCode}
                    label="Mã dự án"
                    placeholder="[Mã KH].[DV].[LOẠI].[TÊN DỰ ÁN]"
                    className="[&_.MuiOutlinedInput-root]:!bg-emerald-50/60"
                    slotProps={{
                      htmlInput: { readOnly: true },
                      inputLabel: { shrink: true },
                    }}
                  />
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-8">
                <FormInputField
                  label="Link plan"
                  placeholder="https://docs.google.com/..."
                  disabled={readOnly}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <ExternalLinkAdornment
                          value={planLinkValue}
                          ariaLabel="Mở link plan trong tab mới"
                        />
                      ),
                    },
                  }}
                  {...register('planLink')}
                />
              </div>
              <div className="md:col-span-4">
                <Controller
                  name="monthlyBudget"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      fullWidth
                      size="small"
                      label="Ngân sách/tháng"
                      value={field.value || '0'}
                      disabled={readOnly}
                      onValueChange={field.onChange}
                      className={compactFormFieldClassName}
                    />
                  )}
                />
              </div>
            </div>

            <FormInputField
              label="Link báo cáo tổng hợp"
              placeholder="https://docs.google.com/..."
              disabled={readOnly}
              slotProps={{
                input: {
                  endAdornment: (
                    <ExternalLinkAdornment
                      value={customerTrackingReportLinkValue}
                      ariaLabel="Mở link báo cáo tổng hợp trong tab mới"
                    />
                  ),
                },
              }}
              {...register('customerTrackingReportLink')}
            />

            <div className="grid items-stretch gap-4 md:grid-cols-2">
              <FormInputField
                multiline
                minRows={4}
                maxRows={4}
                label="Tài khoản Admin Web"
                placeholder="Tài khoản hoặc thông tin đăng nhập"
                disabled={readOnly}
                className="h-full [&_.MuiInputBase-root]:h-full"
                {...register('adminWebAccount')}
              />

              <div className="grid h-full gap-4 md:grid-rows-2">
                <Controller
                  name="startDate"
                  control={control}
                  rules={{ required: 'Vui lòng chọn ngày bắt đầu dự án' }}
                  render={({ field }) => (
                    <FormDatePicker
                      label="Ngày bắt đầu "
                      value={field.value}
                      required
                      disabled={readOnly}
                      error={Boolean(errors.startDate)}
                      helperText={errors.startDate?.message}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <FormDatePicker
                      label="Ngày kết thúc"
                      value={field.value}
                      disabled={readOnly}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>

            <FormInputField
              multiline
              minRows={3}
              label="Ghi chú"
              placeholder="Thông tin triển khai, lưu ý chăm sóc, tình trạng hiện tại..."
              disabled={readOnly}
              {...register('note')}
            />
          </FormSection>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <FormSection title="Trạng thái & phụ trách">
            <Controller
              name="statusOptionId"
              control={control}
              rules={{ required: 'Vui lòng chọn trạng thái' }}
              render={({ field }) => (
                <FormSelectField
                  label="Trạng thái "
                  required
                  disabled={readOnly}
                  error={Boolean(errors.statusOptionId)}
                  helperText={errors.statusOptionId?.message}
                  {...field}
                >
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.id} value={String(status.id)}>
                      {status.label}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="managerUserId"
              control={control}
              rules={{ required: 'Vui lòng chọn nhân sự triển khai' }}
              render={({ field }) => (
                <FormSelectField
                  label="Nhân sự triển khai "
                  required
                  disabled={readOnly}
                  error={Boolean(errors.managerUserId)}
                  helperText={errors.managerUserId?.message}
                  {...field}
                >
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {userLabel(user)}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            <Controller
              name="weeklyReportWeekday"
              control={control}
              render={({ field }) => (
                <FormSelectField
                  label="Thứ báo cáo "
                  disabled={readOnly || !statusAllowsWeeklyReport}
                  error={Boolean(errors.weeklyReportWeekday)}
                  helperText={
                    errors.weeklyReportWeekday?.message ||
                    (!statusAllowsWeeklyReport
                      ? `Trạng thái ${selectedStatus?.label || 'hiện tại'} không yêu cầu báo cáo tuần`
                      : !reportWeekday
                        ? 'Chưa chọn: dự án sẽ không cần báo cáo tuần.'
                        : undefined)
                  }
                  {...field}
                >
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {REPORT_WEEKDAYS.map((weekday) => (
                    <MenuItem key={weekday} value={String(weekday)}>
                      {getReportWeekdayLabel(weekday)}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            {statusAllowsWeeklyReport && selectedManagerUserId && reportWeekday ? (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  isWeeklyAssignmentError
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-sky-200 bg-sky-50 text-sky-800'
                }`}
              >
                <InfoOutlinedIcon className="mt-0.5 !text-[18px] shrink-0" />
                <p className="leading-5">
                  {isWeeklyAssignmentLoading ? (
                    'Đang kiểm tra lịch báo cáo...'
                  ) : isWeeklyAssignmentError ? (
                    'Không thể kiểm tra số dự án đã được phân công.'
                  ) : (
                    <>
                      <strong>
                        {selectedManagerUser?.name ||
                          selectedManagerUser?.email ||
                          `Nhân sự #${selectedManagerUserId}`}
                      </strong>{' '}
                      hiện đã được phân công báo cáo{' '}
                      <strong>
                        {weeklyAssignmentSummary?.projectCount || 0}{' '}
                        {mode === 'edit' ? 'dự án khác' : 'dự án'}
                      </strong>{' '}
                      vào <strong>{getReportWeekdayLabel(reportWeekday)}</strong>.
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </FormSection>
        </div>
      </div>

      <FormActionBar
        cancelHref={cancelHref}
        submitLabel={mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
        isSubmitting={isSubmitting}
        submitDisabled={readOnly}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
