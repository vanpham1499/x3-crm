'use client';

import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { IconButton, MenuItem } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { getBankAccountBankCode } from '@/lib/company-bank-account-options';
import { getPartnerMetaValue } from '@/lib/project-partner-options';
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
  return {
    quotationId: cost?.quotationId ? String(cost.quotationId) : '',
    transactionDate: cost?.transactionDate || new Date().toISOString().slice(0, 10),
    status: cost?.status || 'pending',
    cid: cost?.cid || '',
    adAccount: cost?.adAccount || '',
    bankAccountOptionId: cost?.bankAccountOptionId ? String(cost.bankAccountOptionId) : '',
    partnerOptionId: cost?.partnerOptionId ? String(cost.partnerOptionId) : '',
    amountBeforeVat: String(cost?.amountBeforeVat ?? ''),
    vatRate: String(cost?.vatRate ?? '0'),
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
    watch,
    formState: { errors },
  } = useForm<ProjectCostFormValues>({ values: getCostDefaults(cost) });
  const amountBeforeVat = Number(watch('amountBeforeVat')) || 0;
  const vatRate = Number(watch('vatRate')) || 0;
  const discountAmount = isAdSpend ? 0 : Number(watch('discountAmount')) || 0;
  const vatAmount = Math.round((amountBeforeVat * vatRate) / 100);
  const totalAmount = Math.max(0, amountBeforeVat + vatAmount - discountAmount);

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
      <FormInputField
        type="date"
        label={isAdSpend ? 'Ngày nạp/hủy *' : 'Ngày chi/hủy *'}
        error={Boolean(errors.transactionDate)}
        helperText={errors.transactionDate?.message}
        slotProps={{ inputLabel: { shrink: true } }}
        {...register('transactionDate', { required: 'Bắt buộc' })}
      />

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
            label={isAdSpend ? 'Ngân sách nạp *' : 'Chi phí đối tác *'}
            value={field.value}
            onValueChange={field.onChange}
            error={Boolean(errors.amountBeforeVat)}
            helperText={errors.amountBeforeVat?.message}
            className={compactFormFieldClassName}
          />
        )}
      />
      <FormInputField
        type="number"
        label="Thuế suất VAT (%)"
        slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        {...register('vatRate')}
      />

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

      <FormInputField
        multiline
        minRows={2}
        label="Ghi chú"
        className="md:col-span-2"
        {...register('note')}
      />

      <div className="md:col-span-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <div className="px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase text-slate-400">VAT</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{formatCurrency(vatAmount)}</p>
        </div>
        <div className="border-x border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase text-slate-400">Giảm trừ</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{formatCurrency(discountAmount)}</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase text-slate-400">
            {isAdSpend ? 'Ngân sách + VAT' : 'Thực chi'}
          </p>
          <p className="mt-1 text-sm font-extrabold text-slate-950">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>
    </AppFormDialog>
  );
}

export function ProjectCostPanel({
  projectId,
  revenueGroup,
  costs,
  quotations,
  bankAccounts,
  partners,
}: {
  projectId: number;
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
        bankAccountOptionId: values.bankAccountOptionId ? Number(values.bankAccountOptionId) : null,
        partnerOptionId: values.partnerOptionId ? Number(values.partnerOptionId) : null,
        amountBeforeVat: Number(values.amountBeforeVat) || 0,
        vatRate: Number(values.vatRate) || 0,
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
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
              revenueGroup === '2.1'
                ? 'bg-sky-50 text-sky-700 ring-sky-200'
                : 'bg-amber-50 text-amber-700 ring-amber-200'
            }`}
          >
            {revenueGroup}
          </span>
        </div>
        <TabActionButton startIcon={<AddRoundedIcon />} onClick={openCreate}>
          {entryType === 'ad_spend' ? 'Thêm lần nạp' : 'Thêm chi phí'}
        </TabActionButton>
      </div>

      <div className="overflow-x-auto">
        {entryType === 'ad_spend' ? (
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
              <tr>
                <th className="px-4 py-3">Ngày nạp/hủy</th>
                <th className="px-3 py-3">Báo phí</th>
                <th className="px-3 py-3">Mã CID</th>
                <th className="px-3 py-3">Tài khoản QC</th>
                <th className="px-3 py-3">TK ngân hàng nạp QC</th>
                <th className="px-3 py-3 text-right">Ngân sách</th>
                <th className="px-3 py-3 text-right">VAT</th>
                <th className="px-3 py-3 text-right">Ngân sách + VAT</th>
                <th className="px-3 py-3">Tình trạng</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCosts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-semibold text-slate-500">
                    Chưa có dữ liệu nạp quảng cáo
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
                    <td className="px-3 py-3 font-mono font-bold text-slate-800">
                      {cost.cid || '-'}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{cost.adAccount || '-'}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {bankAccountLabel(cost.bankAccountOption)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(Number(cost.amountBeforeVat) || 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(Number(cost.vatAmount) || 0)}
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
                        <IconButton size="small" title="Sửa" onClick={() => openEdit(cost)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Xóa" onClick={() => setDeleteTarget(cost)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
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
                <th className="w-20 px-4 py-3" />
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
                        <IconButton size="small" title="Sửa" onClick={() => openEdit(cost)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Xóa" onClick={() => setDeleteTarget(cost)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
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
