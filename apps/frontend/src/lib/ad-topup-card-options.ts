import type { AppOption } from '@/types/option';

export const AD_TOPUP_CARD_OPTION_GROUP = 'ad_topup_card';

export type AdTopupCardFormValues = {
  code: string;
  name: string;
  cardInfo: string;
  note: string;
};

export function getAdTopupCardMetaValue(option: AppOption, key: 'note') {
  const value = option.meta?.[key];
  return typeof value === 'string' ? value : '';
}

export function getAdTopupCardDefaults(option?: AppOption | null): AdTopupCardFormValues {
  return {
    code: option?.key || '',
    name: option?.label || '',
    cardInfo: option?.value && option.value !== option.key ? option.value : '',
    note: option ? getAdTopupCardMetaValue(option, 'note') : '',
  };
}

export function toAdTopupCardPayload(values: AdTopupCardFormValues) {
  return {
    group: AD_TOPUP_CARD_OPTION_GROUP,
    key: values.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, ''),
    label: values.name.trim(),
    value: values.cardInfo.trim(),
    meta: {
      note: values.note.trim(),
    },
    isActive: true,
  };
}

export function getAdTopupCardLabel(option: AppOption | null | undefined) {
  if (!option) return '-';

  const identity = [option.key, option.label].filter(Boolean).join(' - ');
  const cardInfo = option.value && option.value !== option.key ? option.value : '';
  return [identity, cardInfo].filter(Boolean).join(' · ') || '-';
}
