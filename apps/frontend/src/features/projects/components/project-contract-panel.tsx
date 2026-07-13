'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
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
import { AppDataTable } from '@/components/table/app-data-table';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { getOptionColor } from '@/lib/option-utils';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import type { Contract, ContractFormValues, InvoiceRecipientType } from '@/types/contract';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';

function idToString(value?: string | number | null) {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function customerInvoiceSnapshot(customer?: Customer | null) {
  return {
    invoiceRecipientName: customer?.companyName || customer?.customerName || '',
    invoiceRepresentativeName: customer?.representativeName || '',
    invoiceTaxCode: customer?.taxCode || '',
    invoiceAddress: customer?.address || '',
    invoiceEmail: customer?.email || '',
    invoicePhone: customer?.phone || '',
  };
}

function getContractDefaults({
  contract,
  customer,
  project,
  quotations,
}: {
  contract?: Contract | null;
  customer?: Customer | null;
  project: ProjectItem;
  quotations: Quotation[];
}): ContractFormValues {
  const customerSnapshot = customerInvoiceSnapshot(customer);
  const recipientType: InvoiceRecipientType = 'customer';
  const defaultQuotationId =
    contract?.quotationId ||
    (project.quotationId && quotations.some((item) => item.id === project.quotationId)
      ? project.quotationId
      : quotations.length === 1
        ? quotations[0].id
        : null);

  return {
    quotationId: idToString(defaultQuotationId),
    contractNo: contract?.contractNo || project.projectCode || '',
    contractStatusOptionId: idToString(contract?.contractStatusOptionId),
    depositAmount: idToString(contract?.depositAmount),
    signedDate: contract?.signedDate || '',
    expiredDate: contract?.expiredDate || '',
    contractMonth: contract?.contractMonth || '',
    fileUrl: contract?.fileUrl || '',
    note: contract?.note || '',
    invoiceRecipientType: recipientType,
    invoiceRecipientName: customerSnapshot.invoiceRecipientName,
    invoiceRepresentativeName: customerSnapshot.invoiceRepresentativeName,
    invoiceTaxCode: customerSnapshot.invoiceTaxCode,
    invoiceAddress: customerSnapshot.invoiceAddress,
    invoiceEmail: customerSnapshot.invoiceEmail,
    invoicePhone: customerSnapshot.invoicePhone,
  };
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '-'}</p>
    </div>
  );
}

