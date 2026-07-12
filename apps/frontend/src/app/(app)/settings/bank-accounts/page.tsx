'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { CompanyBankAccountManager } from '@/features/settings/components/company-bank-account-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  COMPANY_BANK_ACCOUNT_OPTION_GROUP,
  getBankAccountBankCode,
  getBankAccountMetaValue,
  toCompanyBankAccountPayload,
  type CompanyBankAccountFormValues,
} from '@/lib/company-bank-account-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

function matchesKeyword(account: AppOption, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) return true;

  return [
    account.key,
    getBankAccountBankCode(account),
    account.label,
    account.value,
    getBankAccountMetaValue(account, 'bankName'),
    getBankAccountMetaValue(account, 'branch'),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
}

export default function CompanyBankAccountsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [keyword, setKeyword] = useState('');

  const {
    data: options = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: COMPANY_BANK_ACCOUNT_OPTION_GROUP } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const accounts = useMemo(
    () => options.filter((account) => matchesKeyword(account, keyword)),
    [keyword, options],
  );

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      account,
    }: {
      values: CompanyBankAccountFormValues;
      account?: AppOption | null;
    }) => {
      const payload = toCompanyBankAccountPayload(
        values,
        account?.sortOrder ?? (options.length + 1) * 10,
      );

      const savedAccount = account
        ? await api
            .put<AppOption>(`/options/${account.id}`, payload)
            .then((response) => response.data)
        : await api.post<AppOption>('/options', payload).then((response) => response.data);

      if (values.isDefault) {
        await Promise.all(
          options
            .filter((item) => item.id !== savedAccount.id && item.meta?.isDefault === true)
            .map((item) =>
              api.put<AppOption>(
                `/options/${item.id}`,
                toCompanyBankAccountPayload(
                  {
                    bankCode: getBankAccountBankCode(item),
                    accountNo: item.value || '',
                    accountName: item.label || '',
                    bankName: getBankAccountMetaValue(item, 'bankName'),
                    branch: getBankAccountMetaValue(item, 'branch'),
                    isDefault: false,
                  },
                  item.sortOrder,
                ),
              ),
            ),
        );
      }

      return savedAccount;
    },
    onSuccess: (savedAccount, variables) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP],
        (current = []) => {
          const normalizedCurrent = variables.values.isDefault
            ? current.map((account) =>
                account.id === savedAccount.id
                  ? account
                  : { ...account, meta: { ...account.meta, isDefault: false } },
              )
            : current;

          if (variables.account) {
            return normalizedCurrent.map((account) =>
              account.id === savedAccount.id ? savedAccount : account,
            );
          }

          return normalizedCurrent.some((account) => account.id === savedAccount.id)
            ? normalizedCurrent.map((account) =>
                account.id === savedAccount.id ? savedAccount : account,
              )
            : [...normalizedCurrent, savedAccount];
        },
      );
      queryClient.invalidateQueries({ queryKey: ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP] });
      notify.success(
        variables.account
          ? 'Cập nhật tài khoản nhận tiền thành công'
          : 'Tạo tài khoản nhận tiền thành công',
      );
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu tài khoản nhận tiền thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (account: AppOption) => api.delete(`/options/${account.id}`),
    onSuccess: (_response, deletedAccount) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP],
        (current = []) => current.filter((account) => account.id !== deletedAccount.id),
      );
      notify.success('Xóa tài khoản nhận tiền thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa tài khoản nhận tiền thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <CompanyBankAccountManager
      accounts={accounts}
      keyword={keyword}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onKeywordChange={setKeyword}
      onSubmit={(values, account) => saveMutation.mutateAsync({ values, account })}
      onDelete={(account) => deleteMutation.mutate(account)}
    />
  );
}
