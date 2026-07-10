'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ContentLoading } from '@/components/shell/content-loading';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import api from '@/services/api/client';
import type { Payment, PaymentFilters } from '@/types/payment';

function paymentParams(filters: PaymentFilters) {
  return {
    status: filters.status || undefined,
  };
}

export default function PaymentsPage() {
  const [filters, setFilters] = useState<PaymentFilters>({ status: '' });

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

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <PaymentManager
      payments={payments}
      filters={filters}
      isFetching={isFetching}
      onFiltersChange={setFilters}
    />
  );
}
