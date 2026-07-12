'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { LinearProgress } from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryActionButton } from '@/components/actions/primary-action-button';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { PageHeader } from '@/components/shell/page-header';
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
      <PageHeader title="Cài đặt" />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <form
          className="xl:col-span-8"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(formValues);
          }}
        >
          <FormSection
            title="Thông tin website"
            action={
              <PrimaryActionButton
                type="submit"
                startIcon={<SaveRoundedIcon />}
                disabled={isLoading || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu thông tin'}
              </PrimaryActionButton>
            }
          >
            {(isFetching || saveMutation.isPending) && (
              <LinearProgress className="!-mx-5 !-mt-5 !mb-1" color="primary" />
            )}
            <div className="!mt-0 grid gap-4 md:grid-cols-2">
              {SITE_PROFILE_FIELDS.map((field) => (
                <FormInputField
                  key={field.key}
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
          </FormSection>
        </form>

        <div className="xl:col-span-4">
          <FormSection title="Thiết lập khác">
            <Link
              href="/settings/bank-accounts"
              className="!mt-0 flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-emerald-50/40"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <AccountBalanceRoundedIcon fontSize="small" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                Tài khoản nhận tiền
              </span>
              <ChevronRightRoundedIcon className="text-slate-400" />
            </Link>

            <Link
              href="/settings/options"
              className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-emerald-50/40"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CategoryRoundedIcon fontSize="small" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                Tùy chọn hệ thống
              </span>
              <ChevronRightRoundedIcon className="text-slate-400" />
            </Link>
          </FormSection>
        </div>
      </div>
    </div>
  );
}
