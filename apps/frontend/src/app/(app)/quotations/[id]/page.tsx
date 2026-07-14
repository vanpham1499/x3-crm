'use client';

import { useParams } from 'next/navigation';
import { Alert } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { QuotationForm } from '@/features/quotations/components/quotation-form';
import { getApiErrorMessage } from '@/lib/api-error';
import { COMPANY_BANK_ACCOUNT_OPTION_GROUP } from '@/lib/company-bank-account-options';
import { SERVICE_QUOTE_CONFIG_GROUP } from '@/lib/service-quote-config';
import api from '@/services/api/client';
import type { Lead } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { Quotation } from '@/types/quotation';
import type { ServiceItem } from '@/types/service';

export default function EditQuotationPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const { data: leads = [], isLoading: isLeadsLoading } = useQuery<Lead[]>({
    queryKey: ['leads', 'quotation-form-options'],
    queryFn: () => api.get('/leads').then((response) => response.data),
  });

  const { data: services = [], isLoading: isServicesLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', 'quotation-form-options'],
    queryFn: () =>
      api.get('/services', { params: { tree: true } }).then((response) => response.data),
  });

  const { data: quoteConfigs = [], isLoading: isQuoteConfigsLoading } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
        .then((response) => response.data),
  });

  const { data: bankAccountOptions = [], isLoading: isBankAccountsLoading } = useQuery<AppOption[]>(
    {
      queryKey: ['options', COMPANY_BANK_ACCOUNT_OPTION_GROUP],
      queryFn: () =>
        api
          .get('/options', { params: { groups: COMPANY_BANK_ACCOUNT_OPTION_GROUP } })
          .then((response) => response.data),
    },
  );

  const { data: quotation, isLoading: isQuotationLoading } = useQuery<Quotation>({
    queryKey: ['quotations', id],
    queryFn: () => api.get(`/quotations/${id}`).then((response) => response.data),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.put<Quotation>(`/quotations/${id}`, payload).then((response) => response.data),
    onSuccess: (updatedQuotation) => {
      queryClient.setQueryData(['quotations', id], updatedQuotation);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      notify.success('Cập nhật báo phí thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật báo phí thất bại'));
    },
  });

  if (
    isLeadsLoading ||
    isServicesLoading ||
    isQuoteConfigsLoading ||
    isBankAccountsLoading ||
    isQuotationLoading
  ) {
    return <ContentLoading />;
  }

  if (!quotation) {
    return (
      <div className="p-6">
        <Alert severity="error">Không tìm thấy báo phí</Alert>
      </div>
    );
  }

  return (
    <QuotationForm
      mode="edit"
      quotation={quotation}
      leads={leads}
      services={services}
      quoteConfigs={quoteConfigs}
      bankAccountOptions={bankAccountOptions}
      isSubmitting={updateMutation.isPending}
      onSubmit={(payload) => updateMutation.mutateAsync(payload)}
    />
  );
}
