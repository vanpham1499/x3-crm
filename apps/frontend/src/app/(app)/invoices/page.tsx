'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { InvoiceManager } from '@/features/invoices/components/invoice-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { DEFAULT_INVOICE_FILTERS, toInvoicePayload } from '@/lib/invoice-utils';
import api from '@/services/api/client';
import type { Invoice, InvoiceFilters, InvoiceFormValues } from '@/types/invoice';
import type { Revenue } from '@/types/revenue';

function invoiceParams(filters: InvoiceFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
  };
}

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<InvoiceFilters>(DEFAULT_INVOICE_FILTERS);

  const {
    data: invoices = [],
    isFetching,
    isLoading,
  } = useQuery<Invoice[]>({
    queryKey: ['invoices', filters],
    queryFn: () =>
      api.get<Invoice[]>('/invoices', { params: invoiceParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const { data: revenues = [], isLoading: isRevenuesLoading } = useQuery<Revenue[]>({
    queryKey: ['revenues', 'invoice-form-options'],
    queryFn: () => api.get<Revenue[]>('/revenues').then((response) => response.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ values, invoice }: { values: InvoiceFormValues; invoice?: Invoice | null }) => {
      const payload = toInvoicePayload(values);

      if (invoice) {
        return api.put(`/invoices/${invoice.id}`, payload);
      }

      return api.post('/invoices', payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notify.success(variables.invoice ? 'Cập nhật hóa đơn thành công' : 'Xuất hóa đơn thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu hóa đơn thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (invoice: Invoice) => api.delete(`/invoices/${invoice.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      notify.success('Xóa hóa đơn thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa hóa đơn thất bại'));
    },
  });

  if (isLoading || isRevenuesLoading) {
    return <ContentLoading />;
  }

  return (
    <InvoiceManager
      invoices={invoices}
      revenues={revenues}
      filters={filters}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onSubmit={(values, invoice) => saveMutation.mutate({ values, invoice })}
      onDelete={(invoice) => deleteMutation.mutate(invoice)}
    />
  );
}
