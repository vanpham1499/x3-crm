'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { OptionsManager } from '@/features/options/components/options-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import { SYSTEM_OPTION_GROUPS, toOptionPayload } from '@/lib/option-utils';
import api from '@/services/api/client';
import type { AppOption, OptionFormValues } from '@/types/option';

export default function SystemOptionsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();

  const {
    data: options = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', 'system'],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SYSTEM_OPTION_GROUPS.join(',') } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const saveMutation = useMutation({
    mutationFn: ({ values, option }: { values: OptionFormValues; option?: AppOption | null }) => {
      const payload = toOptionPayload(values);

      if (option) {
        return api
          .put<AppOption>(`/options/${option.id}`, payload)
          .then((response) => response.data);
      }

      return api.post<AppOption>('/options', payload).then((response) => response.data);
    },
    onSuccess: (savedOption, variables) => {
      queryClient.setQueryData<AppOption[]>(['options', 'system'], (current = []) => {
        if (variables.option) {
          return current.map((option) => (option.id === savedOption.id ? savedOption : option));
        }

        return current.some((option) => option.id === savedOption.id)
          ? current.map((option) => (option.id === savedOption.id ? savedOption : option))
          : [...current, savedOption];
      });
      notify.success(variables.option ? 'Cập nhật option thành công' : 'Tạo option thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu option thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (option: AppOption) => api.delete(`/options/${option.id}`),
    onSuccess: (_response, deletedOption) => {
      queryClient.setQueryData<AppOption[]>(['options', 'system'], (current = []) =>
        current.filter((option) => option.id !== deletedOption.id),
      );
      notify.success('Xóa option thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa option thất bại'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ group, orderedOptions }: { group: string; orderedOptions: AppOption[] }) =>
      api
        .patch<AppOption[]>('/options/reorder', {
          group,
          optionIds: orderedOptions.map((option) => option.id),
        })
        .then((response) => response.data),
    onMutate: async ({ group, orderedOptions }) => {
      await queryClient.cancelQueries({ queryKey: ['options', 'system'] });

      const previousOptions = queryClient.getQueryData<AppOption[]>(['options', 'system']);
      const orderMap = new Map(
        orderedOptions.map((option, index) => [option.id, (index + 1) * 10]),
      );

      queryClient.setQueryData<AppOption[]>(['options', 'system'], (current = []) =>
        current.map((option) =>
          option.group === group && orderMap.has(option.id)
            ? { ...option, sortOrder: orderMap.get(option.id) }
            : option,
        ),
      );

      return { previousOptions };
    },
    onSuccess: (updatedGroupOptions, variables) => {
      queryClient.setQueryData<AppOption[]>(['options', 'system'], (current = []) => {
        const otherGroups = current.filter((option) => option.group !== variables.group);
        return [...otherGroups, ...updatedGroupOptions];
      });
      notify.success('Cập nhật thứ tự option thành công');
    },
    onError: (error, _variables, context) => {
      if (context?.previousOptions) {
        queryClient.setQueryData(['options', 'system'], context.previousOptions);
      }
      notify.error(getApiErrorMessage(error, 'Cập nhật thứ tự thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <OptionsManager
      options={options}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      savingGroup={saveMutation.isPending ? saveMutation.variables?.values.group || null : null}
      reorderingGroup={reorderMutation.isPending ? reorderMutation.variables?.group || null : null}
      onSubmit={(values, option) => saveMutation.mutateAsync({ values, option })}
      onDelete={(option) => deleteMutation.mutate(option)}
      onReorder={(group, orderedOptions) => reorderMutation.mutate({ group, orderedOptions })}
    />
  );
}
