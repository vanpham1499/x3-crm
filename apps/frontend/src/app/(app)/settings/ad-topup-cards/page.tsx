'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { AdTopupCardManager } from '@/features/settings/components/ad-topup-card-manager';
import {
  AD_TOPUP_CARD_OPTION_GROUP,
  getAdTopupCardMetaValue,
  toAdTopupCardPayload,
  type AdTopupCardFormValues,
} from '@/lib/ad-topup-card-options';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

function matchesKeyword(card: AppOption, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  return [card.key, card.label, card.value, getAdTopupCardMetaValue(card, 'note')]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword));
}

export default function AdTopupCardsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [keyword, setKeyword] = useState('');

  const {
    data: options = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', AD_TOPUP_CARD_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: AD_TOPUP_CARD_OPTION_GROUP } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const cards = useMemo(
    () => options.filter((card) => matchesKeyword(card, keyword)),
    [keyword, options],
  );

  const saveMutation = useMutation({
    mutationFn: ({ values, card }: { values: AdTopupCardFormValues; card?: AppOption | null }) => {
      const payload = toAdTopupCardPayload(values);
      return card
        ? api.put<AppOption>(`/options/${card.id}`, payload).then((response) => response.data)
        : api.post<AppOption>('/options', payload).then((response) => response.data);
    },
    onSuccess: (savedCard, variables) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', AD_TOPUP_CARD_OPTION_GROUP],
        (current = []) =>
          variables.card
            ? current.map((card) => (card.id === savedCard.id ? savedCard : card))
            : [...current, savedCard],
      );
      notify.success(variables.card ? 'Cập nhật thẻ nạp thành công' : 'Thêm thẻ nạp thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Lưu thẻ nạp thất bại')),
  });

  const deleteMutation = useMutation({
    mutationFn: (card: AppOption) => api.delete(`/options/${card.id}`),
    onSuccess: (_response, deletedCard) => {
      queryClient.setQueryData<AppOption[]>(
        ['options', AD_TOPUP_CARD_OPTION_GROUP],
        (current = []) => current.filter((card) => card.id !== deletedCard.id),
      );
      notify.success('Xóa thẻ nạp thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Xóa thẻ nạp thất bại')),
  });

  if (isLoading) return <ContentLoading />;

  return (
    <AdTopupCardManager
      cards={cards}
      keyword={keyword}
      isFetching={isFetching}
      isSubmitting={saveMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onKeywordChange={setKeyword}
      onSubmit={(values, card) => saveMutation.mutateAsync({ values, card })}
      onDelete={(card) => deleteMutation.mutate(card)}
    />
  );
}
