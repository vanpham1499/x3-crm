'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button, LinearProgress, TextField } from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  DEFAULT_SITE_PROFILE,
  SITE_PROFILE_FIELDS,
  SITE_PROFILE_OPTION_GROUP,
  siteProfileFromOptions,
  toSiteProfileOptionPayload,
  type SiteProfile,
} from '@/lib/site-profile-options';
import api from '@/services/api/client';
import type { AppOption } from '@/types/option';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const [formValues, setFormValues] = useState<SiteProfile>(DEFAULT_SITE_PROFILE);

  const {
    data: profileOptions = [],
    isFetching,
    isLoading,
  } = useQuery<AppOption[]>({
    queryKey: ['options', SITE_PROFILE_OPTION_GROUP],
    queryFn: () =>
      api
        .get<AppOption[]>('/options', { params: { groups: SITE_PROFILE_OPTION_GROUP } })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setFormValues(siteProfileFromOptions(profileOptions));
  }, [profileOptions]);

  const saveMutation = useMutation({
    mutationFn: async (values: SiteProfile) => {
      const savedOptions = await Promise.all(
        SITE_PROFILE_FIELDS.map((field, index) => {
          const existingOption = profileOptions.find((option) => option.key === field.key);
          const payload = toSiteProfileOptionPayload(field, values[field.key], (index + 1) * 10);

          if (existingOption) {
            return api
              .put<AppOption>(`/options/${existingOption.id}`, payload)
              .then((response) => response.data);
          }

          return api.post<AppOption>('/options', payload).then((response) => response.data);
        }),
      );

      return savedOptions;
    },
    onSuccess: (savedOptions) => {
      queryClient.setQueryData<AppOption[]>(['options', SITE_PROFILE_OPTION_GROUP], savedOptions);
      queryClient.invalidateQueries({ queryKey: ['options', SITE_PROFILE_OPTION_GROUP] });
      notify.success('Cập nhật thông tin website thành công');
    },
    onError: (error) => {
      notify.error(getApiErrorMessage(error, 'Cập nhật thông tin website thất bại'));
    },
  });

  const updateField = (field: keyof SiteProfile, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Cài đặt</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Cài đặt</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {(isFetching || saveMutation.isPending) && <LinearProgress />}
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Tổng quan website</h2>
            <p className="mt-1 text-sm text-slate-500">
              Thông tin này được lưu vào option backend và dùng lại trên mẫu báo giá.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2">
            {SITE_PROFILE_FIELDS.map((field) => (
              <TextField
                key={field.key}
                fullWidth
                label={field.label}
                value={formValues[field.key]}
                multiline={field.multiline}
                minRows={field.multiline ? 3 : undefined}
                disabled={isLoading || saveMutation.isPending}
                onChange={(event) => updateField(field.key, event.target.value)}
                className={field.multiline ? 'md:col-span-2' : undefined}
              />
            ))}
          </div>

          <div className="flex justify-end border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              disabled={isLoading || saveMutation.isPending}
              onClick={() => saveMutation.mutate(formValues)}
              className="!bg-slate-900 hover:!bg-slate-800"
            >
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu thông tin'}
            </Button>
          </div>
        </section>

        <Link
          href="/settings/options"
          className="inline-flex min-h-24 items-center gap-4 self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CategoryRoundedIcon />
          </span>
          <span>
            <span className="block font-bold text-slate-950">Tùy chọn</span>
            <span className="mt-1 block text-sm text-slate-500">
              Quản lý option dùng chung cho các page.
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
