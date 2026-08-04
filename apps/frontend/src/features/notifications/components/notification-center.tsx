'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import { Badge, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { UtilityDrawer } from '@/components/shell/utility-drawer';
import {
  archiveNotification,
  getNotifications,
  getNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
  restoreNotification,
} from '@/features/notifications/api';
import { useNotificationRealtime } from '@/features/notifications/use-notification-realtime';
import { useBrowserNotificationBadge } from '@/features/notifications/use-browser-notification-badge';
import { useAuthStore } from '@/stores/auth-store';
import type { NotificationSummary, UserNotification } from '@/types/notification';

dayjs.extend(relativeTime);
dayjs.locale('vi');

type NotificationFilter = 'all' | 'unread' | 'archived';

const filterLabels: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'archived', label: 'Đã lưu trữ' },
];

function notificationIcon(module: string) {
  if (module === 'meeting') return <CalendarMonthRoundedIcon fontSize="small" />;
  if (module === 'weekly_report') return <DescriptionRoundedIcon fontSize="small" />;
  if (module === 'cost' || module === 'payment') return <PaymentsRoundedIcon fontSize="small" />;
  if (module === 'p2point') return <EmojiEventsRoundedIcon fontSize="small" />;
  if (module === 'lead') return <PersonSearchRoundedIcon fontSize="small" />;
  if (module === 'project') return <WorkRoundedIcon fontSize="small" />;
  return <NotificationsNoneRoundedIcon fontSize="small" />;
}

function severityClass(severity: UserNotification['severity']) {
  if (severity === 'success') return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50';
  if (severity === 'warning') return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50';
  if (severity === 'error') return 'bg-rose-50 text-rose-600 dark:bg-rose-950/50';
  return 'bg-sky-50 text-sky-600 dark:bg-sky-950/50';
}

function NotificationRow({
  item,
  onOpen,
  onArchive,
  archived,
}: {
  item: UserNotification;
  onOpen: (item: UserNotification) => void;
  onArchive: (item: UserNotification) => void;
  archived: boolean;
}) {
  return (
    <div
      className={`group relative flex min-h-[88px] gap-3 border-b border-dashed border-slate-200 px-5 py-4 transition dark:border-slate-800 ${
        item.isRead ? 'bg-white dark:bg-slate-950' : 'bg-emerald-50/45 dark:bg-emerald-950/10'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`${item.title}${item.isRead ? '' : ', chưa đọc'}`}
      >
        <span
          className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${severityClass(item.severity)}`}
        >
          {notificationIcon(item.module)}
        </span>
        <span className="min-w-0 flex-1 pr-7">
          <span className="flex items-start gap-2">
            <span className="line-clamp-2 flex-1 text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
              {item.title}
            </span>
            {!item.isRead ? (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Chưa đọc" />
            ) : null}
          </span>
          {item.message ? (
            <span className="mt-1 line-clamp-2 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
              {item.message}
            </span>
          ) : null}
          <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">
            {dayjs(item.createdAt).fromNow()}
          </span>
        </span>
      </button>
      <Tooltip title={archived ? 'Khôi phục' : 'Lưu trữ'}>
        <IconButton
          size="small"
          onClick={() => onArchive(item)}
          aria-label={`${archived ? 'Khôi phục' : 'Lưu trữ'} thông báo ${item.title}`}
          className="!absolute !right-3 !top-11 !h-9 !w-9 !text-slate-400 opacity-60 transition focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {archived ? <UnarchiveRoundedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </div>
  );
}

type NotificationCenterProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function NotificationCenter({ open, onToggle, onClose }: NotificationCenterProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const enabled = status === 'authenticated' && Boolean(user?.id);
  useNotificationRealtime(user?.id, enabled);
  const summaryQuery = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: getNotificationSummary,
    enabled,
    refetchInterval: enabled ? 15000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const notificationsQuery = useInfiniteQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: ({ pageParam }) => getNotifications(pageParam, filter),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.currentPage < lastPage.meta.lastPage
        ? lastPage.meta.currentPage + 1
        : undefined,
    enabled: enabled && open,
    refetchInterval: open ? 300000 : false,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh,
  });
  const archiveMutation = useMutation({
    mutationFn: archiveNotification,
    onSuccess: refresh,
  });
  const restoreMutation = useMutation({
    mutationFn: restoreNotification,
    onSuccess: refresh,
  });
  const items = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [notificationsQuery.data],
  );
  const unreadCount = summaryQuery.data?.unreadCount || 0;
  useBrowserNotificationBadge(unreadCount);
  const getFilterCount = (value: NotificationFilter) => {
    if (value === 'unread') return summaryQuery.data?.unreadCount || 0;
    if (value === 'archived') return summaryQuery.data?.archivedCount || 0;
    return summaryQuery.data?.totalCount || 0;
  };
  const handleOpen = async (item: UserNotification) => {
    if (!item.isRead) {
      const previousSummary = queryClient.getQueryData<NotificationSummary>([
        'notifications',
        'summary',
      ]);
      queryClient.setQueryData<NotificationSummary>(['notifications', 'summary'], (current) =>
        current
          ? {
              ...current,
              unreadCount: Math.max(0, current.unreadCount - 1),
              attentionCount: Math.max(0, current.attentionCount - 1),
            }
          : current,
      );
      try {
        await markNotificationRead(item.id);
        refresh();
      } catch {
        queryClient.setQueryData(['notifications', 'summary'], previousSummary);
      }
    }
    onClose();
    if (item.actionUrl) router.push(item.actionUrl);
  };

  return (
    <>
      <Tooltip title={`Thông báo · ${summaryQuery.data?.unreadCount || 0} chưa đọc`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Mở thông báo, ${summaryQuery.data?.unreadCount || 0} chưa đọc`}
          aria-expanded={open}
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            open
              ? 'bg-emerald-50 text-primary dark:bg-emerald-950/40'
              : 'text-slate-500 hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Badge
            badgeContent={Math.min(unreadCount, 99)}
            color="error"
            max={99}
            invisible={unreadCount === 0}
          >
            <NotificationsNoneRoundedIcon />
          </Badge>
        </button>
      </Tooltip>

      <UtilityDrawer
        open={open}
        onClose={onClose}
        title="Thông báo"
        actions={
          (summaryQuery.data?.unreadCount || 0) > 0 ? (
            <Tooltip title="Đánh dấu tất cả đã đọc">
              <span>
                <IconButton
                  onClick={() => readAllMutation.mutate()}
                  disabled={readAllMutation.isPending}
                  aria-label="Đánh dấu tất cả thông báo là đã đọc"
                  className="!h-11 !w-11 !text-primary"
                >
                  <DoneAllRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          ) : null
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {filterLabels.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    filter === option.value
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  <span
                    className={`inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] ${
                      filter === option.value
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {getFilterCount(option.value)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {notificationsQuery.isLoading ? (
              <div className="flex h-48 items-center justify-center" aria-label="Đang tải thông báo">
                <CircularProgress size={28} />
              </div>
            ) : notificationsQuery.isError ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Chưa tải được thông báo
                </p>
                <button
                  type="button"
                  onClick={() => notificationsQuery.refetch()}
                  className="mt-3 min-h-11 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  Thử lại
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <CheckCircleRoundedIcon />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Không có thông báo phù hợp
                </p>
                <p className="mt-1 text-xs text-slate-500">Thông báo mới sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={handleOpen}
                  archived={filter === 'archived'}
                  onArchive={(notification) =>
                    filter === 'archived'
                      ? restoreMutation.mutate(notification.id)
                      : archiveMutation.mutate(notification.id)
                  }
                />
              ))
            )}
            {notificationsQuery.hasNextPage ? (
              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={() => notificationsQuery.fetchNextPage()}
                  disabled={notificationsQuery.isFetchingNextPage}
                  className="min-h-11 rounded-lg px-4 text-xs font-bold text-primary transition hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/30"
                >
                  {notificationsQuery.isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </UtilityDrawer>
    </>
  );
}
