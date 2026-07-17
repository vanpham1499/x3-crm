'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { ProjectContractPanel } from '@/features/projects/components/project-contract-panel';
import { ProjectCostPanel } from '@/features/projects/components/project-cost-panel';
import { ProjectCustomerPanel } from '@/features/projects/components/project-customer-panel';
import { ProjectFinancePanel } from '@/features/projects/components/project-finance-panel';
import { ProjectForm } from '@/features/projects/components/project-form';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  calculateAvailableTopupBudget,
  calculateRealizedProjectCost,
  isManagedBudgetProject,
} from '@/lib/project-topup-budget';
import { getRootServiceItem, getProjectStatusColor, toProjectPayload } from '@/lib/project-utils';
import {
  getConfigForRoot,
  getProjectRevenueGroupInfo,
  getServiceQuoteConfigMeta,
  SERVICE_QUOTE_CONFIG_GROUP,
} from '@/lib/service-quote-config';
import { formatCurrency } from '@/lib/utils';
import api from '@/services/api/client';
import type { Contract } from '@/types/contract';
import type { Customer } from '@/types/customer';
import type { AppOption } from '@/types/option';
import type { Payment } from '@/types/payment';
import type { ProjectCost } from '@/types/project-cost';
import type { ProjectFormValues, ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';
import type { User } from '@/types/user';

type ProjectTab = 'info' | 'contract' | 'finance' | 'customer';

const PROJECT_TABS: ProjectTab[] = ['info', 'contract', 'finance', 'customer'];

function paymentAmountForQuotation(payment: Payment, quotationId: number) {
  const allocations = payment.allocations || [];

  if (allocations.length > 0) {
    return allocations
      .filter((allocation) => allocation.quotationId === quotationId)
      .reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
  }

  return payment.quotationId === quotationId
    ? Number(payment.allocatedAmount ?? payment.amount) || 0
    : 0;
}

export default function EditProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [activeTab, setActiveTab] = useState<ProjectTab>('info');

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'project-form-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'project-form-options'],
    queryFn: () => api.get('/users').then((response) => response.data),
  });

  const { data: projectOptions = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'project-detail'],
    queryFn: () =>
      api
        .get('/options', {
          params: {
            groups: 'project_status,contract_status,company_bank_account,project_partner',
          },
        })
        .then((response) => response.data),
  });
  const statuses = projectOptions.filter((option) => option.group === 'project_status');
  const contractStatuses = projectOptions.filter((option) => option.group === 'contract_status');
  const bankAccounts = projectOptions.filter(
    (option) => option.group === 'company_bank_account' && option.isActive !== false,
  );
  const partners = projectOptions.filter(
    (option) => option.group === 'project_partner' && option.isActive !== false,
  );

  const { data: quoteConfigs = [] } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const { data: project, isLoading } = useQuery<ProjectItem>({
    queryKey: ['projects', id],
    queryFn: () => api.get(`/projects/${id}`).then((response) => response.data),
  });

  const { data: projectCustomer } = useQuery<Customer>({
    queryKey: ['customers', 'project-profile', project?.customerId],
    queryFn: () =>
      api.get<Customer>(`/customers/${project?.customerId}`).then((response) => response.data),
    enabled: Boolean(project?.customerId),
  });

  const { data: projectPayments = [] } = useQuery<Payment[]>({
    queryKey: ['payments', 'by-project', id],
    queryFn: () =>
      api
        .get<Payment[]>('/payments', { params: { project_id: id } })
        .then((response) => response.data),
  });

  const { data: projectQuotations = [] } = useQuery<Quotation[]>({
    queryKey: ['quotations', 'by-project', id],
    queryFn: () =>
      api
        .get<Quotation[]>('/quotations', { params: { project_id: id } })
        .then((response) => response.data),
  });

  const { data: projectCosts = [] } = useQuery<ProjectCost[]>({
    queryKey: ['project-costs', 'by-project', id],
    queryFn: () =>
      api
        .get<ProjectCost[]>('/project-costs', { params: { project_id: id } })
        .then((response) => response.data),
  });

  const { data: projectContracts = [] } = useQuery<Contract[]>({
    queryKey: ['contracts', 'by-project', id],
    queryFn: () =>
      api
        .get<Contract[]>('/contracts', { params: { project_id: id } })
        .then((response) => response.data),
  });

  const { data: originQuotation } = useQuery<Quotation>({
    queryKey: ['quotations', 'project-origin', project?.quotationId],
    queryFn: () =>
      api.get<Quotation>(`/quotations/${project?.quotationId}`).then((response) => response.data),
    enabled: Boolean(project?.quotationId),
  });

  const { data: originQuotationPayments = [] } = useQuery<Payment[]>({
    queryKey: ['payments', 'by-origin-quotation', project?.quotationId],
    queryFn: () =>
      api
        .get<Payment[]>('/payments', { params: { quotation_id: project?.quotationId } })
        .then((response) => response.data),
    enabled: Boolean(project?.quotationId),
  });

  const quotations = Array.from(
    new Map(
      [...projectQuotations, ...(originQuotation ? [originQuotation] : [])].map((quotation) => [
        quotation.id,
        quotation,
      ]),
    ).values(),
  );
  const payments = Array.from(
    new Map(
      [...projectPayments, ...originQuotationPayments].map((payment) => [payment.id, payment]),
    ).values(),
  );

  const updateMutation = useMutation({
    mutationFn: (values: ProjectFormValues) =>
      api
        .put<ProjectItem>(`/projects/${id}`, toProjectPayload(values))
        .then((response) => response.data),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(['projects', id], updatedProject);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      notify.success('Cập nhật dự án thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật dự án thất bại'));
    },
  });

  if (isLoading) return <ContentLoading />;

  if (!project) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy dự án</Alert>
      </div>
    );
  }

  const rootService = getRootServiceItem(services, String(project.serviceId));
  const configOption = getConfigForRoot(quoteConfigs, rootService);
  const config = configOption ? getServiceQuoteConfigMeta(configOption, rootService) : null;
  const revenueGroupInfo = getProjectRevenueGroupInfo(Boolean(config?.enabled));
  const revenueGroup = revenueGroupInfo.group;
  const billableQuotations = quotations;
  const totalQuoted = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.totalAmount) || 0),
    0,
  );
  const totalReceived = billableQuotations.reduce(
    (sum, quotation) =>
      sum +
      payments.reduce(
        (paymentSum, payment) => paymentSum + paymentAmountForQuotation(payment, quotation.id),
        0,
      ),
    0,
  );
  const outstanding = billableQuotations.reduce((sum, quotation) => {
    const received = payments.reduce(
      (paymentSum, payment) => paymentSum + paymentAmountForQuotation(payment, quotation.id),
      0,
    );
    return sum + Math.max(0, (Number(quotation.totalAmount) || 0) - received);
  }, 0);
  const totalCost = calculateRealizedProjectCost(projectCosts);
  const profit = totalReceived - totalCost;
  const managedBudgetProject = isManagedBudgetProject({
    projectType: project.projectType,
    projectCode: project.projectCode,
    quotations,
  });
  const { availableBudget: availableTopupBudget } = calculateAvailableTopupBudget({
    quotations,
    costs: projectCosts,
  });

  const metrics = [
    { label: 'Tổng báo phí', value: totalQuoted, className: 'text-slate-950' },
    { label: 'Đã thu', value: totalReceived, className: 'text-emerald-700' },
    { label: 'Còn phải thu', value: outstanding, className: 'text-amber-700' },
    { label: 'Chi phí đã chi', value: totalCost, className: 'text-rose-700' },
    {
      label: 'Lợi nhuận thực nhận',
      value: profit,
      className: profit >= 0 ? 'text-emerald-700' : 'text-rose-700',
    },
    ...(managedBudgetProject
      ? [
          {
            label: 'Số tiền có thể nạp',
            value: availableTopupBudget,
            className: availableTopupBudget < 0 ? 'text-rose-700' : 'text-blue-700',
          },
        ]
      : []),
  ];
  const activeTabIndex = PROJECT_TABS.indexOf(activeTab);

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
      <PageHeader title={project.projectName} currentLabel="Hồ sơ" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {project.projectCode || `Dự án #${project.id}`}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                project.statusOption ? 'text-white' : 'bg-slate-100 text-slate-600'
              }`}
              style={
                project.statusOption
                  ? { backgroundColor: getProjectStatusColor(project) }
                  : undefined
              }
            >
              {project.statusOption?.label || 'Chưa chọn trạng thái'}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 ${
                revenueGroup === '2.1'
                  ? 'bg-sky-50 text-sky-700 ring-sky-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {revenueGroupInfo.title}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-slate-600">
            <span>{project.customer?.customerName || project.customer?.companyName || '-'}</span>
            <span>
              {[project.service?.code, project.service?.name].filter(Boolean).join(' · ') || '-'}
            </span>
          </div>

          <div
            className={`mt-4 grid gap-px overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-2 ${
              managedBudgetProject ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
            }`}
          >
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-white px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {metric.label}
                </p>
                <p className={`mt-1 text-lg font-extrabold tabular-nums ${metric.className}`}>
                  {formatCurrency(metric.value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200">
          <IconTabs
            value={activeTabIndex}
            onChange={(index) => setActiveTab(PROJECT_TABS[index] || 'info')}
            ariaLabel="Nội dung hồ sơ dự án"
            items={[
              {
                label: 'Thông tin dự án',
                icon: <InfoOutlinedIcon className="!text-[18px]" />,
              },
              {
                label: 'Hợp đồng',
                icon: <DescriptionOutlinedIcon className="!text-[18px]" />,
              },
              {
                label: 'Tài chính',
                icon: <PaymentsOutlinedIcon className="!text-[18px]" />,
              },
              {
                label: 'Khách hàng',
                icon: <PersonOutlineRoundedIcon className="!text-[18px]" />,
              },
            ]}
          />
        </div>
      </section>

      <div className="mt-4 flex flex-1 flex-col">
        {activeTab === 'info' ? (
          <ProjectForm
            mode="edit"
            project={project}
            initialCustomer={projectCustomer || project.customer}
            services={services}
            users={users}
            statuses={statuses}
            quoteConfigs={quoteConfigs}
            isSubmitting={updateMutation.isPending}
            onSubmit={(values) => updateMutation.mutateAsync(values)}
          />
        ) : null}

        {activeTab === 'finance' ? (
          <ProjectFinancePanel
            project={project}
            revenueGroup={revenueGroup}
            quotations={quotations}
            payments={payments}
          >
            <ProjectCostPanel
              projectId={project.id}
              projectType={project.projectType}
              projectCode={project.projectCode}
              revenueGroup={revenueGroup}
              costs={projectCosts}
              quotations={quotations}
              bankAccounts={bankAccounts}
              partners={partners}
            />
          </ProjectFinancePanel>
        ) : null}

        {activeTab === 'contract' ? (
          <ProjectContractPanel
            project={project}
            customer={projectCustomer || project.customer}
            contracts={projectContracts}
            quotations={quotations}
            statuses={contractStatuses}
          />
        ) : null}

        {activeTab === 'customer' ? (
          <ProjectCustomerPanel project={project} customer={projectCustomer || project.customer} />
        ) : null}
      </div>
    </div>
  );
}
