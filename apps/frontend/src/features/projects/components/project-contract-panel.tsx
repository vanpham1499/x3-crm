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
import dayjs from 'dayjs';
import { Controller, useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ExternalLinkAdornment } from '@/components/form/external-link-adornment';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSelectField } from '@/components/form/form-select-field';
import { AppDataTable } from '@/components/table/app-data-table';
import { applyApiErrorsToForm, getApiErrorMessage } from '@/lib/api-error';
import { canEditProject } from '@/lib/ownership';
import { getOptionColor } from '@/lib/option-utils';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
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
    invoiceEmail: customer?.invoiceEmail || customer?.email || '',
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
    signedDate: contract ? contract.signedDate || '' : dayjs().format('YYYY-MM-DD'),
    expiredDate: contract?.expiredDate || '',
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

function getQuotationDeposit(contract: Contract, quotations: Quotation[]) {
  if (!contract.quotationId) return 0;

  const quotation = quotations.find((item) => item.id === contract.quotationId);
  return Number(quotation?.depositAmount ?? contract.quotation?.depositAmount ?? 0) || 0;
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
  const fileUrlValue = watch('fileUrl');
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
            name="signedDate"
            control={control}
            render={({ field }) => (
              <FormDatePicker label="Ngày ký" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="expiredDate"
            control={control}
            render={({ field }) => (
              <FormDatePicker
                label="Ngày hết hạn"
                value={field.value}
                min={watch('signedDate') || undefined}
                onChange={field.onChange}
              />
            )}
          />
          <FormInputField
            label="File hợp đồng"
            placeholder="https://drive.google.com/..."
            slotProps={{
              input: {
                endAdornment: (
                  <ExternalLinkAdornment
                    value={fileUrlValue}
                    ariaLabel="Mở file hợp đồng trong tab mới"
                  />
                ),
              },
            }}
            {...register('fileUrl')}
          />
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
            <FormInputField
              label="Tên chủ thể *"
              className="lg:col-span-4"
              error={Boolean(errors.invoiceRecipientName)}
              helperText={errors.invoiceRecipientName?.message}
              {...register('invoiceRecipientName', { required: 'Bắt buộc' })}
            />
            <FormInputField
              label="Người đại diện"
              className="lg:col-span-4"
              {...register('invoiceRepresentativeName')}
            />
            <FormInputField
              label="Mã số thuế"
              className="lg:col-span-4"
              {...register('invoiceTaxCode')}
            />
            <FormInputField
              label="Email nhận hóa đơn"
              className="lg:col-span-4"
              {...register('invoiceEmail')}
            />
            <FormInputField
              label="Số điện thoại"
              className="lg:col-span-3"
              {...register('invoicePhone')}
            />
            <FormInputField
              label="Địa chỉ xuất hóa đơn"
              className="lg:col-span-5"
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
  const currentUser = useAuthStore((state) => state.user);
  const canManage = canEditProject(currentUser, project);
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
        signedDate: values.signedDate || null,
        expiredDate: values.expiredDate || null,
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
        <TabActionButton startIcon={<AddRoundedIcon />} onClick={openCreate} disabled={!canManage}>
          Thêm hợp đồng
        </TabActionButton>
      </div>

      <AppDataTable
        columns={[
          {
            key: 'contract',
            label: 'Hợp đồng',
            className: 'sticky left-0 z-20 w-[210px] bg-slate-100',
          },
          { key: 'quotation', label: 'Báo phí', className: 'w-[250px]' },
          { key: 'status', label: 'Tình trạng', className: 'w-[140px]' },
          { key: 'signedDate', label: 'Ngày ký', className: 'w-[115px]' },
          { key: 'expiredDate', label: 'Ngày hết hạn', className: 'w-[125px]' },
          { key: 'recipient', label: 'Chủ thể nhận hóa đơn', className: 'w-[290px]' },
          { key: 'deposit', label: 'Tiền cọc', className: 'w-[140px] text-right' },
          { key: 'file', label: 'File', className: 'w-[90px]' },
          { key: 'actions', className: 'w-[88px]' },
        ]}
        isEmpty={contracts.length === 0}
        emptyText="Dự án chưa có hợp đồng"
        minWidthClassName="min-w-[1450px]"
      >
        {contracts.map((contract) => (
          <tr key={contract.id} className="group hover:bg-slate-50/80">
            <td className="sticky left-0 z-10 bg-white px-3 py-3 group-hover:bg-slate-50">
              <p className="truncate font-bold text-slate-950" title={contract.contractNo || ''}>
                {contract.contractNo || `#${contract.id}`}
              </p>
            </td>
            <td className="px-3 py-3">
              {contract.quotation ? (
                <Link
                  href={`/quotations/${contract.quotation.id}`}
                  title={contract.quotation.quotationCode || ''}
                  className="block truncate font-bold text-emerald-700 hover:underline"
                >
                  {contract.quotation.quotationCode || `#${contract.quotation.id}`}
                </Link>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </td>
            <td className="whitespace-nowrap px-3 py-3">
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
            <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
              {formatDate(contract.signedDate)}
            </td>
            <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
              {formatDate(contract.expiredDate)}
            </td>
            <td className="px-3 py-3">
              <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
                <p
                  className="min-w-0 truncate font-bold text-slate-800"
                  title={contract.invoiceRecipientName || ''}
                >
                  {contract.invoiceRecipientName ||
                    customer?.companyName ||
                    customer?.customerName ||
                    '-'}
                </p>
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
                  <span className="min-w-0 truncate text-xs text-slate-500">
                    MST: {contract.invoiceTaxCode}
                  </span>
                ) : null}
              </div>
            </td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
              {formatCurrency(getQuotationDeposit(contract, quotations))}
            </td>
            <td className="whitespace-nowrap px-3 py-3">
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
            <td className="py-3">
              <div className="flex items-center justify-end gap-1 pr-3">
                <IconButton
                  size="small"
                  title="Sửa hợp đồng"
                  aria-label={`Sửa hợp đồng ${contract.contractNo || contract.id}`}
                  onClick={() => openEdit(contract)}
                  disabled={!canManage}
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
        <MenuItem onClick={editActiveContract} disabled={!canManage}>
          <EditOutlinedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          onClick={deleteActiveContract}
          className="text-rose-600"
          disabled={deleteMutation.isPending || !canManage}
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
