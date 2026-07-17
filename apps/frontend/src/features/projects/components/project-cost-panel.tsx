'use client';

import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Checkbox, FormControlLabel, IconButton, MenuItem } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { getBankAccountBankCode } from '@/lib/company-bank-account-options';
import { getPartnerMetaValue } from '@/lib/project-partner-options';
import { calculateAvailableTopupBudget, isManagedBudgetProject } from '@/lib/project-topup-budget';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type {
  ProjectCost,
  ProjectCostEntryType,
  ProjectCostFormValues,
} from '@/types/project-cost';
import type { Quotation } from '@/types/quotation';

const COST_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const ACCEPTANCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ nghiệm thu',
  accepted: 'Đã nghiệm thu',
  not_required: 'Không yêu cầu',
};

const INPUT_INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ hóa đơn',
  received: 'Đã nhận',
  not_required: 'Không yêu cầu',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function bankAccountLabel(option: AppOption | null | undefined) {
  if (!option) return '-';
  return [getBankAccountBankCode(option), option.value].filter(Boolean).join(' · ') || option.label;
}

function partnerLabel(option: AppOption | null | undefined) {
  if (!option) return '-';
  return [option.key, option.label].filter(Boolean).join(' · ');
}

function statusClass(status?: string | null) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-500 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

function getCostDefaults(cost?: ProjectCost | null): ProjectCostFormValues {
  const isAdSpend = cost?.entryType === 'ad_spend';

  return {
    quotationId: cost?.quotationId ? String(cost.quotationId) : '',
    transactionDate: cost?.transactionDate || new Date().toISOString().slice(0, 10),
    status: cost?.status || 'pending',
    cid: cost?.cid || '',
    adAccount: cost?.adAccount || '',
    cidIsDead: cost?.cidIsDead === true,
    cidSpentAmount: String(cost?.cidSpentAmount ?? ''),
    bankAccountOptionId: cost?.bankAccountOptionId ? String(cost.bankAccountOptionId) : '',
    partnerOptionId: cost?.partnerOptionId ? String(cost.partnerOptionId) : '',
    amountBeforeVat: String(
      isAdSpend
        ? (cost?.totalAmount ?? cost?.amountBeforeVat ?? '')
        : (cost?.amountBeforeVat ?? ''),
    ),
    vatRate: String(isAdSpend ? '0' : (cost?.vatRate ?? '0')),
    discountAmount: String(cost?.discountAmount ?? '0'),
    acceptanceStatus: cost?.acceptanceStatus || 'pending',
    inputInvoiceStatus: cost?.inputInvoiceStatus || 'pending',
    note: cost?.note || '',
  };
}

