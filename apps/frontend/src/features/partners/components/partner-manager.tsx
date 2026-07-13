'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { useForm } from 'react-hook-form';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { FormInputField } from '@/components/form/form-input-field';
import { VietQrBankSelect } from '@/components/form/vietqr-bank-select';
import { PageHeader } from '@/components/shell/page-header';
import { AppDataTable } from '@/components/table/app-data-table';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import { usePagination } from '@/hooks/use-pagination';
import { applyApiErrorsToForm } from '@/lib/api-error';
import {
  getPartnerMetaValue,
  getProjectPartnerDefaults,
  type ProjectPartnerFormValues,
} from '@/lib/project-partner-options';
import type { AppOption } from '@/types/option';

type PartnerManagerProps = {
  partners: AppOption[];
  keyword: string;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (values: ProjectPartnerFormValues, partner?: AppOption | null) => Promise<unknown>;
  onDelete: (partner: AppOption) => void;
};

type DialogState = { mode: 'create'; partner?: null } | { mode: 'edit'; partner: AppOption };

function PartnerDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ProjectPartnerFormValues, partner?: AppOption | null) => Promise<unknown>;
}) {
  const partner = state?.mode === 'edit' ? state.partner : null;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectPartnerFormValues>({
    values: getProjectPartnerDefaults(partner),
  });
  const bankCode = watch('bankCode');
  const bankName = watch('bankName');

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={state?.mode === 'edit' ? 'Chỉnh sửa đối tác' : 'Thêm đối tác'}
      maxWidth="sm"
      submitting={isSubmitting}
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, partner);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      contentClassName="grid gap-3 sm:grid-cols-2"
      actions={
        <>
          <DialogActionButton onClick={closeDialog} disabled={isSubmitting}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : state?.mode === 'edit' ? 'Lưu thay đổi' : 'Tạo đối tác'}
          </DialogActionButton>
        </>
      }
    >
      <FormInputField
        label="Mã đối tác *"
        error={Boolean(errors.code)}
        helperText={errors.code?.message}
        {...register('code', { required: 'Bắt buộc' })}
      />
      <FormInputField
        label="Tên đối tác *"
        error={Boolean(errors.name)}
        helperText={errors.name?.message}
        {...register('name', { required: 'Bắt buộc' })}
      />
      <input type="hidden" {...register('bankCode')} />
      <input type="hidden" {...register('bankName')} />
      <VietQrBankSelect
        valueCode={bankCode}
        valueName={bankName}
        onChange={(bank) => {
          setValue('bankCode', bank?.code || '', { shouldDirty: true });
          setValue('bankName', bank?.name || '', { shouldDirty: true });
        }}
      />
      <FormInputField label="Số tài khoản" {...register('accountNo')} />
      <FormInputField label="Dịch vụ" className="sm:col-span-2" {...register('service')} />
    </AppFormDialog>
  );
}

export function PartnerManager({
  partners,
  keyword,
  isFetching,
  isSubmitting,
  isDeleting,
  onKeywordChange,
  onSubmit,
  onDelete,
}: PartnerManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activePartner, setActivePartner] = useState<AppOption | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(partners, {
    resetKey: keyword,
  });

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, partner: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActivePartner(partner);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActivePartner(null);
  };

  const deleteActivePartner = () => {
    if (activePartner) setDeleteTarget(activePartner);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Đối tác"
        action={{
          label: 'Thêm đối tác',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create' }),
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm mã đối tác, tên đối tác, STK, ngân hàng, dịch vụ..."
            value={keyword}
            onChange={onKeywordChange}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'code',
              label: 'Mã đối tác',
              className: 'sticky left-0 z-20 w-36 bg-slate-100',
            },
            { key: 'name', label: 'Tên đối tác', className: 'w-[260px]' },
            { key: 'account', label: 'STK', className: 'w-44' },
            { key: 'bank', label: 'Ngân hàng', className: 'w-52' },
            { key: 'service', label: 'Dịch vụ' },
            { key: 'actions', className: 'w-28' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Chưa có dữ liệu đối tác"
          minWidthClassName="min-w-[980px]"
        >
          {pageItems.map((partner) => (
            <tr key={partner.id} className="group hover:bg-slate-50/80">
              <td className="sticky left-0 z-10 bg-white px-3 py-4 font-bold text-slate-950 group-hover:bg-slate-50">
                <span className="block truncate" title={partner.key || ''}>
                  {partner.key || '-'}
                </span>
              </td>
              <td className="px-3 py-4 font-semibold text-slate-800">
                <span className="block truncate" title={partner.label}>
                  {partner.label || '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">
                <span className="block truncate" title={getPartnerMetaValue(partner, 'accountNo')}>
                  {getPartnerMetaValue(partner, 'accountNo') || '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">
                <span className="block truncate" title={getPartnerMetaValue(partner, 'bankName')}>
                  {getPartnerMetaValue(partner, 'bankName') || '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">
                <span className="block truncate" title={partner.value || ''}>
                  {partner.value || '-'}
                </span>
              </td>
              <td className="py-4">
                <div className="flex items-center justify-end gap-1 pr-3">
                  <IconButton
                    size="small"
                    title="Chỉnh sửa đối tác"
                    onClick={() => setDialogState({ mode: 'edit', partner })}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Tác vụ"
                    onClick={(event) => openActionMenu(event, partner)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </AppDataTable>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
          <MenuItem onClick={deleteActivePartner} className="text-rose-600" disabled={isDeleting}>
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa
          </MenuItem>
        </Menu>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <PartnerDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa đối tác?"
        description={`Bạn có chắc muốn xóa đối tác "${deleteTarget?.label || ''}"?`}
        confirmText="Xóa đối tác"
        loading={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
