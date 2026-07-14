'use client';

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  Payment,
  PaymentAllocationInput,
  PaymentFilters,
  PaymentLinkInput,
  PaymentRefundInput,
} from '@/types/payment';

const PAYMENTS_PAGE_SIZE = 10;
const PAYMENTS_LIST_QUERY_KEY = ['payments', 'list'] as const;
const DEFAULT_PAYMENT_FILTERS: PaymentFilters = {
  keyword: '',
  status: '',
  reconciled_status: '',
  date_from: '',
  date_to: '',
};

function paymentParams(filters: PaymentFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    reconciled_status: filters.reconciled_status || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  };
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<PaymentFilters>({
      initialFilters: DEFAULT_PAYMENT_FILTERS,
      queryKey: PAYMENTS_LIST_QUERY_KEY,
      pageSize: PAYMENTS_PAGE_SIZE,
    });
  const {
    data: paymentsPage,
    isFetching,
    isLoading,
  } = useQuery<PaginatedResponse<Payment>>({
    queryKey: [...PAYMENTS_LIST_QUERY_KEY, requestFilters, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<Payment>>('/payments', {
          params: {
            ...paymentParams(requestFilters),
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const payments = paymentsPage?.data || [];
  const pagination = paymentsPage?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage, setPage]);

  const refreshPaymentData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['quotations'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ]);

  const allocateMutation = useMutation({
    mutationFn: ({
      paymentId,
      allocations,
    }: {
      paymentId: number;
      allocations: PaymentAllocationInput[];
    }) =>
      api
        .post<Payment>(`/payments/${paymentId}/allocations`, {
          allocations: allocations.map((allocation) => ({
            quotation_id: allocation.quotationId,
            amount: allocation.amount,
            note: allocation.note || null,
          })),
        })
        .then((response) => response.data),
    onSuccess: () => {
      void refreshPaymentData();
      notify.success('Đã phân bổ khoản thu');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể phân bổ khoản thu')),
  });

  const refundMutation = useMutation({
    mutationFn: ({ paymentId, values }: { paymentId: number; values: PaymentRefundInput }) =>
      api.post<Payment>(`/payments/${paymentId}/refunds`, values).then((response) => response.data),
    onSuccess: () => {
      void refreshPaymentData();
      notify.success('Đã ghi nhận hoàn tiền');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể ghi nhận hoàn tiền')),
  });

  const linkMutation = useMutation({
    mutationFn: ({ paymentId, values }: { paymentId: number; values: PaymentLinkInput }) =>
      api.post<Payment>(`/payments/${paymentId}/link`, values).then((response) => response.data),
    onSuccess: () => {
      void refreshPaymentData();
      notify.success('Đã cập nhật phân loại giao dịch');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể cập nhật giao dịch')),
  });

  const removeAllocationMutation = useMutation({
    mutationFn: ({ paymentId, allocationId }: { paymentId: number; allocationId: number }) =>
      api
        .delete<Payment>(`/payments/${paymentId}/allocations/${allocationId}`)
        .then((response) => response.data),
    onSuccess: () => {
      void refreshPaymentData();
      notify.success('Đã hủy phân bổ');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể hủy phân bổ')),
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <PaymentManager
      payments={payments}
      filters={filters}
      page={page}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      pageSize={pageSize}
      isFetching={isFetching}
      isMutating={
        allocateMutation.isPending ||
        refundMutation.isPending ||
        linkMutation.isPending ||
        removeAllocationMutation.isPending
      }
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onFiltersChange={onFiltersChange}
      onAllocate={(paymentId, allocations) =>
        allocateMutation.mutateAsync({ paymentId, allocations })
      }
      onRefund={(paymentId, values) => refundMutation.mutateAsync({ paymentId, values })}
      onLink={(paymentId, values) => linkMutation.mutateAsync({ paymentId, values })}
      onRemoveAllocation={(paymentId, allocationId) =>
        removeAllocationMutation.mutateAsync({ paymentId, allocationId })
      }
    />
  );
}
