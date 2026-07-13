'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { KpiCategoryManager } from '@/features/settings/components/kpi-category-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  KPI_CATEGORY_OPTION_GROUP,
  toKpiCategoryPayload,
  type KpiCategoryFormValues,
} from '@/lib/kpi-category-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

export default function KpiCategoriesPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const {
    data: categories = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', KPI_CATEGORY_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: KPI_CATEGORY_OPTION_GROUP } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      category,
    }: {
      values: KpiCategoryFormValues;
      category?: AppOption | null;
    }) => {
      const payload = toKpiCategoryPayload(values, category?.sortOrder ?? (categories.length + 1) * 10);

      return category
        ? api.put<AppOption>(`/options/${category.id}`, payload).then((response) => response.data)
        : api.post<AppOption>('/options', payload).then((response) => response.data);
    },
    onSuccess: (_savedCategory, variables) => {
      queryClient.invalidateQueries({ queryKey: ['options', KPI_CATEGORY_OPTION_GROUP] });
      notify.success(variables.category ? 'Cập nhật hạng mục thành công' : 'Tạo hạng mục thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Lưu hạng mục thất bại')),
  });

  const deleteMutation = useMutation({
    mutationFn: (category: AppOption) => api.delete(`/options/${category.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['options', KPI_CATEGORY_OPTION_GROUP] });
      notify.success('Xóa hạng mục thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa hạng mục thất bại')),
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <KpiCategoryManager
      categories={categories}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onSubmit={(values, category) => saveMutation.mutateAsync({ values, category })}
      onDelete={(category) => deleteMutation.mutate(category)}
    />
  );
}
