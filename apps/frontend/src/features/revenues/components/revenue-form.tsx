'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, Button, IconButton, MenuItem, TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { MoneyInput } from '@/components/form/money-input';
import {
  REVENUE_INVOICE_STATUS_LABELS,
  REVENUE_PAYMENT_STATUS_LABELS,
  computeLineAmount,
  computeRevenueTotals,
  createEmptyRevenueLine,
  getRevenueDefaults,
  toRevenuePayload,
} from '@/lib/revenue-utils';
import { flattenServices } from '@/lib/service-utils';
import { formatCurrency } from '@/lib/utils';
import type { ProjectItem } from '@/types/project';
import type { Revenue, RevenueFormValues, RevenueLineFormValue } from '@/types/revenue';
import type { ServiceItem } from '@/types/service';

type RevenueFormProps = {
  mode: 'create' | 'edit';
  revenue?: Revenue | null;
  projects: ProjectItem[];
  services: ServiceItem[];
  defaultValues?: Partial<RevenueFormValues>;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
};

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </section>
  );
}

function RevenueDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')}
      slotProps={{ textField: { fullWidth: true } }}
    />
  );
}

function projectLabel(project: ProjectItem) {
  return [project.projectCode, project.projectName].filter(Boolean).join(' - ');
}

function serviceLabel(service: ReturnType<typeof flattenServices>[number]) {
  return `${service.code} - ${service.pathName}`;
}

