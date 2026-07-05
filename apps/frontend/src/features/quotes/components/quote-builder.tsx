'use client';

import { useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import { Autocomplete, Button, IconButton, MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { MoneyInput } from '@/components/form/money-input';
import {
  SERVICE_QUOTE_CONFIG_GROUP,
  calculateManagementFee,
  getConfigForRoot,
  getServiceQuoteConfigMeta,
  type QuoteChannelMode,
} from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import {
  SITE_PROFILE_OPTION_GROUP,
  siteProfileFromOptions,
} from '@/lib/site-profile-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ServiceItem } from '@/types/service';

type QuoteLine = {
  id: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  locked?: boolean;
};

type CalculatedQuoteLine = QuoteLine & {
  no: number;
  amount: number;
};

const BANK_INFO = {
  bankCode: 'BIDV',
  accountNo: '964620188789',
  accountName: 'Cong ty TNHH Chien Luoc LifePower',
  branch: 'BIDV - Chi nhánh Bắc Hưng Yên',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

function formatCurrency(value: number) {
  return `${formatMoney(value)} đ`;
}

function toNumber(value: string) {
  return Number(value.replace(/[^\d.-]/g, '')) || 0;
}

function getVietQrUrl({ amount, addInfo }: { amount: number; addInfo: string }) {
  const params = new URLSearchParams({
    amount: String(Math.max(0, Math.round(amount))),
    addInfo,
    accountName: BANK_INFO.accountName,
  });

  return `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNo}-compact2.png?${params.toString()}`;
}

function createQuoteLineId() {
  return `quote-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findRootService(services: ServiceItem[], serviceId: string): ServiceItem | null {
  const flatServices = flattenServices(services);
  const selected = flatServices.find((service) => service.id === serviceId);

  if (!selected) return null;
  if (!selected.parentId) return selected;

  return flatServices.find((service) => selected.pathName.startsWith(`${service.name} /`)) || null;
}

export function QuoteBuilder() {
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState('1 tháng');
  const [vatRate, setVatRate] = useState('0');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [channelMode, setChannelMode] = useState<QuoteChannelMode>('single');
  const [setupPackageKey, setSetupPackageKey] = useState('basic');
  const [budget, setBudget] = useState('0');
  const [manualLines, setManualLines] = useState<QuoteLine[]>([
    {
      id: 'quote-line-1',
      name: '',
      unit: 'Dịch vụ',
      quantity: '1',
      unitPrice: '0',
    },
  ]);

  const { data: siteProfileOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SITE_PROFILE_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SITE_PROFILE_OPTION_GROUP } })
        .then((response) => response.data),
  });

  const { data: services = [], isFetching: servicesFetching } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'quote-builder'],
    queryFn: () => api.get<ServiceItem[]>('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: quoteConfigs = [], isFetching: quoteConfigsFetching } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const companyInfo = useMemo(
    () => siteProfileFromOptions(siteProfileOptions),
    [siteProfileOptions],
  );
  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const selectedService = serviceOptions.find((service) => service.id === selectedServiceId) || null;
  const rootService = useMemo(
    () => findRootService(services, selectedServiceId),
    [selectedServiceId, services],
  );
  const rootConfigOption = getConfigForRoot(quoteConfigs, rootService);
  const rootConfig = rootConfigOption ? getServiceQuoteConfigMeta(rootConfigOption, rootService) : null;
  const canUseAutoQuote = Boolean(rootConfig?.enabled);
  const servicePricingLoading = servicesFetching || quoteConfigsFetching;
  const setupPackage =
    rootConfig?.setupPackages.find((item) => item.key === setupPackageKey) ||
    rootConfig?.setupPackages[0] ||
    null;
  const managementFee = rootConfig
    ? calculateManagementFee({
        budget: toNumber(budget),
        channelMode,
        rates: rootConfig.managementFeeRates,
      })
    : null;

  const autoLines: QuoteLine[] = canUseAutoQuote
    ? [
        {
          id: 'auto-budget',
          name: 'Ngân sách',
          unit: 'Tháng',
          quantity: '1',
          unitPrice: budget,
          locked: true,
        },
        {
          id: 'auto-management-fee',
          name: `Phí quản lý (${managementFee?.percent || 0}%)`,
          unit: 'Dịch vụ',
          quantity: '1',
          unitPrice: String(managementFee?.amount || 0),
          locked: true,
        },
        {
          id: 'auto-setup-fee',
          name: `Phí Setup${setupPackage ? ` - ${setupPackage.label}` : ''}`,
          unit: 'Lần',
          quantity: '1',
          unitPrice: String(setupPackage?.price || 0),
          locked: true,
        },
      ]
    : [];

  const quote = useMemo(() => {
    const allLines = [...autoLines, ...manualLines];
    const vatRateValue = toNumber(vatRate) / 100;
    const calculatedLines: CalculatedQuoteLine[] = allLines.map((line, index) => {
      const quantity = toNumber(line.quantity);
      const unitPrice = toNumber(line.unitPrice);

      return {
        ...line,
        no: index + 1,
        amount: quantity * unitPrice,
      };
    });
    const subtotal = calculatedLines.reduce((sum, line) => sum + line.amount, 0);
    const vatAmount = subtotal * vatRateValue;
    const total = subtotal + vatAmount;
    const transferContent = [
      'TT bao gia',
      customerName.trim() || 'Khach hang',
      `${formatMoney(total)} VND`,
    ].join(' - ');

    return {
      lines: calculatedLines,
      subtotal,
      vatAmount,
      total,
      transferContent,
      qrUrl: getVietQrUrl({ amount: total, addInfo: transferContent }),
    };
  }, [autoLines, customerName, manualLines, vatRate]);

  const addLine = () => {
    setManualLines((current) => [
      ...current,
      {
        id: createQuoteLineId(),
        name: '',
        unit: 'Dịch vụ',
        quantity: '1',
        unitPrice: '0',
      },
    ]);
  };

  const updateLine = (lineId: string, values: Partial<QuoteLine>) => {
    setManualLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...values } : line)),
    );
  };

  const deleteLine = (lineId: string) => {
    setManualLines((current) => {
      if (current.length === 1) return current;
      return current.filter((line) => line.id !== lineId);
    });
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mb-8 w-full">
        <h1 className="text-2xl font-bold text-slate-950">Báo giá</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Dự án</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Báo giá</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-5">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Thông tin báo giá</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chọn dịch vụ để tự áp dụng bảng phí nếu dịch vụ cha đã được cấu hình.
            </p>
          </div>

          <div className="space-y-4 p-6">
            <TextField
              fullWidth
              label="Khách hàng"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <TextField
              fullWidth
              label="Thời gian"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
            <TextField
              fullWidth
              label="VAT (%)"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
            />

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Autocomplete
                  options={serviceOptions}
                  value={selectedService}
                  loading={servicePricingLoading}
                  onChange={(_, value) => setSelectedServiceId(value?.id || '')}
                  getOptionLabel={(option) => `${option.code} - ${option.pathName}`}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  className="md:col-span-2"
                  loadingText="Đang tải dịch vụ..."
                  noOptionsText={servicePricingLoading ? 'Đang tải dịch vụ...' : 'Không có dịch vụ'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Dịch vụ"
                      helperText={servicePricingLoading ? 'Đang tải danh sách dịch vụ...' : undefined}
                    />
                  )}
                />
                {canUseAutoQuote && (
                  <>
                    <MoneyInput
                      fullWidth
                      label="Ngân sách"
                      value={budget}
                      onValueChange={setBudget}
                    />
                    <TextField
                      select
                      fullWidth
                      label="Loại kênh"
                      value={channelMode}
                      onChange={(event) => setChannelMode(event.target.value as QuoteChannelMode)}
                    >
                      <MenuItem value="single">Đơn kênh</MenuItem>
                      <MenuItem value="multi">Đa kênh</MenuItem>
                    </TextField>
                    <TextField
                      select
                      fullWidth
                      label="Gói setup"
                      value={setupPackageKey}
                      onChange={(event) => setSetupPackageKey(event.target.value)}
                      className="md:col-span-2"
                    >
                      {(rootConfig?.setupPackages || []).map((item) => (
                        <MenuItem key={item.key} value={item.key}>
                          {item.label} - {formatCurrency(item.price)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {servicePricingLoading
                  ? 'Đang tải danh sách dịch vụ và cấu hình bảng giá...'
                  : selectedService && !canUseAutoQuote
                  ? 'Dịch vụ cha chưa có cấu hình báo giá tự động.'
                  : rootService
                    ? `Đang áp dụng bảng giá của ${rootService.code} - ${rootService.name}.`
                    : 'Chọn dịch vụ để kiểm tra bảng giá tự động.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-950">Dòng báo giá thủ công</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Các dòng tự động sẽ được thêm trước nhóm dòng thủ công.
                  </p>
                </div>
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={addLine}
                  className="!bg-slate-900 hover:!bg-slate-800"
                >
                  Thêm
                </Button>
              </div>

              <div className="space-y-4 p-4">
                {manualLines.map((line, index) => (
                  <div key={line.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.7fr)_96px_86px_120px_38px]">
                      <TextField
                        fullWidth
                        label="Nội dung"
                        size="small"
                        value={line.name}
                        onChange={(event) => updateLine(line.id, { name: event.target.value })}
                      />
                      <TextField
                        fullWidth
                        label="ĐVT"
                        size="small"
                        value={line.unit}
                        onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                      />
                      <TextField
                        fullWidth
                        label="Số lần"
                        size="small"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                      />
                      <MoneyInput
                        fullWidth
                        label="Đơn giá"
                        size="small"
                        value={line.unitPrice}
                        onValueChange={(value) => updateLine(line.id, { unitPrice: value })}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        disabled={manualLines.length === 1}
                        onClick={() => deleteLine(line.id)}
                        title="Xóa dòng"
                        className="!mt-1"
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                    <div className="mt-2 text-right text-xs font-bold text-slate-500">
                      #{index + 1} · {formatCurrency(toNumber(line.quantity) * toNumber(line.unitPrice))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <div className="grid gap-6 border-b border-slate-200 p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mẫu báo giá</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
                Bảng báo giá dịch vụ quảng cáo
              </h2>
              <div className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                {`${companyInfo.companyName}\nMST: ${companyInfo.taxCode}\nPhone: ${companyInfo.phone}\nWebsite: ${companyInfo.website}\nĐịa chỉ: ${companyInfo.address}\nVăn phòng: ${companyInfo.office}`}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <QrCode2RoundedIcon fontSize="small" />
                VietQR thanh toán
              </div>
              <img
                src={quote.qrUrl}
                alt="Mã VietQR chuyển khoản"
                className="mt-3 aspect-square w-full rounded-xl bg-white object-contain p-2"
              />
              <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                {BANK_INFO.bankCode} - {BANK_INFO.accountNo}
                <br />
                {BANK_INFO.accountName}
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-500">Khách hàng</p>
                <p className="mt-1 font-bold text-slate-950">{customerName || '-'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-500">Thời gian</p>
                <p className="mt-1 font-bold text-slate-950">{duration || '-'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-500">Tổng thanh toán</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(quote.total)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="w-16 px-4 py-3">STT</th>
                    <th className="px-4 py-3">Nội dung</th>
                    <th className="w-28 px-4 py-3">ĐVT</th>
                    <th className="w-24 px-4 py-3 text-right">Số lần</th>
                    <th className="w-40 px-4 py-3 text-right">Đơn giá</th>
                    <th className="w-40 px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.lines.map((line) => (
                    <tr key={line.id} className={line.locked ? 'bg-emerald-50/30' : undefined}>
                      <td className="px-4 py-3 font-bold text-slate-950">{line.no}</td>
                      <td className="px-4 py-3 text-slate-700">{line.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{line.unit || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatMoney(toNumber(line.quantity))}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(toNumber(line.unitPrice))}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
                      Tổng tiền chưa có thuế GTGT
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-950">
                      {formatCurrency(quote.subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
                      Tổng thuế {formatMoney(toNumber(vatRate))}%
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-950">
                      {formatCurrency(quote.vatAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-right font-extrabold text-slate-950">
                      Tổng số tiền thanh toán
                    </td>
                    <td className="px-4 py-4 text-right text-lg font-extrabold text-emerald-700">
                      {formatCurrency(quote.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                <p className="font-bold text-slate-950">Lưu ý</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Ngân sách được nạp trực tiếp vào tài khoản quảng cáo của khách hàng.</li>
                  <li>Phí quản lý tự tính theo ngân sách và loại kênh khi dịch vụ có bảng giá.</li>
                  <li>Phí setup lấy theo gói setup đã chọn trong cấu hình dịch vụ.</li>
                  <li>Vui lòng ghi đúng nội dung chuyển khoản để hệ thống ghi nhận thanh toán.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-sm">
                <p className="font-bold text-emerald-900">Thông tin chuyển khoản</p>
                <div className="mt-3 space-y-2 text-emerald-900">
                  <p>Số tài khoản: <strong>{BANK_INFO.accountNo}</strong></p>
                  <p>Ngân hàng: <strong>{BANK_INFO.branch}</strong></p>
                  <p>Chủ tài khoản: <strong>{BANK_INFO.accountName}</strong></p>
                  <p>Nội dung: <strong>{quote.transferContent}</strong></p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
