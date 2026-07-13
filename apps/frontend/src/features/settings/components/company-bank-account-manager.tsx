'use client';

import { useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { Checkbox, FormControlLabel, IconButton, Menu, MenuItem } from '@mui/material';
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
  getBankAccountBankCode,
  getBankAccountMetaBoolean,
  getBankAccountMetaValue,
  getCompanyBankAccountDefaults,
  type CompanyBankAccountFormValues,
} from '@/lib/company-bank-account-options';
import type { AppOption } from '@/types/option';

type BankAccountManagerProps = {
  accounts: AppOption[];
  keyword: string;
  isFetching: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (values: CompanyBankAccountFormValues, account?: AppOption | null) => Promise<unknown>;
  onDelete: (account: AppOption) => void;
};

type DialogState = { mode: 'create'; account?: null } | { mode: 'edit'; account: AppOption };

function BankAccountDialog({
  state,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  state: DialogState | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CompanyBankAccountFormValues, account?: AppOption | null) => Promise<unknown>;
}) {
  const account = state?.mode === 'edit' ? state.account : null;
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CompanyBankAccountFormValues>({
    values: getCompanyBankAccountDefaults(account),
  });
  const isDefault = watch('isDefault');
  const bankCode = watch('bankCode');
  const bankName = watch('bankName');

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <AppFormDialog
      open={Boolean(state)}
      title={state?.mode === 'edit' ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản nhận tiền'}
      maxWidth="sm"
      submitting={isSubmitting}
      contentClassName="space-y-4"
      onClose={closeDialog}
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, account);
          closeDialog();
        } catch (error) {
          applyApiErrorsToForm(error, setError);
        }
      })}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={closeDialog}>
            Hủy
          </DialogActionButton>
          <DialogActionButton type="submit" tone="primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Đang lưu...'
              : state?.mode === 'edit'
                ? 'Lưu thay đổi'
                : 'Tạo tài khoản'}
          </DialogActionButton>
        </>
      }
    >
      <input type="hidden" {...register('bankCode', { required: 'Bắt buộc' })} />
      <input type="hidden" {...register('bankName')} />
      <VietQrBankSelect
        required
        valueCode={bankCode}
        valueName={bankName}
        onChange={(bank) => {
          setValue('bankCode', bank?.code || '', { shouldDirty: true, shouldValidate: true });
          setValue('bankName', bank?.name || '', { shouldDirty: true });
        }}
        error={Boolean(errors.bankCode)}
        helperText={errors.bankCode?.message}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInputField
          label="Số tài khoản *"
          error={Boolean(errors.accountNo)}
          helperText={errors.accountNo?.message}
          {...register('accountNo', { required: 'Vui lòng nhập số tài khoản' })}
        />
        <FormInputField
          label="Tên chủ tài khoản *"
          error={Boolean(errors.accountName)}
          helperText={errors.accountName?.message}
          {...register('accountName', { required: 'Vui lòng nhập tên chủ tài khoản' })}
        />
      </div>

      <FormInputField label="Chi nhánh" {...register('branch')} />
      <FormControlLabel
        className="!m-0 min-h-10 rounded-lg border border-slate-200 px-2"
        control={
          <Checkbox
            checked={Boolean(isDefault)}
            onChange={(event) => setValue('isDefault', event.target.checked, { shouldDirty: true })}
          />
        }
        label={<span className="text-sm font-semibold text-slate-700">Tài khoản mặc định</span>}
      />
    </AppFormDialog>
  );
}

export function CompanyBankAccountManager({
  accounts,
  keyword,
  isFetching,
  isSubmitting,
  isDeleting,
  onKeywordChange,
  onSubmit,
  onDelete,
}: BankAccountManagerProps) {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppOption | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeAccount, setActiveAccount] = useState<AppOption | null>(null);
  const { pageItems, page, setPage, totalPages, totalItems, pageSize } = usePagination(accounts, {
    resetKey: keyword,
  });

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, account: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveAccount(account);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveAccount(null);
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Tài khoản nhận tiền"
        action={{
          label: 'Thêm tài khoản',
          icon: <AddRoundedIcon />,
          onClick: () => setDialogState({ mode: 'create' }),
        }}
      />

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <CompactSearchField
            label="Từ khóa"
            placeholder="Tìm ngân hàng, số tài khoản, chủ tài khoản..."
            value={keyword}
            onChange={onKeywordChange}
          />
        </div>

        <AppDataTable
          columns={[
            {
              key: 'bank',
              label: 'Ngân hàng',
              className: 'sticky left-0 z-20 w-64 bg-slate-100',
            },
            { key: 'account', label: 'Số tài khoản', className: 'w-48' },
            { key: 'owner', label: 'Chủ tài khoản', className: 'w-72' },
            { key: 'branch', label: 'Chi nhánh', className: 'w-56' },
            { key: 'default', label: 'Mặc định', className: 'w-32' },
            { key: 'actions', className: 'w-24' },
          ]}
          isLoading={isFetching}
          isEmpty={pageItems.length === 0}
          emptyText="Chưa có tài khoản nhận tiền"
          minWidthClassName="min-w-[1120px]"
        >
          {pageItems.map((account) => (
            <tr key={account.id} className="group hover:bg-slate-50/80">
              <td className="sticky left-0 z-10 bg-white px-3 py-4 group-hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {getBankAccountBankCode(account) || '-'}
                  </span>
                  <span
                    className="truncate font-semibold text-slate-800"
                    title={getBankAccountMetaValue(account, 'bankName')}
                  >
                    {getBankAccountMetaValue(account, 'bankName') || '-'}
                  </span>
                </div>
              </td>
              <td className="px-3 py-4 font-mono font-semibold tabular-nums text-slate-800">
                {account.value || '-'}
              </td>
              <td className="px-3 py-4">
                <span className="block truncate font-semibold text-slate-900" title={account.label}>
                  {account.label || '-'}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">
                <span className="block truncate" title={getBankAccountMetaValue(account, 'branch')}>
                  {getBankAccountMetaValue(account, 'branch') || '-'}
                </span>
              </td>
              <td className="px-3 py-4">
                {getBankAccountMetaBoolean(account, 'isDefault') ? (
                  <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                    Mặc định
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="py-4">
                <div className="flex items-center justify-end gap-1 pr-3">
                  <IconButton
                    size="small"
                    aria-label="Chỉnh sửa tài khoản nhận tiền"
                    title="Chỉnh sửa"
                    onClick={() => setDialogState({ mode: 'edit', account })}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Mở tác vụ tài khoản nhận tiền"
                    title="Tác vụ"
                    onClick={(event) => openActionMenu(event, account)}
                  >
                    <MoreVertRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </AppDataTable>

        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem
          onClick={() => {
            if (activeAccount) setDialogState({ mode: 'edit', account: activeAccount });
            closeActionMenu();
          }}
        >
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem
          className="text-rose-600"
          disabled={isDeleting}
          onClick={() => {
            if (activeAccount) setDeleteTarget(activeAccount);
            closeActionMenu();
          }}
        >
          <DeleteRoundedIcon fontSize="small" className="mr-2" />
          Xóa
        </MenuItem>
      </Menu>

      <BankAccountDialog
        state={dialogState}
        isSubmitting={isSubmitting}
        onClose={() => setDialogState(null)}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa tài khoản nhận tiền?"
        description={`Bạn có chắc muốn xóa tài khoản "${deleteTarget?.label || ''}"?`}
        confirmText="Xóa tài khoản"
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
