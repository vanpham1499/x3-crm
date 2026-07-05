'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PartnerManager } from '@/features/partners/components/partner-manager';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  PROJECT_PARTNER_OPTION_GROUP,
  getPartnerMetaValue,
  toProjectPartnerPayload,
  type ProjectPartnerFormValues,
} from '@/lib/project-partner-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

function matchesKeyword(partner: AppOption, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) return true;

  return [
    partner.key,
    partner.label,
    partner.value,
    getPartnerMetaValue(partner, 'accountNo'),
    getPartnerMetaValue(partner, 'bankName'),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
}

export default function ProjectPartnersPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [keyword, setKeyword] = useState('');

  const {
    data: options = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', PROJECT_PARTNER_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: PROJECT_PARTNER_OPTION_GROUP } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const partners = useMemo(
    () => options.filter((partner) => matchesKeyword(partner, keyword)),
    [keyword, options],
  );

  const saveMutation = useMutation({
    mutationFn: ({
      values,
      partner,
    }: {
      values: ProjectPartnerFormValues;
      partner?: AppOption | null;
    }) => {
      const payload = toProjectPartnerPayload(values);

      if (partner) {
        return api
          .put<AppOption>(`/options/${partner.id}`, payload)
          .then((response) => response.data);
      }

      return api.post<AppOption>('/options', payload).then((response) => response.data);
    },
    onSuccess: (savedPartner, variables) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', PROJECT_PARTNER_OPTION_GROUP],
        (current = []) => {
          if (variables.partner) {
            return current.map((partner) =>
              partner.id === savedPartner.id ? savedPartner : partner,
            );
          }

          return current.some((partner) => partner.id === savedPartner.id)
            ? current.map((partner) => (partner.id === savedPartner.id ? savedPartner : partner))
            : [...current, savedPartner];
        },
      );
      notify.success(variables.partner ? 'Cập nhật đối tác thành công' : 'Tạo đối tác thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Lưu đối tác thất bại'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (partner: AppOption) => api.delete(`/options/${partner.id}`),
    onSuccess: (_response, deletedPartner) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', PROJECT_PARTNER_OPTION_GROUP],
        (current = []) => current.filter((partner) => partner.id !== deletedPartner.id),
      );
      notify.success('Xóa đối tác thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Xóa đối tác thất bại'));
    },
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return (
    <PartnerManager
      partners={partners}
      keyword={keyword}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onKeywordChange={setKeyword}
      onSubmit={(values, partner) => saveMutation.mutateAsync({ values, partner })}
      onDelete={(partner) => deleteMutation.mutate(partner)}
    />
  );
}
