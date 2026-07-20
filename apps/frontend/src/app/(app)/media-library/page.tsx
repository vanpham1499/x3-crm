'use client';

import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { MediaManager } from '@/features/media/components/media-manager';
import { useServerListState } from '@/hooks/use-server-list-state';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { MediaItem } from '@/types/media';
import type { PaginatedResponse } from '@/types/pagination';

const MEDIA_PAGE_SIZE = 12;
const MEDIA_LIST_QUERY_KEY = ['media', 'library'] as const;

export default function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const { filters, requestFilters, page, pageSize, setPage, setPageSize, onFiltersChange } =
    useServerListState({
      initialFilters: { keyword: '' },
      queryKey: MEDIA_LIST_QUERY_KEY,
      pageSize: MEDIA_PAGE_SIZE,
    });

  const { data: imagesPage, isFetching } = useQuery<PaginatedResponse<MediaItem>>({
    queryKey: [...MEDIA_LIST_QUERY_KEY, requestFilters.keyword, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<PaginatedResponse<MediaItem>>('/media', {
          params: {
            scope: 'all',
            keyword: requestFilters.keyword.trim() || undefined,
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  const pagination = imagesPage?.meta || {
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

  const refreshMedia = () => {
    void queryClient.invalidateQueries({ queryKey: ['media'] });
  };

  const createMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);

      return api.post<MediaItem>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      refreshMedia();
      notify.success('Thêm ảnh vào thư viện thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể thêm ảnh')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ image, name }: { image: MediaItem; name: string }) =>
      api.patch<MediaItem>(`/media/${image.id}`, { name }),
    onSuccess: () => {
      refreshMedia();
      notify.success('Cập nhật ảnh thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể cập nhật ảnh')),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ image, detachUsage }: { image: MediaItem; detachUsage: boolean }) =>
      api.delete(`/media/${image.id}`, {
        params: { detach_usage: detachUsage ? 1 : undefined },
      }),
    onSuccess: () => {
      refreshMedia();
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['quotations'] });
      void queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success('Xóa ảnh thành công');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa ảnh')),
  });

  return (
    <MediaManager
      images={imagesPage?.data || []}
      keyword={filters.keyword}
      page={pagination.currentPage}
      pageSize={pageSize}
      totalPages={pagination.lastPage}
      totalItems={pagination.total}
      isFetching={isFetching}
      isSubmitting={createMutation.isPending || updateMutation.isPending}
      isDeleting={deleteMutation.isPending}
      onKeywordChange={(keyword) => onFiltersChange({ keyword })}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onCreate={(file, name) => createMutation.mutateAsync({ file, name })}
      onUpdate={(image, name) => updateMutation.mutateAsync({ image, name })}
      onDelete={(image, detachUsage) => deleteMutation.mutateAsync({ image, detachUsage })}
    />
  );
}
