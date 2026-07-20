'use client';

import { useMemo, useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FormActionBar } from '@/components/form/form-action-bar';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { applyApiErrorsToForm } from '@/lib/api-error';
import {
  generateProjectCode,
  getProjectDefaults,
  getRootServiceCode,
  getRootServiceItem,
} from '@/lib/project-utils';
import {
  getConfigForRoot,
  getProjectRevenueGroupInfo,
  getServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import { formatCurrency } from '@/lib/utils';
import { getReportWeekdayLabel } from '@/lib/weekly-report-schedule';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';
import type { WeeklyAssignmentSummary } from '@/types/weekly-report';

type ProjectFormProps = {
  mode: 'create' | 'edit';
  project?: ProjectItem | null;
  initialCustomer?: CustomerOption | null;
  services: ServiceItem[];
  users: User[];
  statuses: AppOption[];
  quoteConfigs?: AppOption[];
  quotations?: Quotation[];
  defaultValues?: Partial<ProjectFormValues>;
  cancelHref?: string;
  isSubmitting: boolean;
  /** True when the current user has no edit permission on this record — every field is disabled. */
  readOnly?: boolean;
  onSubmit: (values: ProjectFormValues) => Promise<unknown>;
};

type CustomerOption = Pick<
  Customer,
  'id' | 'customerCode' | 'customerName' | 'companyName' | 'phone' | 'email' | 'leadId'
>;

function customerLabel(customer: CustomerOption) {
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

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Báo phí',
  won: 'Đã thanh toán',
};

function quotationLabel(quotation: Quotation) {
  return [
    quotation.quotationCode || `Báo phí #${quotation.id}`,
    quotation.customer?.customerName,
    quotation.serviceName,
    formatCurrency(Number(quotation.totalAmount) || 0),
  ]
    .filter(Boolean)
    .join(' · ');
}

function quotationMetadataText(quotation: Quotation, key: string) {
  const value = quotation.metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function ProjectForm({
  mode,
  project,
  initialCustomer = null,
  services,
  users,
  statuses,
  quoteConfigs = [],
  quotations = [],
  defaultValues,
  cancelHref = '/projects',
  isSubmitting,
  readOnly = false,
  onSubmit,
}: ProjectFormProps) {
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    initialCustomer || project?.customer || null,
  );
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: getProjectDefaults(project, defaultValues),
  });
  const selectedQuotationId = useWatch({ control, name: 'quotationId' }) || '';
  const selectedServiceId = useWatch({ control, name: 'serviceId' }) || '';
  const projectName = useWatch({ control, name: 'projectName' }) || '';
  const projectType = useWatch({ control, name: 'projectType' }) || 'K';
  const selectedSalesUserId = useWatch({ control, name: 'salesUserId' }) || '';
  const weeklyReportWeekday = useWatch({ control, name: 'weeklyReportWeekday' }) || '';
  const reportWeekday = weeklyReportWeekday ? Number(weeklyReportWeekday) : null;
  const selectedSalesUser = users.find((user) => String(user.id) === selectedSalesUserId);
  const {
    data: weeklyAssignmentSummary,
    isFetching: isWeeklyAssignmentLoading,
    isError: isWeeklyAssignmentError,
  } = useQuery<WeeklyAssignmentSummary>({
    queryKey: [
      'project-weekly-settings',
      'assignment-summary',
      selectedSalesUserId,
      reportWeekday,
      project?.id || null,
    ],
    queryFn: () =>
      api
        .get<WeeklyAssignmentSummary>('/project-weekly-settings/assignment-summary', {
          params: {
            report_owner_user_id: selectedSalesUserId,
            report_weekday: reportWeekday,
            exclude_project_id: project?.id || undefined,
          },
        })
        .then((response) => response.data),
    enabled: Boolean(selectedSalesUserId && reportWeekday),
  });
  const selectedQuotation = quotations.find(
    (quotation) => String(quotation.id) === selectedQuotationId,
  );
  const originQuotationOptions = useMemo(
    () => quotations.filter((quotation) => !quotation.projectId),
    [quotations],
  );
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
  const rootService = useMemo(
    () => getRootServiceItem(services, selectedServiceId),
    [selectedServiceId, services],
  );
  const quoteConfigOption = getConfigForRoot(quoteConfigs, rootService);
  const quoteConfig = quoteConfigOption
    ? getServiceQuoteConfigMeta(quoteConfigOption, rootService)
    : null;
  const usesAutomaticQuote = Boolean(quoteConfig?.enabled);
  const revenueGroup = getProjectRevenueGroupInfo(usesAutomaticQuote);
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

  const applyOriginQuotation = (quotation: Quotation | null) => {
    setValue('quotationId', quotation ? String(quotation.id) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!quotation) return;

    setValue('customerId', quotation.customerId ? String(quotation.customerId) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedCustomer(quotation.customer || null);
    setValue('serviceId', quotation.serviceId ? String(quotation.serviceId) : '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue(
      'projectName',
      quotationMetadataText(quotation, 'projectName') || quotation.serviceName || '',
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const submitForm = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      applyApiErrorsToForm(error, setError);
    }
  });

  return (
    <form className="flex w-full flex-1 flex-col gap-5" onSubmit={submitForm}>
      {mode === 'edit' ? <input type="hidden" {...register('quotationId')} /> : null}
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection title="Thông tin dự án">
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="customerId"
                control={control}
                rules={{ required: 'Vui lòng chọn khách hàng' }}
                render={({ field }) => (
                  <ServerPaginatedAutocomplete<CustomerOption>
                    endpoint="/customers"
                    queryKey={['customers', 'project-form-autocomplete']}
                    label="Mã khách hàng *"
                    value={selectedCustomer}
                    disabled={readOnly || Boolean(selectedQuotation)}
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
                      disabled={readOnly || Boolean(selectedQuotation)}
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
                          label="Dịch vụ *"
                          disabled={readOnly || Boolean(selectedQuotation)}
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

            <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1.25fr)] gap-2 md:grid-cols-[minmax(0,1fr)_80px_minmax(0,1.25fr)] md:gap-3">
              <Controller
                name="projectName"
                control={control}
                rules={{ required: 'Vui lòng nhập tên dự án' }}
                render={({ field }) => (
                  <FormInputField
                    {...field}
                    value={field.value || ''}
                    label="Tên dự án *"
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
                    label="Loại *"
                    disabled={readOnly}
                    error={Boolean(errors.projectType)}
                    helperText={errors.projectType?.message}
                  >
                    <MenuItem value="K">K</MenuItem>
                    <MenuItem value="M">M</MenuItem>
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
                    placeholder="Mã KH.DV.TYPE.TÊN DỰ ÁN"
                    className="[&_.MuiOutlinedInput-root]:!bg-emerald-50/60"
                    slotProps={{
                      htmlInput: { readOnly: true },
                      inputLabel: { shrink: true },
                    }}
                  />
                )}
              />
            </div>

            <FormInputField
              label="Link plan"
              placeholder="https://docs.google.com/..."
              disabled={readOnly}
              {...register('planLink')}
            />

            <FormInputField
              label="Nhóm Zalo"
              placeholder="Tên nhóm hoặc link nhóm"
              disabled={readOnly}
              {...register('zaloGroup')}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="startDate"
                control={control}
                rules={{ required: 'Vui lòng chọn ngày bắt đầu dự án' }}
                render={({ field }) => (
                  <FormDatePicker
                    label="Ngày bắt đầu *"
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
          {mode === 'create' ? (
            <FormSection title="Báo phí khởi tạo">
              <Controller
                name="quotationId"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={originQuotationOptions}
                    value={
                      originQuotationOptions.find(
                        (quotation) => String(quotation.id) === field.value,
                      ) || null
                    }
                    disabled={readOnly}
                    onChange={(_, nextValue) => applyOriginQuotation(nextValue)}
                    getOptionLabel={quotationLabel}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    getOptionDisabled={(option) => !option.customerId}
                    noOptionsText="Không có báo phí chưa gắn dự án"
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <div className="min-w-0 py-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {option.quotationCode || `Báo phí #${option.id}`}
                            <span className="ml-2 font-medium text-slate-400">
                              {QUOTATION_STATUS_LABELS[option.status || ''] || option.status}
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {option.customer?.customerName ||
                              'Chưa có khách hàng — cần chuyển Lead thành khách hàng'}
                            {' · '}
                            {option.serviceName || 'Chưa chọn dịch vụ'}
                            {' · '}
                            {formatCurrency(Number(option.totalAmount) || 0)}
                          </p>
                        </div>
                      </li>
                    )}
                    renderInput={(params) => (
                      <FormInputField
                        {...params}
                        label="Báo phí"
                        placeholder="Tìm theo mã, khách hàng hoặc dịch vụ"
                      />
                    )}
                  />
                )}
              />

              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5">
                {selectedQuotation ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                        {selectedQuotation.quotationCode || `#${selectedQuotation.id}`}
                      </p>
                      <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950">
                        {formatCurrency(Number(selectedQuotation.totalAmount) || 0)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {selectedQuotation.customer?.customerName || 'Chưa có khách hàng'}
                      {' · '}
                      {selectedQuotation.serviceName || 'Chưa chọn dịch vụ'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-600">Tạo dự án độc lập</p>
                )}
              </div>
            </FormSection>
          ) : null}

          <FormSection title="Trạng thái & phụ trách">
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                revenueGroup.group === '2.1'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <span className="font-semibold">Nhóm dữ liệu: </span>
              <strong>{revenueGroup.title}</strong>
            </div>
            <Controller
              name="statusOptionId"
              control={control}
              rules={{ required: 'Vui lòng chọn trạng thái' }}
              render={({ field }) => (
                <FormSelectField
                  label="Trạng thái *"
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
              rules={{ required: 'Vui lòng chọn người quản lý' }}
              render={({ field }) => (
                <FormSelectField
                  label="Người quản lý *"
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
              name="salesUserId"
              control={control}
              rules={{ required: 'Vui lòng chọn Sales phụ trách' }}
              render={({ field }) => (
                <FormSelectField
                  label="Sales phụ trách *"
                  required
                  disabled={readOnly}
                  error={Boolean(errors.salesUserId)}
                  helperText={errors.salesUserId?.message}
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
              rules={{ required: 'Vui lòng chọn thứ báo cáo' }}
              render={({ field }) => (
                <FormSelectField
                  label="Thứ báo cáo *"
                  required
                  disabled={readOnly}
                  error={Boolean(errors.weeklyReportWeekday)}
                  helperText={errors.weeklyReportWeekday?.message}
                  {...field}
                >
                  <MenuItem value="">Chưa chọn</MenuItem>
                  {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                    <MenuItem key={weekday} value={String(weekday)}>
                      {getReportWeekdayLabel(weekday)}
                    </MenuItem>
                  ))}
                </FormSelectField>
              )}
            />

            {selectedSalesUserId && reportWeekday ? (
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
                        {selectedSalesUser?.name ||
                          selectedSalesUser?.email ||
                          `Sales #${selectedSalesUserId}`}
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
