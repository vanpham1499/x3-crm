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
import { AD_TOPUP_CARD_OPTION_GROUP } from '@/lib/ad-topup-card-options';
import { getApiErrorMessage } from '@/lib/api-error';
import { canEditProject } from '@/lib/ownership';
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
import { useAuthStore } from '@/stores/auth-store';
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

export default function EditProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
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
            groups: `project_status,contract_status,${AD_TOPUP_CARD_OPTION_GROUP},project_partner`,
          },
        })
        .then((response) => response.data),
  });
  const statuses = projectOptions.filter((option) => option.group === 'project_status');
  const contractStatuses = projectOptions.filter((option) => option.group === 'contract_status');
  const topupCards = projectOptions.filter(
    (option) => option.group === AD_TOPUP_CARD_OPTION_GROUP && option.isActive !== false,
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
  const revenueGroup = getProjectRevenueGroupInfo(Boolean(config?.enabled)).group;
  const billableQuotations = quotations;
  const totalQuoted = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.totalAmount) || 0),
    0,
  );
  const totalGrossReceived = billableQuotations.reduce(
    (sum, quotation) =>
      sum +
      (Number(quotation.grossPaidAmount) ||
        (Number(quotation.paidAmount) || 0) + (Number(quotation.refundedAmount) || 0)),
    0,
  );
  const totalDeposit = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.depositAmount) || 0),
    0,
  );
  const totalDepositReceived = billableQuotations.reduce((sum, quotation) => {
    const deposit = Number(quotation.depositAmount) || 0;
    const grossReceived =
      Number(quotation.grossPaidAmount) ||
      (Number(quotation.paidAmount) || 0) + (Number(quotation.refundedAmount) || 0);

    return sum + Math.min(deposit, grossReceived);
  }, 0);
  const totalDepositRefunded = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.depositRefundedAmount) || 0),
    0,
  );
  const heldDeposit = Math.max(0, totalDepositReceived - totalDepositRefunded);
  const pendingDeposit = Math.max(0, totalDeposit - totalDepositReceived);
  const totalRefunded = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.refundedAmount) || 0),
    0,
  );
  const totalCompensation = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.compensationAmount) || 0),
    0,
  );
  const netCashRetained = totalGrossReceived - totalRefunded - totalCompensation;
  const outstanding = billableQuotations.reduce(
    (sum, quotation) => sum + (Number(quotation.outstandingAmount) || 0),
    0,
  );
  const totalCost = calculateRealizedProjectCost(projectCosts);
  const profit = netCashRetained - heldDeposit - totalCost;
  const managedBudgetProject = isManagedBudgetProject({
    projectType: project.projectType,
    projectCode: project.projectCode,
    quotations,
  });
  const { availableBudget: availableTopupBudget } = calculateAvailableTopupBudget({
    quotations,
    costs: projectCosts,
  });
  const depositNotes = [
    heldDeposit > 0 ? `Đang giữ ${formatCurrency(heldDeposit)}` : '',
    totalDepositRefunded > 0 ? `Đã hoàn ${formatCurrency(totalDepositRefunded)}` : '',
    pendingDeposit > 0 ? `Chưa nhận ${formatCurrency(pendingDeposit)}` : '',
  ].filter(Boolean);

  const metrics = [
    { label: 'Tổng báo phí', value: totalQuoted, className: 'text-slate-950' },
    { label: 'Đã nhận', value: totalGrossReceived, className: 'text-emerald-700' },
    {
      label: 'Tiền cọc',
      value: totalDeposit,
      className: 'text-blue-700',
      note: totalDeposit > 0 ? depositNotes.join(' · ') : undefined,
    },
    { label: 'Đã hoàn', value: totalRefunded, className: 'text-rose-700' },
    { label: 'Bù thêm', value: totalCompensation, className: 'text-fuchsia-700' },
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
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-slate-600">
            <span>{project.customer?.customerName || project.customer?.companyName || '-'}</span>
            <span>
              {[project.service?.code, project.service?.name].filter(Boolean).join(' · ') || '-'}
            </span>
          </div>

          <div
            className={`mt-4 grid gap-px overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4 ${
              managedBudgetProject ? '2xl:grid-cols-9' : '2xl:grid-cols-8'
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
                {'note' in metric && metric.note ? (
                  <p
                    className="mt-1 truncate text-[10px] font-semibold text-slate-500"
                    title={metric.note}
                  >
                    {metric.note}
                  </p>
                ) : null}
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
            isSubmitting={updateMutation.isPending}
            readOnly={!canEditProject(currentUser, project)}
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
              project={project}
              projectId={project.id}
              projectType={project.projectType}
              projectCode={project.projectCode}
              revenueGroup={revenueGroup}
              costs={projectCosts}
              quotations={quotations}
              topupCards={topupCards}
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
