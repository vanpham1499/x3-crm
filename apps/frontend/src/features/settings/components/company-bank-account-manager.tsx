'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import {
  getBankAccountMetaBoolean,
  getBankAccountMetaValue,
  getBankAccountBankCode,
  getCompanyBankAccountDefaults,
  type CompanyBankAccountFormValues,
} from '@/lib/company-bank-account-options';
import { fetchVietQrBanks, getVietQrBankLabel } from '@/lib/vietqr-banks';
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
    formState: { errors },
  } = useForm<CompanyBankAccountFormValues>({
    values: getCompanyBankAccountDefaults(account),
  });
  const isDefault = watch('isDefault');
  const bankCode = watch('bankCode');
  const { data: vietQrBanks = [], isFetching: isBanksFetching } = useQuery({
    queryKey: ['vietqr-banks'],
    queryFn: fetchVietQrBanks,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const selectedBank = vietQrBanks.find((bank) => bank.code === bankCode) || null;

  const closeDialog = () => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={Boolean(state)}
      onClose={isSubmitting ? undefined : closeDialog}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="border-b border-slate-100 px-5 py-4">
        <p className="text-base font-bold text-slate-950">
          {state?.mode === 'edit' ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản nhận tiền'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Danh sách ngân hàng được tải trực tiếp từ VietQR để tránh sai mã khi tạo QR.
        </p>
      </DialogTitle>

      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values, account);
          closeDialog();
        })}
      >
        <DialogContent className="grid gap-3 px-5 py-4">
          <input type="hidden" {...register('bankCode', { required: 'Bắt buộc' })} />
          <input type="hidden" {...register('bankName')} />
          <Autocomplete
            options={vietQrBanks}
            value={selectedBank}
            loading={isBanksFetching}
            onChange={(_, bank) => {
              setValue('bankCode', bank?.code || '', { shouldDirty: true, shouldValidate: true });
              setValue('bankName', bank?.name || '', { shouldDirty: true });
            }}
            getOptionLabel={getVietQrBankLabel}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            loadingText="Đang tải ngân hàng VietQR..."
            noOptionsText={isBanksFetching ? 'Đang tải ngân hàng VietQR...' : 'Không có ngân hàng'}
            renderOption={(props, bank) => (
              <li {...props} key={bank.code}>
                <div className="flex min-w-0 items-center gap-3">
                  {bank.logo ? (
                    <img
                      src={bank.logo}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-contain"
                    />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full bg-slate-100" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">
                      {bank.shortName || bank.code}
                    </p>
                    <p className="truncate text-xs text-slate-500">{bank.name}</p>
                  </div>
                </div>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Ngân hàng"
                error={Boolean(errors.bankCode)}
                helperText={
                  errors.bankCode?.message || 'Mã VietQR sẽ được tự lấy từ ngân hàng đã chọn.'
                }
              />
            )}
          />
          <TextField
            fullWidth
            label="Số tài khoản *"
            error={Boolean(errors.accountNo)}
            helperText={errors.accountNo?.message}
            {...register('accountNo', { required: 'Bắt buộc' })}
          />
          <TextField
            fullWidth
            label="Tên chủ tài khoản *"
            error={Boolean(errors.accountName)}
            helperText={errors.accountName?.message}
            {...register('accountName', { required: 'Bắt buộc' })}
          />
          <TextField fullWidth label="Chi nhánh" {...register('branch')} />
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(isDefault)}
                onChange={(event) => setValue('isDefault', event.target.checked)}
              />
            }
            label="Đặt làm tài khoản mặc định cho báo giá"
          />
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
            {isSubmitting
              ? 'Đang lưu...'
              : state?.mode === 'edit'
                ? 'Lưu thay đổi'
                : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
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

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, account: AppOption) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveAccount(account);
  };

  const closeActionMenu = () => {
    setMenuAnchorEl(null);
    setActiveAccount(null);
  };

  const editActiveAccount = () => {
    if (activeAccount) setDialogState({ mode: 'edit', account: activeAccount });
    closeActionMenu();
  };

  const deleteActiveAccount = () => {
    if (activeAccount) setDeleteTarget(activeAccount);
    closeActionMenu();
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Tài khoản nhận tiền</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Dashboard</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>Cài đặt</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-slate-950">Tài khoản nhận tiền</span>
          </div>
        </div>

        <Button
          type="button"
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogState({ mode: 'create' })}
          className="!bg-slate-900 hover:!bg-slate-800"
        >
          Thêm tài khoản
        </Button>
      </div>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <TextField
            fullWidth
            label="Từ khóa"
            placeholder="Tìm mã ngân hàng, số tài khoản, chủ tài khoản..."
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </div>

        <div className="relative w-full overflow-x-auto">
          {isFetching && (
            <div className="absolute left-0 right-0 top-0 z-30">
              <LinearProgress color="primary" />
            </div>
          )}

          <table
            className={`w-full min-w-[980px] table-fixed text-left text-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
          >
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="w-32 px-5 py-4">Mã NH</th>
                <th className="w-44 px-5 py-4">Số tài khoản</th>
                <th className="w-[280px] px-5 py-4">Chủ tài khoản</th>
                <th className="w-52 px-5 py-4">Ngân hàng</th>
                <th className="px-5 py-4">Chi nhánh</th>
                <th className="w-28 px-5 py-4">Mặc định</th>
                <th className="w-20 px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                  >
                    Chưa có tài khoản nhận tiền
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-bold text-slate-950">
                      {getBankAccountBankCode(account) || '-'}
                    </td>
                    <td className="px-5 py-4 font-semibold tabular-nums text-slate-800">
                      {account.value || '-'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      <span className="block truncate" title={account.label}>
                        {account.label || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span
                        className="block truncate"
                        title={getBankAccountMetaValue(account, 'bankName')}
                      >
                        {getBankAccountMetaValue(account, 'bankName') || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <span
                        className="block truncate"
                        title={getBankAccountMetaValue(account, 'branch')}
                      >
                        {getBankAccountMetaValue(account, 'branch') || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {getBankAccountMetaBoolean(account, 'isDefault') ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Có
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <IconButton
                          size="small"
                          title="Tác vụ"
                          onClick={(event) => openActionMenu(event, account)}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
          Hiển thị <strong className="text-slate-950">{accounts.length}</strong> tài khoản
        </div>
      </section>

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeActionMenu}>
        <MenuItem onClick={editActiveAccount}>
          <EditRoundedIcon fontSize="small" className="mr-2 text-slate-500" />
          Chỉnh sửa
        </MenuItem>
        <MenuItem onClick={deleteActiveAccount} className="text-rose-600" disabled={isDeleting}>
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
