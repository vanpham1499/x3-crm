'use client';

import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, IconButton, MenuItem } from '@mui/material';
import { TabActionButton } from '@/components/actions/tab-action-button';
import { FormActionBar } from '@/components/form/form-action-bar';
import { compactFormFieldClassName } from '@/components/form/form-field-styles';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { MoneyInput } from '@/components/form/money-input';
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
import type { AppOption } from '@/types/option';
import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { ProjectItem } from '@/types/project';
import type { Quotation, QuotationLineFormValue, QuotationStatus } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';

type QuoteCustomerMode = 'new_customer' | 'existing_customer';
type QuoteProjectMode = 'new_project' | 'existing_project';

type QuotationFormProps = {
  mode: 'create' | 'edit';
  quotation?: Quotation | null;
  leads: Lead[];
  customers: Customer[];
  projects: ProjectItem[];
  services: ServiceItem[];
  quoteConfigs: AppOption[];
  bankAccountOptions: AppOption[];
  defaultLeadId?: string;
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

export function QuotationForm({
  mode,
  quotation,
  leads,
  customers,
  projects,
  services,
  quoteConfigs,
  bankAccountOptions,
  defaultLeadId,
  defaultProjectId,
  isSubmitting,
  onSubmit,
}: QuotationFormProps) {
  const [customerMode, setCustomerMode] = useState<QuoteCustomerMode>(
    defaultProjectId ? 'existing_customer' : 'new_customer',
  );
  const [projectMode, setProjectMode] = useState<QuoteProjectMode>(
    defaultProjectId ? 'existing_project' : 'new_project',
  );
  const [leadId, setLeadId] = useState(defaultLeadId || '');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [duration, setDuration] = useState('1 tháng');
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [vatRate, setVatRate] = useState('8');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [setupPackageKey, setSetupPackageKey] = useState('basic');
  const [budget, setBudget] = useState('0');
  const [manualLines, setManualLines] = useState<QuotationLineFormValue[]>([
    { id: 1, name: '', unit: 'Dịch vụ', quantity: '1', unitPrice: '0' },
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const serviceOptions = useMemo(() => flattenServices(services), [services]);
  const bankAccounts = useMemo(
    () => getCompanyBankAccounts(bankAccountOptions),
    [bankAccountOptions],
  );
  const selectedLead = leads.find((lead) => String(lead.id) === leadId) || null;
  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId) || null;
  const selectedProject = projects.find((project) => String(project.id) === projectId) || null;
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
    rootConfig?.setupPackages.find((item) => item.key === setupPackageKey) ||
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
        {
          id: -3,
          name: `Phí Setup${setupPackage ? ` - ${setupPackage.label}` : ''}`,
          unit: 'Lần',
          quantity: '1',
          unitPrice: String(setupPackage?.price || 0),
          locked: true,
        },
      ]
    : [];

  const billableLines = [...autoLines, ...manualLines].filter(
    (line) => line.locked || line.name.trim(),
  );
  const quoteLines = billableLines.map((line, index) => {
    const amount = toNumber(line.quantity) * toNumber(line.unitPrice);
    return { ...line, no: index + 1, amount };
  });
  const subtotal = quoteLines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = Math.round((subtotal * toNumber(vatRate)) / 100);
  const total = subtotal + vatAmount;
  const paymentContent = getQuotationPaymentContent(quotation);
  const missingRequiredLead = mode === 'create' && !leadId;

  useEffect(() => {
    if (!quotation) return;

    const metadata = quotation.metadata || {};
    const nextCustomerMode =
      getMetadataValue(metadata, 'customerMode') === 'existing_customer' || quotation.customerId
        ? 'existing_customer'
        : 'new_customer';
    const nextProjectMode =
      getMetadataValue(metadata, 'projectMode') === 'existing_project' || quotation.projectId
        ? 'existing_project'
        : 'new_project';

    setCustomerMode(nextCustomerMode);
    setProjectMode(nextProjectMode);
    setLeadId(idToString(quotation.leadId));
    setCustomerId(idToString(quotation.customerId));
    setProjectId(idToString(quotation.projectId));
    setCustomerName(
      getMetadataValue(metadata, 'customerName') ||
        quotation.lead?.customerName ||
        quotation.customer?.customerName ||
        '',
    );
    setProjectName(
      getMetadataValue(metadata, 'projectName') || quotation.project?.projectName || '',
    );
    setDuration(getMetadataValue(metadata, 'duration') || '1 tháng');
    setStatus((quotation.status as QuotationStatus) || 'draft');
    setVatRate(String(quotation.vatRate ?? '0'));
    setValidUntil(quotation.validUntil || '');
    setNote(quotation.note || '');
    setSelectedServiceId(idToString(quotation.serviceId));
    setBudget(getMetadataValue(metadata, 'budget') || '0');
    setSetupPackageKey(getMetadataValue(metadata, 'setupPackageKey') || 'basic');
    setSelectedBankAccountId(getMetadataValue(metadata, 'bankAccountOptionId'));

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
    if (selectedBankAccountId || bankAccounts.length === 0) return;
    setSelectedBankAccountId(
      getDefaultCompanyBankAccount(bankAccountOptions)?.id || bankAccounts[0]?.id || '',
    );
  }, [bankAccountOptions, bankAccounts, selectedBankAccountId]);

  useEffect(() => {
    if (customerName || !selectedLead) return;
    setCustomerName(selectedLead.customerName || '');
  }, [customerName, selectedLead]);

  useEffect(() => {
    if (mode !== 'create' || customerMode !== 'new_customer' || !selectedLead) return;
    setCustomerName(selectedLead.customerName || '');
    setCustomerId('');
    setProjectId('');
  }, [customerMode, mode, selectedLead]);

  useEffect(() => {
    if (mode !== 'create' || customerMode !== 'existing_customer' || !selectedCustomer) return;
    setLeadId(idToString(selectedCustomer.leadId));
    setCustomerName(selectedCustomer.customerName || selectedCustomer.companyName || '');
  }, [customerMode, mode, selectedCustomer]);

  useEffect(() => {
    if (
      mode !== 'create' ||
      customerMode !== 'existing_customer' ||
      projectMode !== 'existing_project' ||
      !selectedProject
    )
      return;

    setProjectName(selectedProject.projectName || '');
    setCustomerId(idToString(selectedProject.customerId));
    setCustomerName(
      selectedProject.customer?.customerName ||
        selectedProject.customer?.companyName ||
        selectedProject.projectName ||
        '',
    );
    setLeadId(idToString(selectedProject.customer?.leadId));
    setSelectedServiceId(idToString(selectedProject.serviceId));
  }, [customerMode, mode, projectMode, selectedProject]);

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
      quotationCode: quotation?.quotationCode || undefined,
      serviceId: selectedServiceId ? Number(selectedServiceId) : null,
      serviceCode: selectedService?.code || null,
      serviceName: selectedService?.name || null,
      status,
      subtotalAmount: subtotal,
      vatRate: toNumber(vatRate),
      vatAmount,
      totalAmount: total,
      depositAmount: total,
      validUntil: validUntil || null,
      note: note.trim() || null,
      metadata: {
        customerMode,
        projectMode: customerMode === 'existing_customer' ? projectMode : 'new_project',
        customerName,
        projectName,
        duration,
        budget,
        setupPackageKey,
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
        .map((line, index) => ({
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
          vatRate: 0,
          vat_rate: 0,
          vatAmount: 0,
          vat_amount: 0,
          amountAfterVat: line.amount,
          amount_after_vat: line.amount,
          sortOrder: index * 10,
          sort_order: index * 10,
          metadata: {
            unit: line.unit,
            locked: Boolean(line.locked),
          },
        })),
    };

    if (mode === 'create') {
      const leadIdValue = leadId ? Number(leadId) : null;
      const customerIdValue =
        customerMode === 'existing_customer' && customerId ? Number(customerId) : null;
      const projectIdValue =
        customerMode === 'existing_customer' && projectMode === 'existing_project' && projectId
          ? Number(projectId)
          : null;

      payload.leadId = leadIdValue;
      payload.lead_id = leadIdValue;
      payload.customerId = customerIdValue;
      payload.customer_id = customerIdValue;
      payload.projectId = projectIdValue;
      payload.project_id = projectIdValue;
    }

    try {
      setFieldErrors({});
      await onSubmit(payload);
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error));
    }
  };

  return (
    <form
      className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSubmitting && !missingRequiredLead) submitForm();
      }}
    >
      <PageHeader
        title={mode === 'edit' ? 'Chỉnh sửa báo giá' : 'Thêm báo giá'}
        currentLabel={mode === 'edit' ? quotation?.quotationCode || 'Chỉnh sửa' : undefined}
        action={
          mode === 'edit' && quotation && !quotation.projectId
            ? {
                label: 'Tạo dự án',
                href: `/projects/new?quotationId=${quotation.id}`,
              }
            : undefined
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <FormSection title="Thông tin báo giá">
            <div className="grid gap-4 md:grid-cols-2">
              <FormSelectField
                label="Loại khách hàng"
                value={customerMode}
                disabled={mode === 'edit'}
                onChange={(event) => {
                  const nextMode = event.target.value as QuoteCustomerMode;
                  setCustomerMode(nextMode);
                  setLeadId('');
                  setCustomerId('');
                  setProjectId('');
                  setCustomerName('');
                  setProjectName('');
                  setProjectMode('new_project');
                }}
              >
                <MenuItem value="new_customer">Khách hàng mới</MenuItem>
                <MenuItem value="existing_customer">Khách hàng cũ</MenuItem>
              </FormSelectField>

              {customerMode === 'new_customer' ? (
                <Autocomplete
                  options={leads}
                  value={selectedLead}
                  disabled={mode === 'edit'}
                  onChange={(_, value) => {
                    setLeadId(idToString(value?.id));
                    setCustomerName(value?.customerName || '');
                  }}
                  getOptionLabel={(option) =>
                    `${option.leadCode || ''} - ${option.customerName || ''}`
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <FormInputField
                      {...params}
                      required
                      label="Lead"
                      error={Boolean(fieldErrors.leadId)}
                      helperText={fieldErrors.leadId}
                    />
                  )}
                />
              ) : (
                <>
                  <FormSelectField
                    label="Loại dự án"
                    value={projectMode}
                    disabled={mode === 'edit'}
                    onChange={(event) => {
                      const nextMode = event.target.value as QuoteProjectMode;
                      setProjectMode(nextMode);
                      setProjectId('');
                      if (nextMode === 'new_project') setProjectName('');
                    }}
                  >
                    <MenuItem value="new_project">Dự án mới</MenuItem>
                    <MenuItem value="existing_project">Dự án cũ</MenuItem>
                  </FormSelectField>

                  {projectMode === 'existing_project' ? (
                    <Autocomplete
                      className="md:col-span-2"
                      options={projects}
                      value={selectedProject}
                      disabled={mode === 'edit'}
                      onChange={(_, value) => {
                        setProjectId(idToString(value?.id));
                        setProjectName(value?.projectName || '');
                        setCustomerId(idToString(value?.customerId));
                        setCustomerName(
                          value?.customer?.customerName || value?.customer?.companyName || '',
                        );
                        setLeadId(idToString(value?.customer?.leadId));
                        setSelectedServiceId(idToString(value?.serviceId));
                      }}
                      getOptionLabel={(option) =>
                        `${option.projectCode || ''} - ${option.customer?.customerName || option.projectName || ''}`
                      }
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <FormInputField {...params} required label="Dự án cũ" />
                      )}
                    />
                  ) : (
                    <Autocomplete
                      className="md:col-span-2"
                      options={customers}
                      value={selectedCustomer}
                      disabled={mode === 'edit'}
                      onChange={(_, value) => {
                        setCustomerId(idToString(value?.id));
                        setLeadId(idToString(value?.leadId));
                        setCustomerName(value?.customerName || value?.companyName || '');
                      }}
                      getOptionLabel={(option) =>
                        `${option.customerCode || ''} - ${option.customerName || ''}`
                      }
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <FormInputField {...params} required label="Khách hàng" />
                      )}
                    />
                  )}
                </>
              )}

              <FormInputField
                label="Khách hàng"
                value={customerName}
                disabled={customerMode === 'existing_customer'}
                onChange={(event) => setCustomerName(event.target.value)}
              />
              <FormInputField
                label="Tên dự án"
                value={projectName}
                disabled={
                  customerMode === 'existing_customer' && projectMode === 'existing_project'
                }
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInputField
                label="Thời gian"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
              <FormSelectField
                label="Trạng thái"
                value={status}
                onChange={(event) => setStatus(event.target.value as QuotationStatus)}
              >
                <MenuItem value="draft">Nháp</MenuItem>
                <MenuItem value="sent">Đã gửi</MenuItem>
                <MenuItem value="won">Đã chốt</MenuItem>
                <MenuItem value="lost">Đã hủy</MenuItem>
              </FormSelectField>
              <FormInputField
                type="date"
                label="Hiệu lực đến"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormInputField
                label="VAT (%)"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Autocomplete
                className="md:col-span-2"
                options={serviceOptions}
                value={selectedService}
                onChange={(_, value) => setSelectedServiceId(idToString(value?.id))}
                getOptionLabel={(option) => `${option.code} - ${option.pathName}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <FormInputField {...params} label="Dịch vụ" />}
              />
              {canUseAutoQuote && (
                <>
                  <MoneyInput
                    fullWidth
                    size="small"
                    label="Ngân sách"
                    value={budget}
                    onValueChange={setBudget}
                    className={compactFormFieldClassName}
                  />
                  <FormSelectField
                    label="Gói setup"
                    value={setupPackageKey}
                    onChange={(event) => setSetupPackageKey(event.target.value)}
                  >
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
              minRows={3}
              label="Ghi chú"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <Autocomplete
              options={bankAccounts}
              value={selectedBankAccount}
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
            title="Chi tiết báo giá"
            action={
              <TabActionButton startIcon={<AddRoundedIcon />} onClick={addLine}>
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
                    onChange={(event) => updateLine(line.id, { name: event.target.value })}
                  />
                  <FormInputField
                    label="Đơn vị tính"
                    value={line.unit}
                    onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                  />
                  <FormInputField
                    label="Số lượng"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                  />
                  <MoneyInput
                    fullWidth
                    label="Đơn giá"
                    size="small"
                    value={line.unitPrice}
                    onValueChange={(value) => updateLine(line.id, { unitPrice: value })}
                    className={compactFormFieldClassName}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Xóa hạng mục"
                    disabled={manualLines.length === 1}
                    onClick={() => deleteLine(line.id)}
                    title="Xóa dòng"
                    className="!mt-1"
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ))}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-100 text-[13px] font-bold text-slate-700">
                  <tr>
                    <th className="w-16 px-4 py-3">STT</th>
                    <th className="px-4 py-3">Hạng mục</th>
                    <th className="w-28 px-4 py-3">Đơn vị tính</th>
                    <th className="w-24 px-4 py-3 text-right">Số lượng</th>
                    <th className="w-40 px-4 py-3 text-right">Đơn giá</th>
                    <th className="w-40 px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Nhập hạng mục để xem chi tiết báo giá
                      </td>
                    </tr>
                  ) : (
                    quoteLines.map((line) => (
                      <tr key={line.id} className={line.locked ? 'bg-emerald-50/30' : undefined}>
                        <td className="px-4 py-3 font-bold text-slate-950">{line.no}</td>
                        <td className="px-4 py-3 text-slate-700">{line.name || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{line.unit || '-'}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatMoney(line.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(line.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-950">
                          {formatCurrency(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
                      Tổng trước thuế
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-950">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">
                      VAT {toNumber(vatRate)}%
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-950">
                      {formatCurrency(vatAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-right font-extrabold text-slate-950">
                      Tổng thanh toán
                    </td>
                    <td className="px-4 py-4 text-right text-lg font-extrabold text-emerald-700">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </FormSection>
        </div>
      </div>

      <FormActionBar
        cancelHref="/quotations"
        submitLabel={mode === 'edit' ? 'Lưu thay đổi' : 'Tạo báo giá'}
        isSubmitting={isSubmitting}
        submitDisabled={missingRequiredLead}
        submitIcon={<SaveRoundedIcon />}
      />
    </form>
  );
}