function ContractDialog({
  open,
  contract,
  project,
  customer,
  quotations,
  statuses,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  contract?: Contract | null;
  project: ProjectItem;
  customer?: Customer | null;
  quotations: Quotation[];
  statuses: AppOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ContractFormValues, contract?: Contract | null) => Promise<unknown>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<ContractFormValues>({
    values: getContractDefaults({ contract, customer, project, quotations }),
  });
  const recipientType = watch('invoiceRecipientType');
  const customerSnapshot = customerInvoiceSnapshot(customer);

  const closeDialog = () => {
    reset();
    onClose();
  };

  const selectCustomerRecipient = () => {
    setValue('invoiceRecipientType', 'customer', { shouldDirty: true });
    Object.entries(customerSnapshot).forEach(([field, value]) => {
      setValue(field as keyof ContractFormValues, value, { shouldDirty: true });
    });
  };

  const selectOtherRecipient = () => {
    setValue('invoiceRecipientType', 'other', { shouldDirty: true });
    if (recipientType !== 'other') {
      (
        [
          'invoiceRecipientName',
          'invoiceRepresentativeName',
          'invoiceTaxCode',
          'invoiceAddress',
          'invoiceEmail',
          'invoicePhone',
        ] as const
      ).forEach((field) => setValue(field, '', { shouldDirty: true }));
    }
  };

  return (
    <AppFormDialog
      open={open}
      title={contract ? 'Sửa hợp đồng' : 'Thêm hợp đồng'}
      maxWidth="lg"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, contract);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      contentClassName="space-y-5"
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu hợp đồng'}
          </DialogActionButton>
        </>
      }
    >
      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-950">Thông tin hợp đồng</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <FormInputField
            label="Số hợp đồng *"
            error={Boolean(errors.contractNo)}
            helperText={errors.contractNo?.message}
            {...register('contractNo', { required: 'Bắt buộc' })}
          />
          <Controller
            name="contractStatusOptionId"
            control={control}
            render={({ field }) => (
              <FormSelectField label="Tình trạng hợp đồng" {...field}>
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
          <Controller
            name="depositAmount"
            control={control}
            render={({ field }) => (
              <MoneyInput
                fullWidth
                size="small"
                label="Tiền đặt cọc"
                value={field.value}
                onValueChange={field.onChange}
                className={compactFormFieldClassName}
              />
            )}
          />
          <FormInputField
            type="date"
            label="Ngày ký"
            slotProps={{ inputLabel: { shrink: true } }}
            {...register('signedDate')}
          />
          <FormInputField
            type="date"
            label="Ngày hết hạn"
            slotProps={{ inputLabel: { shrink: true } }}
            {...register('expiredDate')}
          />
          <FormInputField label="Thời hạn hợp đồng" {...register('contractMonth')} />
          <FormInputField label="File hợp đồng" {...register('fileUrl')} />
          <FormInputField
            multiline
            minRows={2}
            label="Ghi chú"
            className="md:col-span-2 lg:col-span-3"
            {...register('note')}
          />
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-950">Chủ thể nhận hóa đơn</h3>
            <span
              className={`rounded-full px-2 py-1 text-xs font-bold ${
                recipientType === 'customer'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {recipientType === 'customer' ? 'Theo khách hàng' : 'Chủ thể khác'}
            </span>
          </div>
          {recipientType === 'customer' ? (
            <DialogActionButton startIcon={<SwapHorizRoundedIcon />} onClick={selectOtherRecipient}>
              Xuất cho chủ thể khác
            </DialogActionButton>
          ) : (
            <DialogActionButton onClick={selectCustomerRecipient}>
              Lấy theo khách hàng
            </DialogActionButton>
          )}
        </div>

        <input type="hidden" {...register('invoiceRecipientType')} />

        {recipientType === 'customer' ? (
          <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCell label="Tên chủ thể" value={watch('invoiceRecipientName')} />
            <InfoCell label="Người đại diện" value={watch('invoiceRepresentativeName')} />
            <InfoCell label="Mã số thuế" value={watch('invoiceTaxCode')} />
            <InfoCell label="Địa chỉ" value={watch('invoiceAddress')} />
            <InfoCell label="Email nhận HĐ" value={watch('invoiceEmail')} />
            <InfoCell label="Số điện thoại" value={watch('invoicePhone')} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <FormInputField
              label="Tên chủ thể *"
              error={Boolean(errors.invoiceRecipientName)}
              helperText={errors.invoiceRecipientName?.message}
              {...register('invoiceRecipientName', { required: 'Bắt buộc' })}
            />
            <FormInputField label="Người đại diện" {...register('invoiceRepresentativeName')} />
            <FormInputField label="Mã số thuế" {...register('invoiceTaxCode')} />
            <FormInputField label="Email nhận hóa đơn" {...register('invoiceEmail')} />
            <FormInputField label="Số điện thoại" {...register('invoicePhone')} />
            <FormInputField
              label="Địa chỉ xuất hóa đơn"
              className="md:col-span-2 lg:col-span-2"
              {...register('invoiceAddress')}
            />
          </div>
        )}
      </section>
    </AppFormDialog>
  );
}

export function ProjectContractPanel({
  project,
  customer,
  contracts,
  quotations,
  statuses,
}: {
  project: ProjectItem;
  customer?: Customer | null;
  contracts: Contract[];
  quotations: Quotation[];
  statuses: AppOption[];
}) {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const queryKey = ['contracts', 'by-project', String(project.id)];

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      contract,
    }: {
      values: ContractFormValues;
      contract?: Contract | null;
    }) => {
      const snapshot =
        values.invoiceRecipientType === 'customer'
          ? customerInvoiceSnapshot(customer)
          : {
              invoiceRecipientName: values.invoiceRecipientName.trim(),
              invoiceRepresentativeName: values.invoiceRepresentativeName.trim(),
              invoiceTaxCode: values.invoiceTaxCode.trim(),
              invoiceAddress: values.invoiceAddress.trim(),
              invoiceEmail: values.invoiceEmail.trim(),
              invoicePhone: values.invoicePhone.trim(),
            };
      const payload = {
        projectId: project.id,
        quotationId: values.quotationId ? Number(values.quotationId) : null,
        customerId: project.customerId,
        leadId: customer?.leadId || project.customer?.leadId || null,
        contractNo: values.contractNo.trim(),
        contractStatusOptionId: values.contractStatusOptionId
          ? Number(values.contractStatusOptionId)
          : null,
        depositAmount: Number(values.depositAmount) || 0,
        signedDate: values.signedDate || null,
        expiredDate: values.expiredDate || null,
        contractMonth: values.contractMonth.trim() || null,
        fileUrl: values.fileUrl.trim() || null,
        note: values.note.trim() || null,
        invoiceRecipientType: values.invoiceRecipientType,
        ...snapshot,
      };

      return contract
        ? api.put<Contract>(`/contracts/${contract.id}`, payload).then((response) => response.data)
        : api.post<Contract>('/contracts', payload).then((response) => response.data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['projects', String(project.id)] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify.success(variables.contract ? 'Đã cập nhật hợp đồng' : 'Đã tạo hợp đồng');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể lưu hợp đồng')),
  });

  const deleteMutation = useMutation({
    mutationFn: (contract: Contract) => api.delete(`/contracts/${contract.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify.success('Đã xóa hợp đồng');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa hợp đồng')),
  });

  const openCreate = () => {
    setEditingContract(null);
    setDialogOpen(true);
  };

  const openEdit = (contract: Contract) => {
    setEditingContract(contract);
    setDialogOpen(true);
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, contract: Contract) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveContract(contract);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveContract(null);
  };

  const editActiveContract = () => {
    if (activeContract) openEdit(activeContract);
    closeActionMenu();
  };

  const deleteActiveContract = () => {
    if (activeContract) setDeleteTarget(activeContract);
    closeActionMenu();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-950">Hợp đồng</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {contracts.length}
          </span>
        </div>
        <TabActionButton startIcon={<AddRoundedIcon />} onClick={openCreate}>
          Thêm hợp đồng
        </TabActionButton>
      </div>

      <AppDataTable
        columns={[
          {
            key: 'contract',
            label: 'Hợp đồng',
            className: 'sticky left-0 z-20 w-[220px] bg-slate-100',
          },
          { key: 'quotation', label: 'Báo phí', className: 'w-[150px]' },
          { key: 'status', label: 'Tình trạng', className: 'w-[150px]' },
          { key: 'signedDate', label: 'Ngày ký', className: 'w-[120px]' },
          { key: 'expiredDate', label: 'Ngày hết hạn', className: 'w-[140px]' },
          { key: 'recipient', label: 'Chủ thể nhận hóa đơn', className: 'w-[280px]' },
          { key: 'deposit', label: 'Tiền đặt cọc', className: 'w-[160px] text-right' },
          { key: 'file', label: 'File', className: 'w-[100px]' },
          { key: 'actions', className: 'w-24' },
        ]}
        isEmpty={contracts.length === 0}
        emptyText="Dự án chưa có hợp đồng"
        minWidthClassName="min-w-[1320px]"
      >
        {contracts.map((contract) => (
          <tr key={contract.id} className="group hover:bg-slate-50/80">
            <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
              <p className="truncate font-bold text-slate-950" title={contract.contractNo || ''}>
                {contract.contractNo || `#${contract.id}`}
              </p>
              {contract.contractMonth ? (
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                  Thời hạn: {contract.contractMonth}
                </p>
              ) : null}
            </td>
            <td className="px-3 py-4">
              {contract.quotation ? (
                <Link
                  href={`/quotations/${contract.quotation.id}`}
                  className="font-bold text-blue-700 hover:underline"
                >
                  {contract.quotation.quotationCode || `#${contract.quotation.id}`}
                </Link>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </td>
            <td className="px-3 py-4">
              <span
                className={`rounded-md border px-2 py-1 text-xs font-bold ${
                  contract.contractStatusOption
                    ? ''
                    : 'border-slate-200 bg-slate-100 text-slate-700'
                }`}
                style={
                  contract.contractStatusOption
                    ? {
                        color: getOptionColor(contract.contractStatusOption),
                        borderColor: `${getOptionColor(contract.contractStatusOption)}40`,
                        backgroundColor: `${getOptionColor(contract.contractStatusOption)}14`,
                      }
                    : undefined
                }
              >
                {contract.contractStatusOption?.label || 'Chưa chọn'}
              </span>
            </td>
            <td className="px-3 py-4 font-semibold text-slate-700">
              {formatDate(contract.signedDate)}
            </td>
            <td className="px-3 py-4 font-semibold text-slate-700">
              {formatDate(contract.expiredDate)}
            </td>
            <td className="px-3 py-4">
              <p
                className="truncate font-bold text-slate-800"
                title={contract.invoiceRecipientName || ''}
              >
                {contract.invoiceRecipientName ||
                  customer?.companyName ||
                  customer?.customerName ||
                  '-'}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    contract.invoiceRecipientType === 'other'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {contract.invoiceRecipientType === 'other' ? 'Chủ thể khác' : 'Theo khách hàng'}
                </span>
                {contract.invoiceTaxCode ? (
                  <span className="truncate text-xs text-slate-500">
                    MST: {contract.invoiceTaxCode}
                  </span>
                ) : null}
              </div>
            </td>
            <td className="px-3 py-4 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(Number(contract.depositAmount) || 0)}
            </td>
            <td className="px-3 py-4">
              {contract.fileUrl ? (
                <Link
                  href={contract.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Mở file
                </Link>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </td>
            <td className="py-4">
              <div className="flex items-center justify-end gap-1 pr-3">
                <IconButton
                  size="small"
                  title="Sửa hợp đồng"
                  aria-label={`Sửa hợp đồng ${contract.contractNo || contract.id}`}
                  onClick={() => openEdit(contract)}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title="Tác vụ"
                  aria-label={`Tác vụ hợp đồng ${contract.contractNo || contract.id}`}
                  onClick={(event) => openActionMenu(event, contract)}
                >
                  <MoreVertRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </td>
          </tr>
        ))}
      </AppDataTable>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem onClick={editActiveContract}>
          <EditOutlinedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          onClick={deleteActiveContract}
          className="text-rose-600"
          disabled={deleteMutation.isPending}
        >
          <DeleteOutlineRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <ContractDialog
        open={dialogOpen}
        contract={editingContract}
        project={project}
        customer={customer}
        quotations={quotations}
        statuses={statuses}
        isSubmitting={saveMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(values, contract) => saveMutation.mutateAsync({ values, contract })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa hợp đồng?"
        description={`Hợp đồng "${deleteTarget?.contractNo || ''}" sẽ bị xóa khỏi dự án.`}
        confirmText="Xóa hợp đồng"
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
