'use client';

import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  ButtonBase,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
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
import { getAdTopupCardLabel } from '@/lib/ad-topup-card-options';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { canEditProject } from '@/lib/ownership';
import { calculateAvailableTopupBudget, isManagedBudgetProject } from '@/lib/project-topup-budget';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { AppOption } from '@/types/option';
import type {
  ProjectCost,
  ProjectCostEntryType,
  ProjectCostFormValues,
  ProjectCostStatus,
} from '@/types/project-cost';
import type { ProjectItem, ProjectType } from '@/types/project';
import type { Quotation } from '@/types/quotation';

function costStatusLabel(status: string, entryType: ProjectCostEntryType) {
  if (status === 'completed') return entryType === 'ad_spend' ? 'Đã nạp' : 'Đã chi';
  if (status === 'cancelled') return 'Đã hủy';
  return entryType === 'ad_spend' ? 'Chờ nạp' : 'Chờ chi';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
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

function moneyValue(value: string | number | null | undefined) {
  return Number(value) || 0;
}

function balanceStatusBadge(cost: ProjectCost) {
  const remainingBalance = moneyValue(cost.remainingBalanceAmount);
  const releasedBalance = moneyValue(
    cost.releasedBalanceAmount ?? cost.handledBalanceAmount ?? cost.originalBalanceAmount,
  );

  if (!cost.balanceStatus || cost.balanceStatus === 'none') {
    return null;
  }

  if (remainingBalance > 0) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
        Chờ hoàn {formatCurrency(remainingBalance)}
      </span>
    );
  }

  return (
    <span className="inline-flex whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
      Đã hoàn hạn mức {formatCurrency(releasedBalance)}
    </span>
  );
}

const COST_STATUSES: ProjectCostStatus[] = ['pending', 'completed', 'cancelled'];

