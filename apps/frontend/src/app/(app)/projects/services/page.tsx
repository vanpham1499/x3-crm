'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { ServiceManager } from '@/features/services/components/service-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { toServicePayload } from '@/lib/service-utils';
import api from '@/services/api/client';
import type { ServiceFilters, ServiceFormValues, ServiceItem } from '@/types/service';

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [filters, setFilters] = useState<ServiceFilters>({ keyword: '', is_active: '' });

  const { data: services = [], isFetching, isLoading } = useQuery<ServiceItem[]>({
    queryKey: ['services', filters],
    queryFn: () =>
      api
        .get('/services', {
          params: {
            tree: true,
            keyword: filters.keyword || undefined,
            is_active: filters.is_active || undefined,
          },
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values, service }: { values: ServiceFormValues; service?: ServiceItem | null }) => {
      const payload = toServicePayload(values);

      if (service) {
        return api.put(`/services/${service.id}`, payload);
      }

      return api.post('/services', payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      notify.success(variables.service ? 'Cập nhật dịch vụ thành công' : 'Tạo dịch vụ thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu dịch vụ thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (service: ServiceItem) => api.delete(`/services/${service.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      notify.success('Xóa dịch vụ thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa dịch vụ thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <ServiceManager
      services={services}
      filters={filters}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onFiltersChange={setFilters}
      onSubmit={(values, service) => saveMutation.mutate({ values, service })}
      onDelete={(service) => deleteMutation.mutate(service)}
    />
  );
}
