import type { AppOption } from '@/types/option';
import type { ServiceItem } from '@/types/service';

export const SERVICE_QUOTE_CONFIG_GROUP = 'service_quote_config';

export type QuoteChannelMode = 'single' | 'multi';

export type ManagementFeeRate = {
  label: string;
  min: number;
  max: number | null;
  single: number;
  multi: number;
};

export type SetupPackage = {
  key: string;
  label: string;
  price: number;
};

export type ServiceQuoteConfigMeta = {
  serviceRootId: string;
  serviceRootCode: string;
  enabled: boolean;
  managementFeeRates: ManagementFeeRate[];
  setupPackages: SetupPackage[];
};

export type ProjectRevenueGroup = '2.1' | '2.2';

export type ProjectRevenueGroupInfo = {
  group: ProjectRevenueGroup;
  pricingMode: 'management_fee' | 'quantity_price';
};

export function getProjectRevenueGroupInfo(enabled: boolean): ProjectRevenueGroupInfo {
  return enabled
    ? {
        group: '2.1',
        pricingMode: 'management_fee',
      }
    : {
        group: '2.2',
        pricingMode: 'quantity_price',
      };
}

export const DEFAULT_MANAGEMENT_FEE_RATES: ManagementFeeRate[] = [
  { label: 'Dưới 5 triệu', min: 0, max: 5000000, single: 25, multi: 25 },
  { label: 'Từ 5 - 10 triệu', min: 5000000, max: 10000000, single: 20, multi: 22 },
  { label: 'Từ 10 - 20 triệu', min: 10000000, max: 20000000, single: 18, multi: 20 },
  { label: 'Từ 20 - 50 triệu', min: 20000000, max: 50000000, single: 15, multi: 18 },
  { label: 'Từ 50 - 100 triệu', min: 50000000, max: 100000000, single: 12, multi: 15 },
  { label: 'Từ 100 - 200 triệu', min: 100000000, max: 200000000, single: 10, multi: 12 },
  { label: 'Trên 200 triệu', min: 200000000, max: null, single: 10, multi: 10 },
];

export const DEFAULT_SETUP_PACKAGES: SetupPackage[] = [
  { key: 'basic', label: 'Gói cơ bản', price: 1000000 },
  { key: 'advanced', label: 'Gói nâng cao', price: 1500000 },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRates(value: unknown): ManagementFeeRate[] {
  if (!Array.isArray(value)) return DEFAULT_MANAGEMENT_FEE_RATES;

  return DEFAULT_MANAGEMENT_FEE_RATES.map((defaultRate, index) => {
    const rate = isObject(value[index]) ? value[index] : {};

    return {
      label: typeof rate.label === 'string' && rate.label ? rate.label : defaultRate.label,
      min: toNumber(rate.min, defaultRate.min),
      max: rate.max === null ? null : toNumber(rate.max, defaultRate.max || 0),
      single: toNumber(rate.single, defaultRate.single),
      multi: toNumber(rate.multi, defaultRate.multi),
    };
  });
}

function normalizePackages(value: unknown): SetupPackage[] {
  if (!Array.isArray(value)) return DEFAULT_SETUP_PACKAGES;

  return DEFAULT_SETUP_PACKAGES.map((defaultPackage, index) => {
    const setupPackage = isObject(value[index]) ? value[index] : {};

    return {
      key:
        typeof setupPackage.key === 'string' && setupPackage.key
          ? setupPackage.key
          : defaultPackage.key,
      label:
        typeof setupPackage.label === 'string' && setupPackage.label
          ? setupPackage.label
          : defaultPackage.label,
      price: toNumber(setupPackage.price, defaultPackage.price),
    };
  });
}

export function getServiceQuoteConfigMeta(
  option: AppOption | null | undefined,
  rootService?: ServiceItem | null,
): ServiceQuoteConfigMeta {
  const meta = isObject(option?.meta) ? option.meta : {};

  return {
    serviceRootId:
      (typeof meta.serviceRootId === 'string' && meta.serviceRootId) ||
      (rootService?.id !== undefined && rootService?.id !== null ? String(rootService.id) : '') ||
      '',
    serviceRootCode:
      (typeof meta.serviceRootCode === 'string' && meta.serviceRootCode) ||
      rootService?.code ||
      option?.key ||
      '',
    enabled: typeof meta.enabled === 'boolean' ? meta.enabled : true,
    managementFeeRates: normalizeRates(meta.managementFeeRates),
    setupPackages: normalizePackages(meta.setupPackages),
  };
}

export function getConfigForRoot(configs: AppOption[], rootService?: ServiceItem | null) {
  if (!rootService) return null;

  return (
    configs.find((option) => {
      const meta = getServiceQuoteConfigMeta(option);
      return (
        meta.serviceRootId === String(rootService.id) ||
        meta.serviceRootCode === rootService.code ||
        option.key === rootService.code ||
        option.value === String(rootService.id)
      );
    }) || null
  );
}

export function toServiceQuoteConfigPayload(
  rootService: ServiceItem,
  meta: ServiceQuoteConfigMeta,
) {
  return {
    group: SERVICE_QUOTE_CONFIG_GROUP,
    key: rootService.code,
    value: String(rootService.id),
    label: `Bảng giá ${rootService.code} - ${rootService.name}`,
    meta: {
      ...meta,
      serviceRootId: String(rootService.id),
      serviceRootCode: rootService.code,
    },
    isActive: meta.enabled,
  };
}

export function findManagementFeeRate(
  rates: ManagementFeeRate[],
  budget: number,
): ManagementFeeRate {
  return (
    rates.find((rate) => budget >= rate.min && (rate.max === null || budget < rate.max)) ||
    rates[rates.length - 1] ||
    DEFAULT_MANAGEMENT_FEE_RATES[0]
  );
}

export function calculateManagementFee({
  budget,
  channelMode,
  rates,
}: {
  budget: number;
  channelMode: QuoteChannelMode;
  rates: ManagementFeeRate[];
}) {
  const rate = findManagementFeeRate(rates, budget);
  const percent = channelMode === 'multi' ? rate.multi : rate.single;

  return {
    rate,
    percent,
    amount: Math.round((budget * percent) / 100),
  };
}