function InlineCostStatusSelect({
  cost,
  entryType,
  disabled,
  loading,
  onChange,
}: {
  cost: ProjectCost;
  entryType: ProjectCostEntryType;
  disabled: boolean;
  loading: boolean;
  onChange: (status: ProjectCostStatus) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (disabled) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ring-1 ${statusClass(cost.status)}`}
        title={costStatusLabel(cost.status, entryType)}
      >
        {costStatusLabel(cost.status, entryType)}
        {loading ? <CircularProgress size={13} thickness={5} className="!text-current" /> : null}
      </span>
    );
  }

  return (
    <>
      <ButtonBase
        aria-label={`Cập nhật trạng thái ${costStatusLabel(cost.status, entryType)}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        aria-busy={loading}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        className={`!inline-flex !max-w-[132px] !rounded-md !px-2 !py-1 !text-xs !font-bold !ring-1 ${statusClass(cost.status)}`}
      >
        <span className="min-w-0 truncate">{costStatusLabel(cost.status, entryType)}</span>
        <KeyboardArrowDownRoundedIcon className="!-mr-1 !ml-1 !text-[16px]" />
      </ButtonBase>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {COST_STATUSES.map((status) => {
          const isSelected = status === cost.status;

          return (
            <MenuItem
              key={status}
              selected={isSelected}
              className="!min-w-[180px] !gap-2"
              onClick={() => {
                setAnchorEl(null);
                if (!isSelected) onChange(status);
              }}
            >
              <span className={`size-2.5 shrink-0 rounded-full ring-1 ${statusClass(status)}`} />
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {costStatusLabel(status, entryType)}
              </span>
              {isSelected ? <CheckRoundedIcon className="!text-[18px] text-primary" /> : null}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

function CostActionMenu({
  cost,
  canManage,
  onEdit,
  onDelete,
}: {
  cost: ProjectCost;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const locked = Boolean(cost.reconciledAt);

  return (
    <>
      <IconButton
        size="small"
        title={locked ? 'Khoản chi đã đối soát' : 'Thao tác'}
        aria-label={`Thao tác khoản chi ${cost.id}`}
        disabled={!canManage || locked}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onEdit();
          }}
        >
          <EditOutlinedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="!text-rose-600"
          onClick={() => {
            setAnchorEl(null);
            onDelete();
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>
    </>
  );
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
  topupCards,
  partners,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entryType: ProjectCostEntryType;
  cost?: ProjectCost | null;
  projectType?: ProjectType | null;
  projectCode?: string | null;
  costs: ProjectCost[];
  quotations: Quotation[];
  topupCards: AppOption[];
  partners: AppOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectCostFormValues, cost?: ProjectCost | null) => Promise<unknown>;
}) {
  const isAdSpend = entryType === 'ad_spend';
  const selectableTopupCards =
    cost?.bankAccountOption && !topupCards.some((card) => card.id === cost.bankAccountOption?.id)
      ? [cost.bankAccountOption, ...topupCards]
      : topupCards;
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
      maxWidth={isAdSpend ? 'md' : 'sm'}
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
        <Controller
          name="transactionDate"
          control={control}
          rules={{ required: 'Bắt buộc' }}
          render={({ field }) => (
            <FormDatePicker
              label="Ngày chi"
              value={field.value}
              onChange={field.onChange}
              required
              error={Boolean(errors.transactionDate)}
              helperText={errors.transactionDate?.message}
            />
          )}
        />
      )}

      {isAdSpend ? (
        <FormInputField
          label="Mã CID *"
          error={Boolean(errors.cid)}
          helperText={errors.cid?.message}
          {...register('cid', { required: 'Bắt buộc' })}
        />
      ) : (
        <Controller
          name="partnerOptionId"
          control={control}
          rules={{ required: 'Bắt buộc' }}
          render={({ field }) => (
            <FormSelectField
              label="Tên đối tác *"
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

      {isAdSpend ? (
        <Controller
          name="bankAccountOptionId"
          control={control}
          render={({ field }) => (
            <FormSelectField label="Thẻ nạp QC" {...field}>
              <MenuItem value="">Chưa chọn</MenuItem>
              {selectableTopupCards.map((card) => (
                <MenuItem key={card.id} value={String(card.id)}>
                  {getAdTopupCardLabel(card)}
                </MenuItem>
              ))}
            </FormSelectField>
          )}
        />
      ) : null}

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
    </AppFormDialog>
  );
}

export function ProjectCostPanel({
  project,
  projectId,
  projectType,
  projectCode,
  revenueGroup,
  costs,
  quotations,
  topupCards,
  partners,
}: {
  project: ProjectItem;
  projectId: number;
  projectType?: ProjectType | null;
  projectCode?: string | null;
  revenueGroup: '2.1' | '2.2';
  costs: ProjectCost[];
  quotations: Quotation[];
  topupCards: AppOption[];
  partners: AppOption[];
}) {
  const entryType: ProjectCostEntryType = revenueGroup === '2.1' ? 'ad_spend' : 'partner_cost';
  const visibleCosts = costs.filter((cost) => cost.entryType === entryType);
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canManage = canEditProject(currentUser, project);
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
        quotationId:
          entryType === 'ad_spend' && values.quotationId ? Number(values.quotationId) : null,
        transactionDate: values.transactionDate || null,
        status: values.status,
        cid: values.cid.trim() || null,
        adAccount: values.adAccount.trim() || null,
        cidIsDead: entryType === 'ad_spend' ? values.cidIsDead : false,
        cidSpentAmount:
          entryType === 'ad_spend' && values.cidIsDead ? Number(values.cidSpentAmount) || 0 : 0,
        bankAccountOptionId:
          entryType === 'ad_spend' && values.bankAccountOptionId
            ? Number(values.bankAccountOptionId)
            : null,
        partnerOptionId: values.partnerOptionId ? Number(values.partnerOptionId) : null,
        amountBeforeVat: Number(values.amountBeforeVat) || 0,
        vatRate: 0,
        discountAmount: 0,
        acceptanceStatus: null,
        inputInvoiceStatus: null,
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

  const statusMutation = useMutation({
    mutationFn: ({ cost, status }: { cost: ProjectCost; status: ProjectCostStatus }) =>
      api
        .patch<ProjectCost>(`/project-costs/${cost.id}`, { status })
        .then((response) => response.data),
    onSuccess: (updatedCost) => {
      queryClient.setQueryData<ProjectCost[]>(
        ['project-costs', 'by-project', String(projectId)],
        (currentCosts) =>
          currentCosts?.map((cost) => (cost.id === updatedCost.id ? updatedCost : cost)),
      );
      void queryClient.invalidateQueries({ queryKey: ['project-costs'] });
      notify.success('Đã cập nhật trạng thái khoản chi');
    },
    onError: (error) =>
      notify.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái khoản chi')),
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
        <TabActionButton startIcon={<AddRoundedIcon />} onClick={openCreate} disabled={!canManage}>
          {entryType === 'ad_spend' ? 'Thêm lần nạp' : 'Thêm chi phí'}
        </TabActionButton>
      </div>

      <div className="overflow-x-auto">
        {entryType === 'ad_spend' ? (
          <table className="w-full min-w-[920px] table-fixed text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
              <tr>
                <th className="w-[13%] px-4 py-3">Ngày nạp</th>
                <th className="w-[20%] px-3 py-3">CID</th>
                <th className="w-[16%] px-3 py-3">Thẻ nạp</th>
                <th className="w-[13%] px-3 py-3 text-right">Đã nạp</th>
                <th className="w-[13%] px-3 py-3 text-right">Đã chạy</th>
                <th className="w-[13%] px-3 py-3 text-right">Hạn mức</th>
                <th className="w-[17%] px-3 py-3">Trạng thái</th>
                <th className="w-[5%] px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
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
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-mono font-bold text-slate-800">
                          {cost.cid || '-'}
                        </span>
                        {cost.cidIsDead ? (
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
                              Ngừng hoạt động
                            </span>
                            <span className="truncate text-xs font-bold tabular-nums text-rose-700">
                              Chạy {formatCurrency(moneyValue(cost.cidSpentAmount ?? cost.actualCostAmount))}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td
                      className="truncate px-3 py-3 text-slate-700"
                      title={getAdTopupCardLabel(cost.bankAccountOption)}
                    >
                      {getAdTopupCardLabel(cost.bankAccountOption)}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                      {formatCurrency(moneyValue(cost.totalAmount))}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-700">
                      {cost.cidIsDead ? formatCurrency(moneyValue(cost.cidSpentAmount ?? cost.actualCostAmount)) : '-'}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {cost.balanceStatus && cost.balanceStatus !== 'none' ? (
                        <span
                          className={
                            cost.balanceStatus === 'resolved'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                          title={
                            cost.balanceStatus === 'resolved'
                              ? 'Đã tự hoàn vào số tiền có thể nạp'
                              : 'Chờ xác nhận đối soát để hoàn hạn mức'
                          }
                        >
                          {formatCurrency(
                            cost.balanceStatus === 'resolved'
                              ? moneyValue(
                                  cost.releasedBalanceAmount ??
                                    cost.handledBalanceAmount ??
                                    cost.originalBalanceAmount,
                                )
                              : moneyValue(
                                  cost.remainingBalanceAmount ?? cost.originalBalanceAmount,
                                ),
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <InlineCostStatusSelect
                          cost={cost}
                          entryType={entryType}
                          loading={
                            statusMutation.isPending &&
                            statusMutation.variables?.cost.id === cost.id
                          }
                          disabled={
                            !canManage ||
                            Boolean(cost.reconciledAt) ||
                            (statusMutation.isPending &&
                              statusMutation.variables?.cost.id === cost.id)
                          }
                          onChange={(status) => statusMutation.mutate({ cost, status })}
                        />
                        {cost.reconciledAt ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                            title="Khoản chi đã đối soát"
                          >
                            <LockRoundedIcon className="!text-[14px]" />
                            Đã khớp
                          </span>
                        ) : null}
                        {balanceStatusBadge(cost)}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end">
                        <CostActionMenu
                          cost={cost}
                          canManage={canManage}
                          onEdit={() => openEdit(cost)}
                          onDelete={() => setDeleteTarget(cost)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[720px] table-fixed text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
              <tr>
                <th className="w-[14%] px-4 py-3">Ngày chi</th>
                <th className="w-[24%] px-3 py-3">Đối tác</th>
                <th className="w-[17%] px-3 py-3 text-right">Chi phí</th>
                <th className="w-[19%] px-3 py-3">Trạng thái</th>
                <th className="w-[21%] px-3 py-3">Ghi chú</th>
                <th className="w-[5%] px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleCosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-semibold text-slate-500">
                    Chưa có chi phí đối tác
                  </td>
                </tr>
              ) : (
                visibleCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {formatDate(cost.transactionDate)}
                    </td>
                    <td className="px-3 py-3">
                      <p
                        className="truncate font-bold text-slate-800"
                        title={partnerLabel(cost.partnerOption)}
                      >
                        {partnerLabel(cost.partnerOption)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                      {formatCurrency(moneyValue(cost.amountBeforeVat))}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <InlineCostStatusSelect
                          cost={cost}
                          entryType={entryType}
                          loading={
                            statusMutation.isPending &&
                            statusMutation.variables?.cost.id === cost.id
                          }
                          disabled={
                            !canManage ||
                            Boolean(cost.reconciledAt) ||
                            (statusMutation.isPending &&
                              statusMutation.variables?.cost.id === cost.id)
                          }
                          onChange={(status) => statusMutation.mutate({ cost, status })}
                        />
                        {cost.reconciledAt ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                            title="Khoản chi đã đối soát"
                          >
                            <LockRoundedIcon className="!text-[14px]" />
                            Đã khớp
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-slate-500" title={cost.note || ''}>
                        {cost.note || '-'}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end">
                        <CostActionMenu
                          cost={cost}
                          canManage={canManage}
                          onEdit={() => openEdit(cost)}
                          onDelete={() => setDeleteTarget(cost)}
                        />
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
        topupCards={topupCards}
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
