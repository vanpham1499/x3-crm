'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PaymentManager } from '@/features/payments/components/payment-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  Payment,
  PaymentAllocationInput,
  PaymentFilters,
  PaymentLinkInput,
  PaymentRefund,
  PaymentRefundFilters,
  PaymentRefundInput,
  PaymentRefundUpdateInput,
} from '@/types/payment';

const PAYMENTS_PAGE_SIZE = 10;
const PAYMENTS_LIST_QUERY_KEY = ['payments', 'list'] as const;
const PAYMENT_REFUNDS_LIST_QUERY_KEY = ['payment-refunds', 'list'] as const;
const DEFAULT_PAYMENT_FILTERS: PaymentFilters = {
  keyword: '',
  status: '',
  reconciled_status: '',
  date_from: '',
  date_to: '',
};
const DEFAULT_REFUND_FILTERS: PaymentRefundFilters = {
  keyword: '',
  refund_type: '',
  status: '',
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
    group_by_quotation: 1,
  };
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'incoming' | 'refunds'>('incoming');
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState<PaymentFilters>({
      initialFilters: DEFAULT_PAYMENT_FILTERS,
      queryKey: PAYMENTS_LIST_QUERY_KEY,
      pageSize: PAYMENTS_PAGE_SIZE,
    });
  const {
    filters: refundFilters,
    requestFilters: requestRefundFilters,
    page: refundPage,
    pageSize: refundPageSize,
    setPage: setRefundPage,
    setPageSize: setRefundPageSize,
    onFiltersChange: onRefundFiltersChange,
  } = useServerListState<PaymentRefundFilters>({
    initialFilters: DEFAULT_REFUND_FILTERS,
    queryKey: PAYMENT_REFUNDS_LIST_QUERY_KEY,
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
  const {
    data: refundsPage,
    isFetching: isRefundsFetching,
    isLoading: isRefundsLoading,
  } = useQuery<PaginatedResponse<PaymentRefund>>({
    queryKey: [...PAYMENT_REFUNDS_LIST_QUERY_KEY, requestRefundFilters, refundPage, refundPageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<PaymentRefund>>('/payment-refunds', {
          params: {
            keyword: requestRefundFilters.keyword.trim() || undefined,
            refund_type: requestRefundFilters.refund_type || undefined,
            status: requestRefundFilters.status || undefined,
            date_from: requestRefundFilters.date_from || undefined,
            date_to: requestRefundFilters.date_to || undefined,
            page: refundPage,
            per_page: refundPageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
    enabled: activeTab === 'refunds',
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
  const refunds = refundsPage?.data || [];
  const refundPagination = refundsPage?.meta || {
    currentPage: refundPage,
    lastPage: 1,
    perPage: refundPageSize,
    total: 0,
    from: null,
    to: null,
  };

  useEffect(() => {
    if (page > pagination.lastPage) {
      setPage(Math.max(1, pagination.lastPage));
    }
  }, [page, pagination.lastPage, setPage]);

  useEffect(() => {
    if (refundPage > refundPagination.lastPage) {
      setRefundPage(Math.max(1, refundPagination.lastPage));
    }
  }, [refundPage, refundPagination.lastPage, setRefundPage]);

  const refreshPaymentData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['payment-refunds'] }),
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
      notify.success('Đã tạo khoản trả khách');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể tạo khoản trả khách')),
  });

  const updateRefundMutation = useMutation({
    mutationFn: ({ refundId, values }: { refundId: number; values: PaymentRefundUpdateInput }) =>
      api
        .patch<PaymentRefund>(`/payment-refunds/${refundId}`, values)
        .then((response) => response.data),
    onSuccess: (_, variables) => {
      void refreshPaymentData();
      notify.success(
        variables.values.status === 'completed'
          ? 'Đã xác nhận chuyển tiền cho khách'
          : variables.values.status === 'cancelled'
            ? 'Đã hủy khoản trả khách'
            : 'Đã cập nhật khoản trả khách và tính lại công nợ',
      );
    },
    onError: (error) =>
      notify.error(getApiErrorMessage(error, 'Không thể cập nhật khoản trả khách')),
  });

  const deleteRefundMutation = useMutation({
    mutationFn: (refundId: number) =>
      api.delete(`/payment-refunds/${refundId}`).then(() => undefined),
    onSuccess: () => {
      void refreshPaymentData();
      notify.success('Đã xóa khoản trả khách và tính lại công nợ');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa khoản trả khách')),
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

  if (isLoading || (activeTab === 'refunds' && isRefundsLoading)) {
    return <ContentLoading />;
  }

  return (
    <PaymentManager
      payments={payments}
      refunds={refunds}
      activeTab={activeTab}
      filters={filters}
      refundFilters={refundFilters}
      page={page}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      pageSize={pageSize}
      refundPage={refundPage}
      refundTotalPages={refundPagination.lastPage}
      refundTotalItems={refundPagination.total}
      refundPageSize={refundPageSize}
      isFetching={isFetching}
      isRefundsFetching={isRefundsFetching}
      isMutating={
        allocateMutation.isPending ||
        refundMutation.isPending ||
        updateRefundMutation.isPending ||
        deleteRefundMutation.isPending ||
        linkMutation.isPending ||
        removeAllocationMutation.isPending
      }
      currentUser={currentUser}
      onTabChange={setActiveTab}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onFiltersChange={onFiltersChange}
      onRefundPageChange={setRefundPage}
      onRefundPageSizeChange={setRefundPageSize}
      onRefundFiltersChange={onRefundFiltersChange}
      onAllocate={(paymentId, allocations) =>
        allocateMutation.mutateAsync({ paymentId, allocations })
      }
      onRefund={(paymentId, values) => refundMutation.mutateAsync({ paymentId, values })}
      onUpdateRefund={(refundId, values) => updateRefundMutation.mutateAsync({ refundId, values })}
      onDeleteRefund={(refundId) => deleteRefundMutation.mutateAsync(refundId)}
      onLink={(paymentId, values) => linkMutation.mutateAsync({ paymentId, values })}
      onRemoveAllocation={(paymentId, allocationId) =>
        removeAllocationMutation.mutateAsync({ paymentId, allocationId })
      }
    />
  );
}
