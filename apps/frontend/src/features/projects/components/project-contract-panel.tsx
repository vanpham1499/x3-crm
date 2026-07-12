'use client';

import { useState } from 'react';
import Link from 'next/link';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { MoneyInput } from '@/components/form/money-input';
import { getApiErrorMessage } from '@/lib/api-error';
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
  const recipientType: InvoiceRecipientType = contract?.invoiceRecipientType || 'customer';
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
    invoiceRecipientName:
      contract?.invoiceRecipientName || customerSnapshot.invoiceRecipientName,
    invoiceRepresentativeName:
      contract?.invoiceRepresentativeName || customerSnapshot.invoiceRepresentativeName,
    invoiceTaxCode: contract?.invoiceTaxCode || customerSnapshot.invoiceTaxCode,
    invoiceAddress: contract?.invoiceAddress || customerSnapshot.invoiceAddress,
    invoiceEmail: contract?.invoiceEmail || customerSnapshot.invoiceEmail,
    invoicePhone: contract?.invoicePhone || customerSnapshot.invoicePhone,
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
    <Dialog open={open} onClose={isSubmitting ? undefined : closeDialog} maxWidth="lg" fullWidth>
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">
          {contract ? 'Sửa hợp đồng' : 'Thêm hợp đồng'}
        </p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values, contract);
          closeDialog();
        })}
      >
        <DialogContent className="space-y-5 px-5 py-4">
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-950">Thông tin hợp đồng</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <TextField
                fullWidth
                label="Số hợp đồng *"
                error={Boolean(errors.contractNo)}
                helperText={errors.contractNo?.message}
                {...register('contractNo', { required: 'Bắt buộc' })}
              />
              <Controller
                name="contractStatusOptionId"
                control={control}
                render={({ field }) => (
                  <TextField select fullWidth label="Tình trạng hợp đồng" {...field}>
                    <MenuItem value="">Chưa chọn</MenuItem>
                    {statuses.map((status) => (
                      <MenuItem key={status.id} value={String(status.id)}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="quotationId"
                control={control}
                render={({ field }) => (
                  <TextField select fullWidth label="Báo phí liên quan" {...field}>
                    <MenuItem value="">Không gắn báo phí</MenuItem>
                    {quotations.map((quotation) => (
                      <MenuItem key={quotation.id} value={String(quotation.id)}>
                        {quotation.quotationCode || `Báo phí #${quotation.id}`}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="depositAmount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    fullWidth
                    label="Tiền đặt cọc"
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <TextField
                fullWidth
                type="date"
                label="Ngày ký"
                slotProps={{ inputLabel: { shrink: true } }}
                {...register('signedDate')}
              />
              <TextField
                fullWidth
                type="date"
                label="Ngày hết hạn"
                slotProps={{ inputLabel: { shrink: true } }}
                {...register('expiredDate')}
              />
              <TextField fullWidth label="Thời hạn hợp đồng" {...register('contractMonth')} />
              <TextField fullWidth label="File hợp đồng" {...register('fileUrl')} />
              <TextField
                fullWidth
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
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  startIcon={<SwapHorizRoundedIcon />}
                  onClick={selectOtherRecipient}
                >
                  Xuất cho chủ thể khác
                </Button>
              ) : (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  onClick={selectCustomerRecipient}
                >
                  Lấy theo khách hàng
                </Button>
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
                <TextField
                  fullWidth
                  label="Tên chủ thể *"
                  error={Boolean(errors.invoiceRecipientName)}
                  helperText={errors.invoiceRecipientName?.message}
                  {...register('invoiceRecipientName', { required: 'Bắt buộc' })}
                />
                <TextField
                  fullWidth
                  label="Người đại diện"
                  {...register('invoiceRepresentativeName')}
                />
                <TextField fullWidth label="Mã số thuế" {...register('invoiceTaxCode')} />
                <TextField fullWidth label="Email nhận hóa đơn" {...register('invoiceEmail')} />
                <TextField fullWidth label="Số điện thoại" {...register('invoicePhone')} />
                <TextField
                  fullWidth
                  label="Địa chỉ xuất hóa đơn"
                  className="md:col-span-2 lg:col-span-2"
                  {...register('invoiceAddress')}
                />
              </div>
            )}
          </section>
        </DialogContent>

        <DialogActions className="border-t border-slate-100 px-5 py-3">
          <Button size="small" variant="outlined" onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            size="small"
            variant="contained"
            disabled={isSubmitting}
            className="!bg-slate-900 hover:!bg-slate-800"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu hợp đồng'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
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
  const queryKey = ['contracts', 'by-project', String(project.id)];

  const saveMutation = useMutation({
    mutationFn: ({ values, contract }: { values: ContractFormValues; contract?: Contract | null }) => {
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

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-950">Hợp đồng</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {contracts.length}
          </span>
        </div>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={openCreate}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm hợp đồng
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-slate-500">Dự án chưa có hợp đồng</p>
          <Button size="small" onClick={openCreate} className="!mt-2">
            Tạo hợp đồng đầu tiên
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Số hợp đồng</th>
                <th className="px-3 py-3">Báo phí</th>
                <th className="px-3 py-3">Tình trạng</th>
                <th className="px-3 py-3">Ngày ký / hết hạn</th>
                <th className="px-3 py-3">Chủ thể nhận hóa đơn</th>
                <th className="px-3 py-3 text-right">Tiền đặt cọc</th>
                <th className="px-3 py-3">File</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-bold text-slate-950">
                    {contract.contractNo || `#${contract.id}`}
                  </td>
                  <td className="px-3 py-3 font-semibold text-blue-700">
                    {contract.quotation?.quotationCode || '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                      {contract.contractStatusOption?.label || 'Chưa chọn'}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-700">
                    {formatDate(contract.signedDate)} → {formatDate(contract.expiredDate)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-bold text-slate-800">
                      {contract.invoiceRecipientName || customer?.companyName || customer?.customerName || '-'}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        contract.invoiceRecipientType === 'other'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {contract.invoiceRecipientType === 'other' ? 'Chủ thể khác' : 'Theo khách hàng'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-extrabold tabular-nums text-slate-950">
                    {formatCurrency(Number(contract.depositAmount) || 0)}
                  </td>
                  <td className="px-3 py-3">
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
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <IconButton size="small" title="Sửa" onClick={() => openEdit(contract)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Xóa"
                        onClick={() => setDeleteTarget(contract)}
                      >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
