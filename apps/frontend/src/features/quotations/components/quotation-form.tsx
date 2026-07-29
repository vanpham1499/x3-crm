'use client';

import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, IconButton, MenuItem } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { MultiImageUpload } from '@/components/upload/multi-image-upload';
import { getApiFieldErrors } from '@/lib/api-error';
import { PageHeader } from '@/components/shell/page-header';
import {
  getCompanyBankAccounts,
  getDefaultCompanyBankAccount,
} from '@/lib/company-bank-account-options';
import { getQuotationPaymentContent } from '@/lib/quotation-utils';
import {
  SERVICE_QUOTE_CONFIG_GROUP,
  calculateManagementFee,
  getConfigForRoot,
  getServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { flattenServices } from '@/lib/service-utils';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
import type { ProjectItem, ProjectType } from '@/types/project';
import type { Quotation, QuotationLineFormValue } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import { QuotationItemsTable } from './quotation-items-table';

const NO_SETUP_PACKAGE_KEY = 'none';
const NON_TAXABLE_DEPOSIT_MODE = 'non_taxable_addition_v1';
const VAT_RATE_OPTIONS = ['7', '8', '10'] as const;

type QuotationFormProps = {
  mode: 'create' | 'edit';
  quotation?: Quotation | null;
  services: ServiceItem[];
  quoteConfigs: AppOption[];
  bankAccountOptions: AppOption[];
  defaultProjectId?: string;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
};

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
}

function formatCurrency(value: string | number | null | undefined) {
  return `${formatMoney(value)} đ`;
}

function toNumber(value: string | number | null | undefined) {
  return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0;
}

function createQuoteLineId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function normalizeProjectType(
  value: string | null | undefined,
  fallback: ProjectType = 'K',
): ProjectType {
  if (value === 'N' || value === 'O') return 'O';
  return value === 'K' || value === 'M' ? value : fallback;
}

function findRootService(services: ServiceItem[], serviceId: string): ServiceItem | null {
  const flatServices = flattenServices(services);
  const selected = flatServices.find((service) => String(service.id) === serviceId);

  if (!selected) return null;
  if (!selected.parentId) return selected;

  return flatServices.find((service) => selected.pathName.startsWith(`${service.name} /`)) || null;
}

function getMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function getLineUnit(line: { metadata?: Record<string, unknown> | null }) {
  const unit = line.metadata?.unit;
  return typeof unit === 'string' && unit ? unit : 'Dịch vụ';
}

function getProjectOptionLabel(project: ProjectItem) {
  return project.projectCode || `Dự án #${project.id}`;
}

