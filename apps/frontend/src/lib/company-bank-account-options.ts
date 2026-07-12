import type { AppOption } from '@/types/option';

export const COMPANY_BANK_ACCOUNT_OPTION_GROUP = 'company_bank_account';

export type CompanyBankAccount = {
  id: string;
  bankCode: string;
  accountNo: string;
  accountName: string;
  bankName: string;
  branch: string;
  isDefault: boolean;
  option: AppOption;
};

export type CompanyBankAccountFormValues = {
  bankCode: string;
  accountNo: string;
  accountName: string;
  bankName: string;
  branch: string;
  isDefault: boolean;
};

export function getBankAccountMetaValue(
  option: AppOption,
  key: 'bankCode' | 'bankName' | 'branch',
) {
  const value = option.meta?.[key];
  return typeof value === 'string' ? value : '';
}

export function getBankAccountBankCode(option: AppOption) {
  return getBankAccountMetaValue(option, 'bankCode') || option.key?.split('_')[0] || '';
}

export function getBankAccountMetaBoolean(option: AppOption, key: 'isDefault') {
  return option.meta?.[key] === true;
}

export function getCompanyBankAccountDefaults(
  option?: AppOption | null,
): CompanyBankAccountFormValues {
  return {
    bankCode: option ? getBankAccountBankCode(option) : '',
    accountNo: option?.value || '',
    accountName: option?.label || '',
    bankName: option ? getBankAccountMetaValue(option, 'bankName') : '',
    branch: option ? getBankAccountMetaValue(option, 'branch') : '',
    isDefault: option ? getBankAccountMetaBoolean(option, 'isDefault') : false,
  };
}

export function toCompanyBankAccountPayload(
  values: CompanyBankAccountFormValues,
  sortOrder?: number | null,
) {
  const bankCode = values.bankCode.trim().toUpperCase();
  const accountNo = values.accountNo.trim();

  return {
    group: COMPANY_BANK_ACCOUNT_OPTION_GROUP,
    key: `${bankCode}_${accountNo}`.replace(/[^A-Z0-9_]/g, ''),
    label: values.accountName.trim(),
    value: accountNo,
    sortOrder: sortOrder ?? undefined,
    meta: {
      bankCode,
      bankName: values.bankName.trim(),
      branch: values.branch.trim(),
      isDefault: values.isDefault,
    },
    isActive: true,
  };
}

export function companyBankAccountFromOption(option: AppOption): CompanyBankAccount {
  return {
    id: String(option.id),
    bankCode: getBankAccountBankCode(option),
    accountNo: option.value || '',
    accountName: option.label || '',
    bankName: getBankAccountMetaValue(option, 'bankName'),
    branch: getBankAccountMetaValue(option, 'branch'),
    isDefault: getBankAccountMetaBoolean(option, 'isDefault'),
    option,
  };
}

export function getCompanyBankAccounts(options: AppOption[]) {
  return options
    .filter((option) => option.isActive !== false)
    .map(companyBankAccountFromOption)
    .filter((account) => account.bankCode && account.accountNo);
}

export function getDefaultCompanyBankAccount(options: AppOption[]) {
  const accounts = getCompanyBankAccounts(options);

  return accounts.find((account) => account.isDefault) || accounts[0] || null;
}

export function getVietQrUrl({
  account,
  amount,
  addInfo,
}: {
  account: CompanyBankAccount;
  amount: number;
  addInfo: string;
}) {
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo,
    accountName: account.accountName,
  });

  return `https://img.vietqr.io/image/${account.bankCode}-${account.accountNo}-compact2.png?${params.toString()}`;
}