function CostDialog({
  open,
  entryType,
  cost,
  projectType,
  projectCode,
  costs,
  quotations,
  bankAccounts,
  partners,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entryType: ProjectCostEntryType;
  cost?: ProjectCost | null;
  projectType?: 'K' | 'M' | null;
  projectCode?: string | null;
  costs: ProjectCost[];
  quotations: Quotation[];
  bankAccounts: AppOption[];
  partners: AppOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectCostFormValues, cost?: ProjectCost | null) => Promise<unknown>;
}) {
  const isAdSpend = entryType === 'ad_spend';
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectCostFormValues>({ values: getCostDefaults(cost) });
  const amountBeforeVat = Number(watch('amountBeforeVat')) || 0;
  const selectedQuotationId = watch('quotationId');
  const cidIsDead = watch('cidIsDead');
  const cidSpentAmount = Math.max(0, Number(watch('cidSpentAmount')) || 0);
  const currentStatus = watch('status');
  const vatRate = isAdSpend ? 0 : Number(watch('vatRate')) || 0;
  const discountAmount = isAdSpend ? 0 : Number(watch('discountAmount')) || 0;
  const vatAmount = Math.round((amountBeforeVat * vatRate) / 100);
  const totalAmount = isAdSpend
    ? Math.max(0, amountBeforeVat)
    : Math.max(0, amountBeforeVat + vatAmount - discountAmount);
  const managedBudgetProject = isManagedBudgetProject({
    projectType,
    projectCode,
    quotations,
  });
  const draftEditingCost = cost
    ? {
        ...cost,
        quotationId: selectedQuotationId ? Number(selectedQuotationId) : null,
        status: currentStatus,
        amountBeforeVat,
        cidIsDead,
        cidSpentAmount,
      }
    : null;
  const { customerBudget, availableBudget } = calculateAvailableTopupBudget({
    quotations,
    costs,
    quotationId: selectedQuotationId,
    editingCost: draftEditingCost,
  });

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={open}
      title={cost ? 'Sửa khoản chi' : isAdSpend ? 'Thêm lần nạp quảng cáo' : 'Thêm chi phí đối tác'}
      maxWidth="md"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, cost);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      contentClassName="grid gap-3 md:grid-cols-2"
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu khoản chi'}
          </DialogActionButton>
        </>
      }
    >
      <Controller
        name="quotationId"
        control={control}
        render={({ field }) => (
          <FormSelectField label="Báo phí liên quan" {...field}>
            <MenuItem value="">Không gắn báo phí</MenuItem>
            {quotations.map((quotation) => (
              <MenuItem key={quotation.id} value={String(quotation.id)}>
                {quotation.quotationCode || `Báo phí #${quotation.id}`}
              </MenuItem>
            ))}
          </FormSelectField>
        )}
      />

      {isAdSpend ? (
        <Controller
          name="transactionDate"
          control={control}
          rules={{ required: 'Bắt buộc' }}
          render={({ field }) => (
            <FormDatePicker
              label="Ngày nạp/hủy"
              value={field.value}
              onChange={field.onChange}
              required
              error={Boolean(errors.transactionDate)}
              helperText={errors.transactionDate?.message}
            />
          )}
        />
      ) : (
        <FormInputField
          type="date"
          label="Ngày chi/hủy *"
          error={Boolean(errors.transactionDate)}
          helperText={errors.transactionDate?.message}
          slotProps={{ inputLabel: { shrink: true } }}
          {...register('transactionDate', { required: 'Bắt buộc' })}
        />
      )}

      {isAdSpend ? (
        <>
          <FormInputField
            label="Mã CID *"
            error={Boolean(errors.cid)}
            helperText={errors.cid?.message}
            {...register('cid', { required: 'Bắt buộc' })}
          />
          <FormInputField label="Tài khoản quảng cáo" {...register('adAccount')} />
        </>
      ) : (
        <Controller
          name="partnerOptionId"
          control={control}
          rules={{ required: 'Bắt buộc' }}
          render={({ field }) => (
            <FormSelectField
              label="Đối tác *"
              error={Boolean(errors.partnerOptionId)}
              helperText={errors.partnerOptionId?.message}
              {...field}
            >
              <MenuItem value="">Chưa chọn</MenuItem>
              {partners.map((partner) => (
                <MenuItem key={partner.id} value={String(partner.id)}>
                  {partnerLabel(partner)}
                </MenuItem>
              ))}
            </FormSelectField>
          )}
        />
      )}

      <Controller
        name="bankAccountOptionId"
        control={control}
        rules={{ required: 'Bắt buộc' }}
        render={({ field }) => (
          <FormSelectField
            label={isAdSpend ? 'TK ngân hàng nạp QC *' : 'TK công ty chi *'}
            error={Boolean(errors.bankAccountOptionId)}
            helperText={errors.bankAccountOptionId?.message}
            {...field}
          >
            <MenuItem value="">Chưa chọn</MenuItem>
            {bankAccounts.map((account) => (
              <MenuItem key={account.id} value={String(account.id)}>
                {bankAccountLabel(account)} · {account.label}
              </MenuItem>
            ))}
          </FormSelectField>
        )}
      />

      <Controller
        name="amountBeforeVat"
        control={control}
        rules={{ required: 'Bắt buộc' }}
        render={({ field }) => (
          <MoneyInput
            fullWidth
            size="small"
            label={isAdSpend ? 'Ngân sách nạp + VAT *' : 'Chi phí đối tác *'}
            value={field.value}
            onValueChange={field.onChange}
            error={Boolean(errors.amountBeforeVat)}
            helperText={errors.amountBeforeVat?.message}
            className={compactFormFieldClassName}
          />
        )}
      />
      {!isAdSpend ? (
        <FormInputField
          type="number"
          label="Thuế suất VAT (%)"
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          {...register('vatRate')}
        />
      ) : null}

      {!isAdSpend ? (
        <Controller
          name="discountAmount"
          control={control}
          render={({ field }) => (
            <MoneyInput
              fullWidth
              size="small"
              label="Voucher / khuyến mại / chiết khấu"
              value={field.value}
              onValueChange={field.onChange}
              className={compactFormFieldClassName}
            />
          )}
        />
      ) : null}

      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <FormSelectField label="Tình trạng" {...field}>
            <MenuItem value="pending">{isAdSpend ? 'Chờ nạp' : 'Chờ chi'}</MenuItem>
            <MenuItem value="completed">{isAdSpend ? 'Đã nạp' : 'Đã chi'}</MenuItem>
            <MenuItem value="cancelled">Đã hủy</MenuItem>
          </FormSelectField>
        )}
      />

      {isAdSpend && managedBudgetProject ? (
        <div
          role="status"
          aria-live="polite"
          className={`md:col-span-2 flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-1.5 ${
            availableBudget < 0 ? 'border-rose-200 bg-rose-50/70' : 'border-sky-200 bg-sky-50/70'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              availableBudget < 0 ? 'text-rose-700' : 'text-sky-700'
            }`}
          >
            <InfoOutlinedIcon className="shrink-0 !text-[16px]" />
            {customerBudget > 0
              ? 'Ngân sách còn có thể nạp'
              : 'Chưa có ngân sách khách trong báo phí'}
          </span>
          {customerBudget > 0 ? (
            <strong
              className={`whitespace-nowrap text-sm font-extrabold tabular-nums ${
                availableBudget < 0 ? 'text-rose-800' : 'text-sky-800'
              }`}
            >
              {formatCurrency(availableBudget)}
            </strong>
          ) : null}
        </div>
      ) : null}

      {!isAdSpend ? (
        <>
          <Controller
            name="acceptanceStatus"
            control={control}
            render={({ field }) => (
              <FormSelectField label="Nghiệm thu" {...field}>
                <MenuItem value="pending">Chờ nghiệm thu</MenuItem>
                <MenuItem value="accepted">Đã nghiệm thu</MenuItem>
                <MenuItem value="not_required">Không yêu cầu</MenuItem>
              </FormSelectField>
            )}
          />
          <Controller
            name="inputInvoiceStatus"
            control={control}
            render={({ field }) => (
              <FormSelectField label="Hóa đơn đầu vào" {...field}>
                <MenuItem value="pending">Chờ hóa đơn</MenuItem>
                <MenuItem value="received">Đã nhận</MenuItem>
                <MenuItem value="not_required">Không yêu cầu</MenuItem>
              </FormSelectField>
            )}
          />
        </>
      ) : null}

      {isAdSpend && cost ? (
        <div
          className={`md:col-span-2 flex min-h-11 flex-col gap-2 rounded-md border px-3 py-1.5 md:flex-row md:items-center md:justify-between ${
            cidIsDead ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <Controller
            name="cidIsDead"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                className="!m-0"
                control={
                  <Checkbox
                    size="small"
                    color="error"
                    checked={field.value}
                    onChange={(event) => {
                      field.onChange(event.target.checked);
                      if (!event.target.checked) {
                        setValue('cidSpentAmount', '');
                      }
                    }}
                  />
                }
                label={
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-slate-800">
                    <WarningAmberRoundedIcon
                      className={`!text-[17px] ${cidIsDead ? 'text-rose-600' : 'text-slate-400'}`}
                    />
                    <span className={cidIsDead ? 'text-rose-700' : undefined}>
                      CID ngừng hoạt động
                    </span>
                  </span>
                }
              />
            )}
          />

          {cidIsDead ? (
            <Controller
              name="cidSpentAmount"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  size="small"
                  label="Số tiền CID đã chạy"
                  value={field.value}
                  onValueChange={field.onChange}
                  className={`${compactFormFieldClassName} w-full md:w-[320px]`}
                />
              )}
            />
          ) : null}
        </div>
      ) : null}

      <FormInputField
        multiline
        minRows={2}
        label="Ghi chú"
        className="md:col-span-2"
        {...register('note')}
      />

      {!isAdSpend ? (
        <div className="md:col-span-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <div className="px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase text-slate-400">VAT</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{formatCurrency(vatAmount)}</p>
          </div>
          <div className="border-x border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase text-slate-400">Giảm trừ</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {formatCurrency(discountAmount)}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase text-slate-400">Thực chi</p>
            <p className="mt-1 text-sm font-extrabold text-slate-950">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      ) : null}
    </AppFormDialog>
  );
}

export function ProjectCostPanel({
  projectId,
  projectType,
  projectCode,
  revenueGroup,
  costs,
  quotations,
  bankAccounts,
  partners,
}: {
  projectId: number;
  projectType?: 'K' | 'M' | null;
  projectCode?: string | null;
  revenueGroup: '2.1' | '2.2';
  costs: ProjectCost[];
  quotations: Quotation[];
  bankAccounts: AppOption[];
  partners: AppOption[];
}) {
  const entryType: ProjectCostEntryType = revenueGroup === '2.1' ? 'ad_spend' : 'partner_cost';
  const visibleCosts = costs.filter((cost) => cost.entryType === entryType);
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ProjectCost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectCost | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      cost,
    }: {
      values: ProjectCostFormValues;
      cost?: ProjectCost | null;
    }) => {
      const payload = {
        projectId,
        entryType,
        quotationId: values.quotationId ? Number(values.quotationId) : null,
        transactionDate: values.transactionDate || null,
        status: values.status,
        cid: values.cid.trim() || null,
        adAccount: values.adAccount.trim() || null,
        cidIsDead: entryType === 'ad_spend' ? values.cidIsDead : false,
        cidSpentAmount:
          entryType === 'ad_spend' && values.cidIsDead ? Number(values.cidSpentAmount) || 0 : 0,
        bankAccountOptionId: values.bankAccountOptionId ? Number(values.bankAccountOptionId) : null,
        partnerOptionId: values.partnerOptionId ? Number(values.partnerOptionId) : null,
        amountBeforeVat: Number(values.amountBeforeVat) || 0,
        vatRate: entryType === 'ad_spend' ? 0 : Number(values.vatRate) || 0,
        discountAmount: Number(values.discountAmount) || 0,
        acceptanceStatus: entryType === 'partner_cost' ? values.acceptanceStatus : null,
        inputInvoiceStatus: entryType === 'partner_cost' ? values.inputInvoiceStatus : null,
        note: values.note.trim() || null,
      };

      return cost
        ? api
            .put<ProjectCost>(`/project-costs/${cost.id}`, payload)
            .then((response) => response.data)
        : api.post<ProjectCost>('/project-costs', payload).then((response) => response.data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['project-costs', 'by-project', String(projectId)],
      });
      notify.success(variables.cost ? 'Đã cập nhật khoản chi' : 'Đã thêm khoản chi');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể lưu khoản chi')),
  });

  const deleteMutation = useMutation({
    mutationFn: (cost: ProjectCost) => api.delete(`/project-costs/${cost.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['project-costs', 'by-project', String(projectId)],
      });
      notify.success('Đã xóa khoản chi');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa khoản chi')),
  });

  const openCreate = () => {
    setEditingCost(null);
    setDialogOpen(true);
  };

  const openEdit = (cost: ProjectCost) => {
    if (cost.reconciledAt) {
      notify.warning('Khoản chi đã đối soát nên không thể chỉnh sửa.');
      return;
    }

    setEditingCost(cost);
    setDialogOpen(true);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-950">
            {entryType === 'ad_spend' ? 'Chi phí nạp quảng cáo' : 'Chi phí đối tác'}
          </h2>
        </div>
        <TabActionButton startIcon={<AddRoundedIcon />} onClick={openCreate}>
          {entryType === 'ad_spend' ? 'Thêm lần nạp' : 'Thêm chi phí'}
        </TabActionButton>
      </div>

      <div className="overflow-x-auto">
        {entryType === 'ad_spend' ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
              <tr>
                <th className="px-4 py-3">Lần nạp</th>
                <th className="px-3 py-3">CID / Tài khoản QC</th>
                <th className="px-3 py-3">TK ngân hàng nạp QC</th>
                <th className="px-3 py-3 text-right">Ngân sách + VAT</th>
                <th className="px-3 py-3">Tình trạng</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-semibold text-slate-500">
                    Chưa có dữ liệu nạp quảng cáo
                  </td>
                </tr>
              ) : (
                visibleCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums text-slate-800">
                        {formatDate(cost.transactionDate)}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-blue-700">
                        {cost.quotation?.quotationCode || 'Không gắn báo phí'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800">
                          {cost.cid || '-'}
                        </span>
                        {cost.cidIsDead ? (
                          <>
                            <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
                              Ngừng hoạt động
                            </span>
                            <span className="text-xs font-bold tabular-nums text-rose-700">
                              Đã chạy {formatCurrency(Number(cost.cidSpentAmount) || 0)}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-slate-500">
                        {cost.adAccount || 'Chưa có tài khoản quảng cáo'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {bankAccountLabel(cost.bankAccountOption)}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                      {formatCurrency(Number(cost.totalAmount) || 0)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
                      >
                        {COST_STATUS_LABELS[cost.status] || cost.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {cost.reconciledAt ? (
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                            title="Khoản chi đã đối soát, không thể sửa hoặc xóa"
                          >
                            <LockRoundedIcon className="!text-[15px]" />
                            Đã khớp
                          </span>
                        ) : (
                          <>
                            <IconButton
                              size="small"
                              title="Sửa"
                              aria-label={`Sửa lần nạp ${cost.cid || cost.id}`}
                              onClick={() => openEdit(cost)}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              title="Xóa"
                              aria-label={`Xóa lần nạp ${cost.cid || cost.id}`}
                              onClick={() => setDeleteTarget(cost)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[1420px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
              <tr>
                <th className="px-4 py-3">Ngày chi/hủy</th>
                <th className="px-3 py-3">Báo phí</th>
                <th className="px-3 py-3">Đối tác</th>
                <th className="px-3 py-3">TK công ty chi</th>
                <th className="px-3 py-3 text-right">Chi phí đối tác</th>
                <th className="px-3 py-3 text-right">Giảm trừ</th>
                <th className="px-3 py-3 text-right">VAT</th>
                <th className="px-3 py-3 text-right">Thực chi</th>
                <th className="px-3 py-3">Nghiệm thu</th>
                <th className="px-3 py-3">HĐ đầu vào</th>
                <th className="px-3 py-3">Tình trạng</th>
                <th className="w-28 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCosts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center font-semibold text-slate-500">
                    Chưa có chi phí đối tác
                  </td>
                </tr>
              ) : (
                visibleCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {formatDate(cost.transactionDate)}
                    </td>
                    <td className="px-3 py-3 font-bold text-blue-700">
                      {cost.quotation?.quotationCode || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-800">{partnerLabel(cost.partnerOption)}</p>
                      {cost.partnerOption ? (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {getPartnerMetaValue(cost.partnerOption, 'accountNo')} ·{' '}
                          {getPartnerMetaValue(cost.partnerOption, 'bankName')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {bankAccountLabel(cost.bankAccountOption)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(Number(cost.amountBeforeVat) || 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(Number(cost.discountAmount) || 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(Number(cost.vatAmount) || 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                      {formatCurrency(Number(cost.totalAmount) || 0)}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                      {ACCEPTANCE_STATUS_LABELS[cost.acceptanceStatus || ''] || '-'}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                      {INPUT_INVOICE_STATUS_LABELS[cost.inputInvoiceStatus || ''] || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
                      >
                        {COST_STATUS_LABELS[cost.status] || cost.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {cost.reconciledAt ? (
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                            title="Khoản chi đã đối soát, không thể sửa hoặc xóa"
                          >
                            <LockRoundedIcon className="!text-[15px]" />
                            Đã khớp
                          </span>
                        ) : (
                          <>
                            <IconButton size="small" title="Sửa" onClick={() => openEdit(cost)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              title="Xóa"
                              onClick={() => setDeleteTarget(cost)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <CostDialog
        open={dialogOpen}
        entryType={entryType}
        cost={editingCost}
        projectType={projectType}
        projectCode={projectCode}
        costs={costs}
        quotations={quotations}
        bankAccounts={bankAccounts}
        partners={partners}
        isSubmitting={saveMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(values, cost) => saveMutation.mutateAsync({ values, cost })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa khoản chi?"
        description="Khoản chi sẽ không còn được tính vào tổng chi phí và lợi nhuận dự án."
        confirmText="Xóa khoản chi"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}