export function QuotationForm({
  mode,
  quotation,
  services,
  quoteConfigs,
  bankAccountOptions,
  defaultProjectId,
  isSubmitting,
  onSubmit,
}: QuotationFormProps) {
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [selectedProjectOption, setSelectedProjectOption] = useState<ProjectItem | null>(null);
  const [projectType, setProjectType] = useState<ProjectType>('K');
  const [vatRate, setVatRate] = useState('8');
  const [depositAmount, setDepositAmount] = useState('0');
  const [note, setNote] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [setupPackageKey, setSetupPackageKey] = useState(NO_SETUP_PACKAGE_KEY);
  const [budget, setBudget] = useState('0');
  const [accountReconciliationImageUrls, setAccountReconciliationImageUrls] = useState<string[]>(
    [],
  );
  const [isUploadingReconciliationImages, setIsUploadingReconciliationImages] = useState(false);
  const [manualLines, setManualLines] = useState<QuotationLineFormValue[]>([
    { id: 1, name: '', unit: 'Dịch vụ', quantity: '1', unitPrice: '0' },
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const bankAccounts = useMemo(
    () => getCompanyBankAccounts(bankAccountOptions),
    [bankAccountOptions],
  );
  const selectedProject = selectedProjectOption;
  const { data: defaultProject } = useQuery<ProjectItem>({
    queryKey: ['projects', defaultProjectId, 'quotation-default-project'],
    queryFn: () =>
      api.get<ProjectItem>(`/projects/${defaultProjectId}`).then((response) => response.data),
    enabled: mode === 'create' && Boolean(defaultProjectId) && selectedProjectOption === null,
  });
  const selectedService =
    serviceOptions.find((service) => String(service.id) === selectedServiceId) || null;
  const selectedBankAccount =
    bankAccounts.find((account) => account.id === selectedBankAccountId) ||
    getDefaultCompanyBankAccount(bankAccountOptions);
  const rootService = useMemo(
    () => findRootService(services, selectedServiceId),
    [selectedServiceId, services],
  );
  const rootConfigOption = getConfigForRoot(quoteConfigs, rootService);
  const rootConfig = rootConfigOption
    ? getServiceQuoteConfigMeta(rootConfigOption, rootService)
    : null;
  const canUseAutoQuote = Boolean(rootConfig?.enabled);
  const setupPackage =
    setupPackageKey === NO_SETUP_PACKAGE_KEY
      ? null
      : rootConfig?.setupPackages.find((item) => item.key === setupPackageKey) ||
        rootConfig?.setupPackages[0] ||
        null;
  const managementFee = rootConfig
    ? calculateManagementFee({
        budget: toNumber(budget),
        channelMode: 'single',
        rates: rootConfig.managementFeeRates,
      })
    : null;

  const autoLines: QuotationLineFormValue[] = canUseAutoQuote
    ? [
        {
          id: -1,
          name: 'Ngân sách',
          unit: 'Tháng',
          quantity: '1',
          unitPrice: budget,
          locked: true,
        },
        {
          id: -2,
          name: `Phí quản lý (${managementFee?.percent || 0}%)`,
          unit: 'Dịch vụ',
          quantity: '1',
          unitPrice: String(managementFee?.amount || 0),
          locked: true,
        },
        ...(setupPackage
          ? [
              {
                id: -3,
                name: `Phí Setup - ${setupPackage.label}`,
                unit: 'Lần',
                quantity: '1',
                unitPrice: String(setupPackage.price || 0),
                locked: true,
              },
            ]
          : []),
      ]
    : [];

  const billableLines = [...autoLines, ...manualLines].filter(
    (line) => line.locked || line.name.trim(),
  );
  const excludesBudgetFromTotal = canUseAutoQuote && projectType === 'K';
  const quoteLines = billableLines.map((line, index) => {
    const amount = toNumber(line.quantity) * toNumber(line.unitPrice);
    const excludedFromTotal = excludesBudgetFromTotal && line.id === -1;

    return { ...line, no: index + 1, amount, excludedFromTotal };
  });
  const subtotal = quoteLines.reduce(
    (sum, line) => sum + (line.excludedFromTotal ? 0 : line.amount),
    0,
  );
  const vatAmount = Math.round((subtotal * toNumber(vatRate)) / 100);
  const deposit = toNumber(depositAmount);
  const total = subtotal + vatAmount + deposit;
  const paymentContent = getQuotationPaymentContent(quotation);
  const missingRequiredProject = !projectId;
  const storedTotalAmount = Number(quotation?.totalAmount) || 0;
  const storedPaidAmount = Number(quotation?.paidAmount) || 0;
  const isPaymentLocked =
    mode === 'edit' &&
    (quotation?.isPaymentLocked === true ||
      (storedTotalAmount > 0.01 && storedPaidAmount >= storedTotalAmount - 0.01));

  useEffect(() => {
    if (!quotation) return;

    const metadata = quotation.metadata || {};
    setProjectId(idToString(quotation.projectId));
    setSelectedProjectOption(
      quotation.project
        ? {
            id: quotation.project.id,
            projectCode: quotation.project.projectCode,
            projectName: quotation.project.projectName,
            projectType: quotation.project.projectType,
            customerId: Number(quotation.customerId || quotation.customer?.id || 0),
            serviceId: Number(quotation.serviceId || 0),
            customer: quotation.customer
              ? {
                  id: quotation.customer.id,
                  customerCode: quotation.customer.customerCode,
                  customerName: quotation.customer.customerName,
                  leadId: quotation.leadId,
                }
              : null,
          }
        : null,
    );
    const storedProjectType =
      getMetadataValue(metadata, 'projectType') || quotation.project?.projectType;
    setProjectType(normalizeProjectType(storedProjectType, 'M'));
    const storedVatRate = String(Number(quotation.vatRate ?? 8));
    setVatRate(
      VAT_RATE_OPTIONS.includes(storedVatRate as (typeof VAT_RATE_OPTIONS)[number])
        ? storedVatRate
        : '8',
    );
    setDepositAmount(String(quotation.depositAmount ?? '0'));
    setNote(quotation.note || '');
    setSelectedServiceId(idToString(quotation.serviceId));
    setBudget(getMetadataValue(metadata, 'budget') || '0');
    setSetupPackageKey(getMetadataValue(metadata, 'setupPackageKey') || NO_SETUP_PACKAGE_KEY);
    setSelectedBankAccountId(getMetadataValue(metadata, 'bankAccountOptionId'));
    setAccountReconciliationImageUrls(quotation.accountReconciliationImageUrls || []);

    const nextManualLines =
      quotation.items
        ?.filter((item) => item.metadata?.locked !== true)
        .map((item) => ({
          id: item.id || createQuoteLineId(),
          name: item.itemName || '',
          unit: getLineUnit(item),
          quantity: String(item.quantity ?? '1'),
          unitPrice: String(item.unitPrice ?? '0'),
        })) || [];

    setManualLines(
      nextManualLines.length > 0
        ? nextManualLines
        : [{ id: 1, name: '', unit: 'Dịch vụ', quantity: '1', unitPrice: '0' }],
    );
  }, [quotation]);

  useEffect(() => {
    if (!defaultProject || selectedProjectOption) return;

    setSelectedProjectOption(defaultProject);
    setProjectId(String(defaultProject.id));
    setSelectedServiceId(idToString(defaultProject.serviceId));
    setProjectType(normalizeProjectType(defaultProject.projectType));
  }, [defaultProject, selectedProjectOption]);

  useEffect(() => {
    if (selectedBankAccountId || bankAccounts.length === 0) return;
    setSelectedBankAccountId(
      getDefaultCompanyBankAccount(bankAccountOptions)?.id || bankAccounts[0]?.id || '',
    );
  }, [bankAccountOptions, bankAccounts, selectedBankAccountId]);

  useEffect(() => {
    if (!selectedProject) return;

    setProjectId(String(selectedProject.id));
    setSelectedServiceId(idToString(selectedProject.serviceId));
    setProjectType(normalizeProjectType(selectedProject.projectType));
  }, [selectedProject]);

  const updateLine = (lineId: number, values: Partial<QuotationLineFormValue>) => {
    setManualLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...values } : line)),
    );
  };

  const addLine = () => {
    setManualLines((current) => [
      ...current,
      { id: createQuoteLineId(), name: '', unit: 'Dịch vụ', quantity: '1', unitPrice: '0' },
    ]);
  };

  const deleteLine = (lineId: number) => {
    setManualLines((current) => {
      if (current.length === 1) return current;
      return current.filter((line) => line.id !== lineId);
    });
  };

  const submitForm = async () => {
    const existingRevenueGroup = getMetadataValue(quotation?.metadata, 'revenueGroup');
    const existingPricingMode = getMetadataValue(quotation?.metadata, 'pricingMode');
    const revenueGroup =
      mode === 'edit' && ['2.1', '2.2'].includes(existingRevenueGroup)
        ? existingRevenueGroup
        : canUseAutoQuote
          ? '2.1'
          : '2.2';
    const pricingMode =
      mode === 'edit' && ['management_fee', 'quantity_price'].includes(existingPricingMode)
        ? existingPricingMode
        : canUseAutoQuote
          ? 'management_fee'
          : 'quantity_price';
    const payload: Record<string, unknown> = {
      serviceId: selectedServiceId ? Number(selectedServiceId) : null,
      serviceCode: selectedService?.code || null,
      serviceName: selectedService?.name || null,
      subtotalAmount: subtotal,
      vatRate: toNumber(vatRate),
      vatAmount,
      totalAmount: total,
      depositAmount: deposit,
      accountReconciliationImageUrls: projectType === 'K' ? accountReconciliationImageUrls : [],
      note: note.trim() || null,
      metadata: {
        ...(quotation?.metadata || {}),
        customerMode: 'existing_customer',
        projectMode: 'existing_project',
        customerName:
          selectedProject?.customer?.customerName ||
          selectedProject?.customer?.companyName ||
          quotation?.customer?.customerName ||
          '',
        projectName: selectedProject?.projectName || quotation?.project?.projectName || '',
        projectType,
        budget,
        setupPackageKey,
        depositMode: NON_TAXABLE_DEPOSIT_MODE,
        bankAccountOptionId: selectedBankAccount?.id || null,
        bankCode: selectedBankAccount?.bankCode || null,
        bankAccountNo: selectedBankAccount?.accountNo || null,
        bankAccountName: selectedBankAccount?.accountName || null,
        bankName: selectedBankAccount?.bankName || null,
        bankBranch: selectedBankAccount?.branch || null,
        paymentContent: paymentContent || null,
        serviceQuoteConfigGroup: SERVICE_QUOTE_CONFIG_GROUP,
        serviceRootId: rootService?.id || null,
        serviceRootCode: rootService?.code || null,
        revenueGroup,
        pricingMode,
      },
      items: quoteLines
        .filter((line) => line.name.trim())
        .map((line, index) => {
          const lineVatRate = line.excludedFromTotal ? 0 : toNumber(vatRate);
          const lineVatAmount = Math.round((line.amount * lineVatRate) / 100);
          const lineAmountAfterVat = line.amount + lineVatAmount;

          return {
            serviceId: selectedServiceId ? Number(selectedServiceId) : null,
            service_id: selectedServiceId ? Number(selectedServiceId) : null,
            itemCode: line.locked ? String(line.id) : null,
            item_code: line.locked ? String(line.id) : null,
            itemName: line.name.trim(),
            item_name: line.name.trim(),
            quantity: toNumber(line.quantity),
            unitPrice: toNumber(line.unitPrice),
            unit_price: toNumber(line.unitPrice),
            amountBeforeVat: line.amount,
            amount_before_vat: line.amount,
            vatRate: lineVatRate,
            vat_rate: lineVatRate,
            vatAmount: lineVatAmount,
            vat_amount: lineVatAmount,
            amountAfterVat: lineAmountAfterVat,
            amount_after_vat: lineAmountAfterVat,
            sortOrder: index * 10,
            sort_order: index * 10,
            metadata: {
              unit: line.unit,
              locked: Boolean(line.locked),
              excludedFromTotal: line.excludedFromTotal,
            },
          };
        }),
    };

    const projectIdValue = projectId ? Number(projectId) : null;
    payload.projectId = projectIdValue;
    payload.project_id = projectIdValue;

    try {
      setFieldErrors({});
      await onSubmit(isPaymentLocked ? { note: note.trim() || null } : payload);
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error));
    }
  };

  return (
    <form
      className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSubmitting && !isUploadingReconciliationImages && !missingRequiredProject)
          submitForm();
      }}
    >
      <PageHeader
        title={mode === 'edit' ? 'Chỉnh sửa báo phí' : 'Thêm báo phí'}
        currentLabel={mode === 'edit' ? quotation?.quotationCode || 'Chỉnh sửa' : undefined}
      />

      {isPaymentLocked ? (
        <div
          className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          role="status"
        >
          <LockRoundedIcon className="mt-0.5 !text-[20px] !text-emerald-700" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-800">Báo phí đã được khóa</p>
            <p className="mt-0.5 text-sm font-medium text-emerald-700">
              Báo phí đã thu đủ. Bạn chỉ có thể cập nhật ghi chú.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <FormSection title="Thông tin báo phí">
            <ServerPaginatedAutocomplete<ProjectItem>
              endpoint="/projects"
              queryKey={['projects', 'quotation-autocomplete']}
              label="Dự án"
              value={selectedProject}
              disabled={isPaymentLocked || (mode === 'edit' && Boolean(quotation?.projectId))}
              required
              error={Boolean(fieldErrors.projectId || fieldErrors.project_id)}
              helperText={fieldErrors.projectId || fieldErrors.project_id}
              placeholder="Nhập mã dự án, tên dự án hoặc khách hàng"
              onChange={(value) => {
                setSelectedProjectOption(value);
                setProjectId(idToString(value?.id));
                setSelectedServiceId(idToString(value?.serviceId));
                setProjectType(normalizeProjectType(value?.projectType));
              }}
              getOptionLabel={getProjectOptionLabel}
            />

            {selectedProject ? (
              <dl className="grid overflow-hidden rounded-xl border border-slate-200 bg-slate-50 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-w-0 px-3 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Khách hàng
                  </dt>
                  <dd className="mt-1 truncate text-sm font-bold text-slate-800">
                    {[
                      selectedProject.customer?.customerCode,
                      selectedProject.customer?.customerName ||
                        selectedProject.customer?.companyName,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </dd>
                </div>
                <div className="min-w-0 border-slate-200 px-3 py-2.5 md:border-x">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Dịch vụ
                  </dt>
                  <dd
                    className="mt-1 truncate text-sm font-bold text-slate-800"
                    title={
                      selectedService ? `${selectedService.code} - ${selectedService.pathName}` : ''
                    }
                  >
                    {selectedService
                      ? `${selectedService.code} - ${selectedService.pathName}`
                      : '-'}
                  </dd>
                </div>
                <div className="min-w-0 px-3 py-2.5">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Loại
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-slate-800">
                    {projectType === 'O' ? 'Không chọn' : projectType}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="grid gap-4 md:grid-cols-12">
              <FormSelectField
                className="md:col-span-6"
                label="VAT"
                value={vatRate}
                disabled={isPaymentLocked}
                onChange={(event) => setVatRate(event.target.value)}
              >
                {VAT_RATE_OPTIONS.map((rate) => (
                  <MenuItem key={rate} value={rate}>
                    {rate}%
                  </MenuItem>
                ))}
              </FormSelectField>
              <MoneyInput
                fullWidth
                size="small"
                label="Cọc"
                value={depositAmount}
                disabled={isPaymentLocked}
                onValueChange={setDepositAmount}
                error={Boolean(fieldErrors.depositAmount || fieldErrors.deposit_amount)}
                helperText={fieldErrors.depositAmount || fieldErrors.deposit_amount}
                className={`${compactFormFieldClassName} md:col-span-6`}
              />
              {canUseAutoQuote && (
                <>
                  <MoneyInput
                    fullWidth
                    size="small"
                    label="Ngân sách"
                    value={budget}
                    disabled={isPaymentLocked}
                    onValueChange={setBudget}
                    className={`${compactFormFieldClassName} md:col-span-6`}
                  />
                  <FormSelectField
                    className="md:col-span-6"
                    label="Gói setup"
                    value={setupPackageKey}
                    disabled={isPaymentLocked}
                    onChange={(event) => setSetupPackageKey(event.target.value)}
                  >
                    <MenuItem value={NO_SETUP_PACKAGE_KEY}>Không tính phí setup</MenuItem>
                    {(rootConfig?.setupPackages || []).map((item) => (
                      <MenuItem key={item.key} value={item.key}>
                        {item.label} - {formatCurrency(item.price)}
                      </MenuItem>
                    ))}
                  </FormSelectField>
                </>
              )}
            </div>

            <FormInputField
              multiline
              minRows={2}
              label="Ghi chú"
              value={note}
              error={Boolean(fieldErrors.note)}
              helperText={
                fieldErrors.note ||
                (isPaymentLocked ? 'Đây là trường duy nhất có thể cập nhật.' : undefined)
              }
              onChange={(event) => setNote(event.target.value)}
            />

            <Autocomplete
              options={bankAccounts}
              value={selectedBankAccount}
              disabled={isPaymentLocked}
              onChange={(_, value) => setSelectedBankAccountId(value?.id || '')}
              getOptionLabel={(option) =>
                `${option.bankCode} - ${option.accountNo} - ${option.accountName}`
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="Chưa có tài khoản nhận tiền"
              renderInput={(params) => <FormInputField {...params} label="Tài khoản nhận tiền" />}
            />

            <div
              className={`rounded-xl border px-4 py-3 ${
                paymentContent
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
              role="status"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Nội dung chuyển khoản
              </p>
              {paymentContent ? (
                <p className="mt-1 select-all break-all font-mono text-lg font-extrabold tracking-wide text-primary">
                  {paymentContent}
                </p>
              ) : (
                <p className="mt-1 text-sm font-medium text-slate-500">Tạo tự động sau khi lưu</p>
              )}
            </div>
          </FormSection>
        </div>

        <div className="xl:col-span-7">
          <FormSection
            title="Chi tiết báo phí"
            action={
              <TabActionButton
                startIcon={<AddRoundedIcon />}
                disabled={isPaymentLocked}
                onClick={addLine}
              >
                Thêm hạng mục
              </TabActionButton>
            }
          >
            {manualLines.map((line) => (
              <div key={line.id}>
                <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.7fr)_110px_90px_140px_38px]">
                  <FormInputField
                    label="Hạng mục"
                    value={line.name}
                    disabled={isPaymentLocked}
                    onChange={(event) => updateLine(line.id, { name: event.target.value })}
                  />
                  <FormInputField
                    label="Đơn vị tính"
                    value={line.unit}
                    disabled={isPaymentLocked}
                    onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                  />
                  <FormInputField
                    label="Số lượng"
                    value={line.quantity}
                    disabled={isPaymentLocked}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                  />
                  <MoneyInput
                    fullWidth
                    allowNegative
                    label="Đơn giá"
                    size="small"
                    value={line.unitPrice}
                    disabled={isPaymentLocked}
                    onValueChange={(value) => updateLine(line.id, { unitPrice: value })}
                    className={compactFormFieldClassName}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Xóa hạng mục"
                    disabled={isPaymentLocked || manualLines.length === 1}
                    onClick={() => deleteLine(line.id)}
                    title="Xóa dòng"
                    className="!mt-1"
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ))}

            <QuotationItemsTable
              lines={quoteLines.map((line) => ({
                ...line,
                highlighted: line.locked,
              }))}
              subtotal={subtotal}
              vatRate={vatRate}
              vatAmount={vatAmount}
              deposit={deposit}
              total={total}
              emptyText="Nhập hạng mục để xem chi tiết báo phí"
            />

            {projectType === 'K' ? (
              <div className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-sm font-bold text-slate-700">
                  Ảnh đối soát chi tiết tài khoản quảng cáo
                </p>
                <MultiImageUpload
                  value={accountReconciliationImageUrls}
                  imageLabel="Ảnh đối soát"
                  collectionLabel="báo phí"
                  helperText="Chọn ảnh từ thư viện hoặc tải ảnh mới. Tối đa 3 ảnh đối soát."
                  disabled={isPaymentLocked}
                  onChange={setAccountReconciliationImageUrls}
                  onUploadingChange={setIsUploadingReconciliationImages}
                />
              </div>
            ) : null}
          </FormSection>
        </div>
      </div>

      <FormActionBar
        cancelHref="/quotations"
        submitLabel={
          isPaymentLocked ? 'Lưu ghi chú' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo báo phí'
        }
        isSubmitting={isSubmitting || isUploadingReconciliationImages}
        submitDisabled={missingRequiredProject || isUploadingReconciliationImages}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
