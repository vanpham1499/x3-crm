'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { ServiceManager } from '@/features/services/components/service-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  SERVICE_QUOTE_CONFIG_GROUP,
  toServiceQuoteConfigPayload,
  type ServiceQuoteConfigMeta,
} from '@/lib/service-quote-config';
import { toServicePayload } from '@/lib/service-utils';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';
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

  const { data: quoteConfigs = [], isFetching: quoteConfigsFetching } = useQuery<AppOption[]>({
    queryKey: ['options', SERVICE_QUOTE_CONFIG_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SERVICE_QUOTE_CONFIG_GROUP } })
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

  const quoteConfigMutation = useMutation({
    mutationFn: ({
      service,
      values,
      option,
    }: {
      service: ServiceItem;
      values: ServiceQuoteConfigMeta;
      option?: AppOption | null;
    }) => {
      const payload = toServiceQuoteConfigPayload(service, values);

      if (option) {
        return api
          .put<AppOption>(`/options/${option.id}`, payload)
          .then((response) => response.data);
      }

      return api.post<AppOption>('/options', payload).then((response) => response.data);
    },
    onSuccess: (savedOption, variables) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', SERVICE_QUOTE_CONFIG_GROUP],
        (current = []) => {
          if (variables.option) {
            return current.map((option) => (option.id === savedOption.id ? savedOption : option));
          }

          return current.some((option) => option.id === savedOption.id)
            ? current.map((option) => (option.id === savedOption.id ? savedOption : option))
            : [...current, savedOption];
        },
      );
      notify.success('Cập nhật cấu hình báo giá thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu cấu hình báo giá thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <ServiceManager
      services={services}
      filters={filters}
      isFetching={isFetching || quoteConfigsFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      isSavingQuoteConfig={quoteConfigMutation.isPending}
      quoteConfigs={quoteConfigs}
      onFiltersChange={setFilters}
      onSubmit={(values, service) => saveMutation.mutate({ values, service })}
      onDelete={(service) => deleteMutation.mutate(service)}
      onSaveQuoteConfig={(service, values, option) =>
        quoteConfigMutation.mutateAsync({ service, values, option })
      }
    />
  );
}