export function RevenueForm({
  mode,
  revenue,
  projects,
  services,
  defaultValues,
  isSubmitting,
  onSubmit,
}: RevenueFormProps) {
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const initialValues = useMemo(
    () => getRevenueDefaults(revenue, defaultValues),
    [revenue, defaultValues],
  );
  const [items, setItems] = useState<RevenueLineFormValue[]>(initialValues.items);
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RevenueFormValues>({ values: initialValues });

  const selectedProjectId = watch('projectId');
  const vatRate = watch('vatRate');
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId);
  const totals = computeRevenueTotals(items, vatRate);

  const updateLine = (id: number, patch: Partial<RevenueLineFormValue>) => {
    setItems((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setItems((current) => [...current, createEmptyRevenueLine()]);
  };

  const removeLine = (id: number) => {
    setItems((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : current));
  };

  const submit = handleSubmit((values) => {
    onSubmit(toRevenuePayload({ ...values, items }));
  });

  return (
    <form className="w-full space-y-8" onSubmit={submit}>
      <div className="grid w-full items-start gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FormSection
            title="Thông tin doanh thu"
            description="Dự án, loại doanh thu và thời gian ghi nhận."
          >
            <Controller
              name="projectId"
              control={control}
              rules={{ required: 'Vui lòng chọn dự án' }}
              render={({ field }) => (
                <TextField
                  fullWidth
                  select
                  label="Dự án *"
                  error={Boolean(errors.projectId)}
                  helperText={errors.projectId?.message}
                  {...field}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={String(project.id)}>
                      {projectLabel(project)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                fullWidth
                label="Mã doanh thu"
                placeholder="Hệ thống tự tạo nếu để trống"
                {...register('revenueCode')}
              />
              <TextField fullWidth select label="Loại doanh thu" {...register('revenueType')}>
                <MenuItem value="service_fee">Phí dịch vụ</MenuItem>
                <MenuItem value="setup_fee">Phí setup</MenuItem>
                <MenuItem value="other">Khác</MenuItem>
              </TextField>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Controller
                name="reportedDate"
                control={control}
                render={({ field }) => (
                  <RevenueDatePicker label="Ngày báo phí" value={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="paymentDueDate"
                control={control}
                render={({ field }) => (
                  <RevenueDatePicker label="Ngày đến hạn" value={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                name="paidDate"
                control={control}
                render={({ field }) => (
                  <RevenueDatePicker label="Ngày thanh toán" value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <Controller
              name="revenueMonth"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Tháng doanh thu"
                  views={['year', 'month']}
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(nextValue) =>
                    field.onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-01') : '')
                  }
                  slotProps={{ textField: { fullWidth: true } }}
                />
              )}
            />

            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Ghi chú"
              {...register('note')}
            />
          </FormSection>

          <FormSection
            title="Hạng mục doanh thu"
            description="Chi tiết dịch vụ, số lượng và đơn giá — Doanh thu = Số lượng × Đơn giá."
          >
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Dịch vụ / Nội dung</th>
                      <th className="w-24 px-3 py-3">SL</th>
                      <th className="w-24 px-3 py-3">Đơn vị</th>
                      <th className="w-40 px-3 py-3">Đơn giá</th>
                      <th className="w-40 px-3 py-3 text-right">Thành tiền</th>
                      <th className="w-12 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((line) => {
                      const selectedService =
                        serviceOptions.find((service) => String(service.id) === line.serviceId) || null;

                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-3">
                            <Autocomplete
                              options={serviceOptions}
                              value={selectedService}
                              onChange={(_, nextValue) => {
                                updateLine(line.id, {
                                  serviceId: nextValue?.id !== undefined ? String(nextValue.id) : '',
                                  name: nextValue?.name || line.name,
                                  unit: nextValue?.unit || line.unit,
                                  unitPrice: nextValue?.defaultPrice
                                    ? String(nextValue.defaultPrice)
                                    : line.unitPrice,
                                });
                              }}
                              getOptionLabel={serviceLabel}
                              isOptionEqualToValue={(option, value) => option.id === value.id}
                              renderInput={(params) => (
                                <TextField {...params} size="small" placeholder="Chọn dịch vụ (không bắt buộc)" />
                              )}
                            />
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Nội dung hạng mục *"
                              className="mt-2"
                              value={line.name}
                              onChange={(event) => updateLine(line.id, { name: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <TextField
                              size="small"
                              type="number"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <TextField
                              size="small"
                              placeholder="tháng, cái..."
                              value={line.unit}
                              onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <MoneyInput
                              size="small"
                              value={line.unitPrice}
                              onValueChange={(value) => updateLine(line.id, { unitPrice: value })}
                            />
                          </td>
                          <td className="px-3 py-3 text-right align-top font-bold text-slate-950">
                            {formatCurrency(computeLineAmount(line))}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <IconButton
                              size="small"
                              disabled={items.length <= 1}
                              onClick={() => removeLine(line.id)}
                            >
                              <DeleteRoundedIcon fontSize="small" />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 p-3">
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={addLine}>
                  Thêm dòng
                </Button>
              </div>
            </div>
          </FormSection>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <FormSection
            title="Tổng kết & trạng thái"
            description="VAT, doanh thu thực nhận và tình trạng thanh toán, hóa đơn."
          >
            <Controller
              name="vatRate"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  type="number"
                  label="Thuế suất VAT (%)"
                  {...field}
                />
              )}
            />

            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tạm tính</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">VAT</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.vatAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-950">Doanh thu sau VAT</span>
                <span className="text-base font-extrabold text-slate-950">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>

            <Controller
              name="actualReceivedAmount"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  fullWidth
                  label="Doanh thu thực nhận"
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />

            <Controller
              name="paymentStatus"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Tình trạng thanh toán" {...field}>
                  {Object.entries(REVENUE_PAYMENT_STATUS_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="invoiceStatus"
              control={control}
              render={({ field }) => (
                <TextField fullWidth select label="Tình trạng hóa đơn" {...field}>
                  {Object.entries(REVENUE_INVOICE_STATUS_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {selectedProject ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                <p className="font-bold text-slate-950">{selectedProject.projectName}</p>
                <p className="mt-1">Mã dự án: {selectedProject.projectCode || '-'}</p>
              </div>
            ) : null}
          </FormSection>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-1 py-4 backdrop-blur">
        <Link
          href="/revenues"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          Hủy
        </Link>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={<SaveRoundedIcon />}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          {isSubmitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo doanh thu' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
