'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Payment, PaymentFilters } from '@/types/payment';
import type { Revenue } from '@/types/revenue';

function paymentParams(filters: PaymentFilters) {
  return {
    status: filters.status || undefined,
  };
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<PaymentFilters>({ status: '' });
  const [linkTarget, setLinkTarget] = useState<Payment | null>(null);

  const {
    data: payments = [],
    isFetching,
    isLoading,
  } = useQuery<Payment[]>({
    queryKey: ['payments', filters],
    queryFn: () =>
      api.get<Payment[]>('/payments', { params: paymentParams(filters) }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const { data: linkableRevenues = [], isFetching: isLinkableRevenuesFetching } = useQuery<Revenue[]>({
    queryKey: ['revenues', 'for-payment', linkTarget?.projectId],
    queryFn: () =>
      api
        .get<Revenue[]>('/revenues', { params: { project_id: linkTarget?.projectId } })
        .then((response) => response.data),
    enabled: Boolean(linkTarget?.projectId),
  });

  const linkMutation = useMutation({
    mutationFn: ({ payment, revenueId }: { payment: Payment; revenueId: number | null }) =>
      api.put<Payment>(`/payments/${payment.id}`, { revenueId }).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      notify.success('Cập nhật liên kết doanh thu thành công');
      setLinkTarget(null);
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Gắn doanh thu thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <PaymentManager
      payments={payments}
      filters={filters}
      isFetching={isFetching}
      onFiltersChange={setFilters}
      linkTarget={linkTarget}
      linkableRevenues={linkableRevenues}
      isLinkableRevenuesFetching={isLinkableRevenuesFetching}
      isLinking={linkMutation.isPending}
      onOpenLink={(payment) => setLinkTarget(payment)}
      onCloseLink={() => setLinkTarget(null)}
      onConfirmLink={(revenueId) => {
        if (linkTarget) linkMutation.mutate({ payment: linkTarget, revenueId });
      }}
    />
  );
}
