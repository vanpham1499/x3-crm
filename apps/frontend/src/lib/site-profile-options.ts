import type { AppOption } from '@/types/option';

export const SITE_PROFILE_OPTION_GROUP = 'site_profile';

export type SiteProfile = {
  companyName: string;
  taxCode: string;
  phone: string;
  website: string;
  address: string;
  office: string;
};

export type SiteProfileField = {
  key: keyof SiteProfile;
  label: string;
  multiline?: boolean;
};

export const SITE_PROFILE_FIELDS: SiteProfileField[] = [
  { key: 'companyName', label: 'Tên công ty' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'website', label: 'Website' },
  { key: 'address', label: 'Địa chỉ', multiline: true },
  { key: 'office', label: 'Văn phòng', multiline: true },
];

export const DEFAULT_SITE_PROFILE: SiteProfile = {
  companyName: 'CÔNG TY TNHH CHIẾN LƯỢC LIFEPOWER',
  taxCode: '0107658987',
  phone: '0947.861.399',
  website: 'x3sales.vn',
  address: 'Số 9, ngõ 7 đường Lê Đức Thọ, Phường Từ Liêm, Thành phố Hà Nội',
  office: 'S08A Landmark 2, KĐT Ecopark, Văn Giang, Hưng Yên',
};

export function siteProfileFromOptions(options: AppOption[]) {
  return SITE_PROFILE_FIELDS.reduce<SiteProfile>((profile, field) => {
    const option = options.find((item) => item.key === field.key);
    const value = option?.value || option?.label;

    return {
      ...profile,
      [field.key]: value || profile[field.key],
    };
  }, DEFAULT_SITE_PROFILE);
}

export function toSiteProfileOptionPayload(field: SiteProfileField, value: string, sortOrder: number) {
  return {
    group: SITE_PROFILE_OPTION_GROUP,
    key: field.key,
    label: field.label,
    value: value.trim(),
    sortOrder,
    isActive: true,
  };
}
