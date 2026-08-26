import type { AppOption } from '@/types/option';

export const PROJECT_PARTNER_OPTION_GROUP = 'project_partner';

export type ProjectPartnerFormValues = {
  code: string;
  name: string;
  accountNo: string;
  bankCode: string;
  bankName: string;
  service: string;
};

export function getPartnerMetaValue(option: AppOption, key: 'accountNo' | 'bankCode' | 'bankName') {
  const value = option.meta?.[key];
  return typeof value === 'string' ? value : '';
}

export function formatProjectPartnerIdentity(option?: AppOption | null, fallback = '-') {
  if (!option) return fallback;

  const code = option.key?.trim().toLocaleUpperCase('vi-VN') || '';
  const name = (option.label || option.value || '').trim();

  if (!code) return name || fallback;
  if (!name || name.toLocaleUpperCase('vi-VN') === code) return code;

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameWithoutLegacyCode = name.replace(new RegExp(`^${escapedCode}(?:[-.·\\s]+)`, 'iu'), '');

  return nameWithoutLegacyCode ? `${code} - ${nameWithoutLegacyCode}` : code;
}

export function getProjectPartnerDefaults(option?: AppOption | null): ProjectPartnerFormValues {
  return {
    code: option?.key || '',
    name: option?.label || '',
    accountNo: option ? getPartnerMetaValue(option, 'accountNo') : '',
    bankCode: option ? getPartnerMetaValue(option, 'bankCode') : '',
    bankName: option ? getPartnerMetaValue(option, 'bankName') : '',
    service: option?.value || '',
  };
}

export function toProjectPartnerPayload(values: ProjectPartnerFormValues) {
  return {
    group: PROJECT_PARTNER_OPTION_GROUP,
    key: values.code.trim(),
    label: values.name.trim(),
    value: values.service.trim(),
    meta: {
      accountNo: values.accountNo.trim(),
      bankCode: values.bankCode.trim().toUpperCase(),
      bankName: values.bankName.trim(),
    },
    isActive: true,
  };
}
