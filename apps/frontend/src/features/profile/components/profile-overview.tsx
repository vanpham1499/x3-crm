'use client';

import { useMemo, useState } from 'react';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import PeopleAltTwoToneIcon from '@mui/icons-material/PeopleAltTwoTone';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import WorkTwoToneIcon from '@mui/icons-material/WorkTwoTone';
import { Avatar } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import profileCover from '@assets/images/background-3-blur.webp';
import { PageHeader } from '@/components/shell/page-header';
import { getMediaPreviewUrl } from '@/lib/media-url';
import { formatDate } from '@/lib/utils';
import {
  getUserRoleClass,
  getUserRoleLabel,
  getUserStatusClass,
  getUserStatusLabel,
} from '@/lib/user-utils';
import { api } from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types/user';

type AuthProfileResponse = {
  user?: User;
  data?: User;
  role?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  permissions?: string[];
};

type ProfileTab = 'profile' | 'projects' | 'customers';

const tabs: Array<{
  id: ProfileTab;
  label: string;
  icon: React.ElementType;
}> = [
  { id: 'profile', label: 'Hồ sơ', icon: PersonRoundedIcon },
  { id: 'projects', label: 'Dự án', icon: WorkTwoToneIcon },
  { id: 'customers', label: 'Khách hàng', icon: PeopleAltTwoToneIcon },
];

function normalizeProfile(data?: AuthProfileResponse | User | null) {
  if (!data) return null;
  if ('id' in data) return data;
  return data.user || data.data || null;
}

function getInitial(user?: User | null) {
  const source = user?.name || user?.email || user?.code || 'X';
  return source.trim().charAt(0).toUpperCase();
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-white p-4">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <div className="mt-1 truncate text-sm font-semibold text-slate-950">{value || '-'}</div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <p className="mt-2 text-sm text-slate-500">
        Khu vực này đã được chuẩn bị để gắn dữ liệu khi cần mở rộng.
      </p>
    </div>
  );
}

export function ProfileOverview() {
  const { user: cachedUser, status, setAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  const { data: profileUser = cachedUser, isFetching } = useQuery({
    queryKey: ['auth', 'profile'],
    enabled: status === 'authenticated',
    queryFn: async () => {
      const response = await api.get<AuthProfileResponse>('/auth/me');
      const nextUser = normalizeProfile(response.data);

      if (nextUser) {
        setAuth(nextUser);
      }

      return nextUser;
    },
    initialData: cachedUser,
  });

  const avatarUrl = getMediaPreviewUrl(profileUser?.avatar);
  const displayName = profileUser?.name || profileUser?.email || profileUser?.code || 'X3Sales';
  const roleLabel = getUserRoleLabel(profileUser?.role || '');
  const profileFacts = useMemo(
    () => [
      {
        label: 'Mã nhân viên',
        value: profileUser?.code,
      },
      {
        label: 'Vai trò',
        value: (
          <span
            className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserRoleClass(profileUser?.role || '')}`}
          >
            {roleLabel}
          </span>
        ),
      },
      {
        label: 'Trạng thái',
        value: profileUser ? (
          <span
            className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${getUserStatusClass(profileUser)}`}
          >
            {getUserStatusLabel(profileUser)}
          </span>
        ) : (
          '-'
        ),
      },
      {
        label: 'Ngày tạo',
        value: profileUser?.createdAt ? formatDate(profileUser.createdAt) : '-',
      },
      {
        label: 'Cập nhật',
        value: profileUser?.updatedAt ? formatDate(profileUser.updatedAt) : '-',
      },
    ],
    [profileUser, roleLabel],
  );

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50/60 p-6">
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader
          title="Hồ sơ cá nhân"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Tài khoản' },
            { label: 'Hồ sơ' },
          ]}
        />

        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className="relative min-h-[240px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(6,78,59,.92), rgba(15,118,110,.72)), url(${profileCover.src})`,
            }}
          >
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-6 pb-8 pt-20 sm:flex-row sm:items-end">
              <Avatar
                src={avatarUrl || undefined}
                alt={displayName}
                className="!h-28 !w-28 !border-4 !border-white !bg-primary !text-3xl !font-bold !text-white !shadow-lg"
              >
                {getInitial(profileUser)}
              </Avatar>
              <div className="pb-2 text-white">
                <h2 className="text-2xl font-bold">{displayName}</h2>
                <p className="mt-1 text-sm font-semibold text-white/75">{roleLabel}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-bold transition ${
                    active
                      ? 'border-slate-950 text-slate-950'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="text-[20px]" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === 'profile' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Thông tin cá nhân</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Thông tin tài khoản đang đăng nhập trong hệ thống.
                  </p>
                </div>
                {isFetching ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    Đang cập nhật
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoItem
                  label="Email"
                  value={profileUser?.email}
                  icon={<EmailRoundedIcon fontSize="small" />}
                />
                <InfoItem
                  label="Số điện thoại"
                  value={profileUser?.phone || '-'}
                  icon={<PhoneRoundedIcon fontSize="small" />}
                />
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-950">Ghi chú</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Trang profile hiện chỉ hiển thị thông tin cá nhân. Các tab Dự án và Khách hàng đã
                  được giữ sẵn để nối dữ liệu liên quan đến user trong các bước tiếp theo.
                </p>
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Tài khoản</h2>
              <div className="mt-5 space-y-3">
                {profileFacts.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-500">{item.label}</span>
                    <span className="min-w-0 truncate text-right text-sm font-bold text-slate-950">
                      {item.value || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === 'projects' ? <PlaceholderPanel title="Dự án của user" /> : null}
        {activeTab === 'customers' ? <PlaceholderPanel title="Khách hàng của user" /> : null}
      </div>
    </div>
  );
}
