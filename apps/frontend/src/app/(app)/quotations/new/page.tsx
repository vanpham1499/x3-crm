'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { QuotationForm } from '@/features/quotations/components/quotation-form';
import { COMPANY_BANK_ACCOUNT_OPTION_GROUP } from '@/lib/company-bank-account-options';
import { SERVICE_QUOTE_CONFIG_GROUP } from '@/lib/service-quote-config';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const leadId = searchParams.get('leadId') || '';

  const { data: leads = [], isLoading: isLeadsLoading } = useQuery<Lead[]>({
    queryKey: ['leads', 'quotation-form-options'],
    queryFn: () => api.get('/leads').then((response) => response.data),
  });

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery<Customer[]>({
    queryKey: ['customers', 'quotation-form-options'],
    queryFn: () => api.get('/customers').then((response) => response.data),
  });

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<ProjectItem[]>({
    queryKey: ['projects', 'quotation-form-options'],
    queryFn: () => api.get('/projects').then((response) => response.data),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'quotation-form-options'],
    queryFn: () => api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: quoteConfigs = [], isLoading: isQuoteConfigsLoading } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const { data: bankAccountOptions = [], isLoading: isBankAccountsLoading } = useQuery<AppOption[]>({
    queryKey: ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP],
    queryFn: () =>
      api
        .get('/options', { params: { groups: COMPANY_BANK_ACCOUNT_OPTION_GROUP } })
        .then((response) => response.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<Quotation>('/quotations', payload).then((response) => response.data),
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      notify.success('Tạo báo giá thành công');
      router.push(`/quotations/${quotation.id}`);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Tạo báo giá thất bại'));
    },
  });

  if (
    isLeadsLoading ||
    isCustomersLoading ||
    isProjectsLoading ||
    isServicesLoading ||
    isQuoteConfigsLoading ||
    isBankAccountsLoading
  ) {
    return <ContentLoading />;
  }

  return (
    <QuotationForm
      mode="create"
      leads={leads}
      customers={customers}
      projects={projects}
      services={services}
      quoteConfigs={quoteConfigs}
      bankAccountOptions={bankAccountOptions}
      defaultLeadId={leadId}
      isSubmitting={createMutation.isPending}
      onSubmit={(payload) => createMutation.mutate(payload)}
    />
  );
}
