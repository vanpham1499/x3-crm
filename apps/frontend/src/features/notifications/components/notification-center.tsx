'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
} from '@mui/material';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { UtilityDrawer } from '@/components/shell/utility-drawer';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { AppFormDialog } from '@/components/dialog/app-form-dialog';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  handleNotification,
  handleAllNotifications,
  previewHandleAllNotifications,
  getNotifications,
  getNotificationSummary,
  markNotificationRead,
  restoreNotification,
} from '@/features/notifications/api';
import { useNotificationRealtime } from '@/features/notifications/use-notification-realtime';
import { useBrowserNotificationBadge } from '@/features/notifications/use-browser-notification-badge';
import { useAuthStore } from '@/stores/auth-store';
import type { NotificationPage, NotificationSummary, UserNotification } from '@/types/notification';

dayjs.extend(relativeTime);
dayjs.locale('vi');
const moduleLabels: Record<string, string> = {
  internal_discussion: 'Trao đổi nội bộ',
  weekly_report: 'Báo cáo tuần',
  payment: 'Thanh toán',
  cost: 'Chi phí',
  project: 'Dự án',
  lead: 'Lead',
  meeting: 'Lịch hẹn',
  p2point: 'Điểm P2',
  'zalo-team': 'Zalo Team',
};
function moduleLabel(module: string) {
  return moduleLabels[module] || 'Thông báo khác';
}
function notificationIcon(module: string) {
  if (module === 'internal_discussion') return <ChatBubbleOutlineRoundedIcon fontSize="small" />;
  if (module === 'meeting') return <CalendarMonthRoundedIcon fontSize="small" />;
  if (module === 'weekly_report') return <DescriptionRoundedIcon fontSize="small" />;
  if (module === 'cost' || module === 'payment') return <PaymentsRoundedIcon fontSize="small" />;
  if (module === 'p2point') return <EmojiEventsRoundedIcon fontSize="small" />;
  if (module === 'lead') return <PersonSearchRoundedIcon fontSize="small" />;
  if (module === 'project') return <WorkRoundedIcon fontSize="small" />;
  return <NotificationsNoneRoundedIcon fontSize="small" />;
}
function NotificationRow({
  item,
  busy,
  onOpen,
  onHandle,
}: {
  item: UserNotification;
  busy: boolean;
  onOpen: (item: UserNotification) => void;
  onHandle: (item: UserNotification) => void;
}) {
  const action = item.isDone ? 'Đưa về chưa xử lý' : 'Đánh dấu đã xử lý';
  const reason =
    item.doneSource === 'workflow'
      ? 'Đã đóng theo nghiệp vụ'
      : item.doneSource === 'legacy_archive'
        ? 'Lưu trữ trước đây'
        : 'Đã đánh dấu xong';
  return (
    <div
      className={`flex items-start gap-2 border-b border-slate-100 p-4 transition-colors dark:border-slate-800 ${!item.isRead && !item.isDone ? 'bg-primary/5' : 'bg-white dark:bg-slate-950'}`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        disabled={busy}
        className="flex min-w-0 flex-1 gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        aria-label={`${item.title}${item.isRead ? '' : ', chưa đọc'}`}
      >
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.isDone ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-primary/10 text-primary'}`}
        >
          {notificationIcon(item.module)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {moduleLabel(item.module)}
            {!item.isRead && (
              <span className="h-2 w-2 rounded-full bg-primary" aria-label="Chưa đọc" />
            )}
          </span>
          <span className="block break-words text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">
            {item.title}
          </span>
          {item.message && (
            <span className="mt-1 block break-words text-sm leading-5 text-slate-600 dark:text-slate-300">
              {item.message}
            </span>
          )}
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <time
              dateTime={item.createdAt}
              title={dayjs(item.createdAt).format('HH:mm DD/MM/YYYY')}
            >
              {dayjs(item.createdAt).fromNow()}
            </time>
            {item.isDone && <span>· {reason}</span>}
            {!item.isDone && item.isResolved && <span>· Đưa lại vào danh sách</span>}
          </span>
        </span>
      </button>
      <Tooltip title={action}>
        <span>
          <IconButton
            disabled={busy}
            onClick={() => onHandle(item)}
            aria-label={`${action}: ${item.title}`}
            className="!h-11 !w-11 !text-slate-500 hover:!bg-primary/10 hover:!text-primary"
          >
            {item.isDone ? (
              <UndoRoundedIcon fontSize="small" />
            ) : (
              <CheckCircleOutlineRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );
}

type NotificationCenterProps = { open: boolean; onToggle: () => void; onClose: () => void };
export function NotificationCenter({ open, onToggle, onClose }: NotificationCenterProps) {
  const router = useRouter();
  const client = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const [filter, setFilter] = useState<'all' | 'done'>('all');
  const [module, setModule] = useState('');
  const [unread, setUnread] = useState(false);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<UserNotification | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState({ module: '', unread: false });
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const enabled = status === 'authenticated' && Boolean(user?.id);
  const connected = useNotificationRealtime(user?.id, enabled);
  const prefix = ['notifications', user?.id] as const;
  const summaryKey = [...prefix, 'summary'];
  useEffect(() => {
    setFilter('all');
    setModule('');
    setUnread(false);
    setUndo(null);
    setError('');
    setBulkOpen(false);
    setBulkResult(null);
  }, [user?.id]);
  const summaryQuery = useQuery({
    queryKey: summaryKey,
    queryFn: ({ signal }) => getNotificationSummary(signal),
    enabled,
    refetchInterval: enabled ? (connected ? 300000 : 60000) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const notificationsQuery = useInfiniteQuery({
    queryKey: [...prefix, 'list', filter, module, unread],
    queryFn: ({ pageParam, signal }) => getNotifications(pageParam, filter, module, unread, signal),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.meta.currentPage < page.meta.lastPage ? page.meta.currentPage + 1 : undefined,
    enabled: enabled && open,
    refetchInterval: open && !connected ? 60000 : false,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (open && enabled)
      void client.invalidateQueries({ queryKey: ['notifications', user?.id, 'summary'] });
  }, [open, enabled, user?.id, client]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: prefix });
  };
  const handling = useMutation({
    mutationFn: ({ item, restore }: { item: UserNotification; restore: boolean }) =>
      restore ? restoreNotification(item.id) : handleNotification(item.id),
    onMutate: async ({ item, restore }) => {
      setError('');
      await client.cancelQueries({ queryKey: prefix });
      const snapshots = client.getQueriesData({ queryKey: prefix });
      client.setQueriesData<InfiniteData<NotificationPage>>(
        { queryKey: [...prefix, 'list'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              data: page.data.filter((row) => row.id !== item.id),
            })),
          },
      );
      const delta = restore ? 1 : -1;
      client.setQueryData<NotificationSummary>(
        summaryKey,
        (current) =>
          current && {
            ...current,
            totalCount: Math.max(0, current.totalCount + delta),
            attentionCount: Math.max(0, current.attentionCount + delta),
            doneCount: Math.max(0, current.doneCount - delta),
            unreadCount: Math.max(0, current.unreadCount - (!restore && !item.isRead ? 1 : 0)),
            modules: current.modules.map((row) =>
              row.module !== item.module
                ? row
                : {
                    ...row,
                    pendingCount: Math.max(0, row.pendingCount + delta),
                    doneCount: Math.max(0, row.doneCount - delta),
                    unreadCount: Math.max(0, row.unreadCount - (!restore && !item.isRead ? 1 : 0)),
                  },
            ),
          },
      );
      return { snapshots };
    },
    onError: (failure, _variables, context) => {
      context?.snapshots.forEach(([key, value]) => client.setQueryData(key, value));
      setError(getApiErrorMessage(failure, 'Chưa cập nhật được thông báo. Vui lòng thử lại.'));
    },
    onSuccess: (_data, { item, restore }) => setUndo(restore ? null : item),
    onSettled: refresh,
  });
  const bulkPreview = useMutation({
    mutationFn: (scope: { module: string; unread: boolean }) =>
      previewHandleAllNotifications(scope.module, scope.unread),
    onError: (failure) =>
      setBulkError(
        getApiErrorMessage(failure, 'Chưa tải được danh sách xác nhận. Vui lòng thử lại.'),
      ),
  });
  const bulkHandling = useMutation({
    mutationFn: handleAllNotifications,
    onMutate: () => {
      setBulkError('');
      setUndo(null);
    },
    onError: (failure) =>
      setBulkError(getApiErrorMessage(failure, 'Chưa xử lý được thông báo. Vui lòng thử lại.')),
    onSuccess: async ({ updatedCount }) => {
      setBulkOpen(false);
      setBulkResult(
        updatedCount
          ? `Đã xử lý ${updatedCount.toLocaleString('vi-VN')} thông báo`
          : 'Không còn thông báo cần xử lý trong danh sách đã chọn',
      );
      await client.invalidateQueries({ queryKey: prefix });
    },
  });
  const openBulkConfirmation = () => {
    const scope = { module, unread };
    setBulkScope(scope);
    setBulkError('');
    bulkPreview.reset();
    setBulkOpen(true);
    bulkPreview.mutate(scope);
  };
  const items = useMemo(
    () =>
      Array.from(
        new Map(
          (notificationsQuery.data?.pages.flatMap((page) => page.data) ?? []).map((item) => [
            item.id,
            item,
          ]),
        ).values(),
      ),
    [notificationsQuery.data],
  );
  const summary = summaryQuery.data;
  const pending = summary?.totalCount ?? 0;
  useBrowserNotificationBadge(enabled ? pending : 0);
  const selectedModule = summary?.modules.find((row) => row.module === module);
  const counts = {
    all: selectedModule?.pendingCount ?? pending,
    done: selectedModule?.doneCount ?? summary?.doneCount ?? 0,
  };
  const handleOpen = async (item: UserNotification) => {
    setError('');
    if (!item.isRead) {
      try {
        await markNotificationRead(item.id);
        refresh();
      } catch (failure) {
        setError(getApiErrorMessage(failure, 'Chưa đánh dấu đã đọc được. Vui lòng thử lại.'));
        return;
      }
    }
    if (item.actionUrl?.startsWith('/') && !item.actionUrl.startsWith('//')) {
      onClose();
      router.push(item.actionUrl);
    }
  };
  return (
    <>
      <Tooltip title={`Thông báo · ${pending} chưa xử lý`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Mở thông báo, ${pending} chưa xử lý`}
          aria-expanded={open}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${open ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          <Badge badgeContent={pending} color="error" max={99} invisible={pending === 0}>
            <NotificationsNoneRoundedIcon />
          </Badge>
        </button>
      </Tooltip>
      <UtilityDrawer open={open} onClose={onClose} title="Thông báo">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <Tabs
              value={filter}
              onChange={(_event, value: 'all' | 'done') => {
                setFilter(value);
                setUnread(false);
              }}
              variant="fullWidth"
              aria-label="Trạng thái thông báo"
            >
              <Tab
                value="all"
                label={`Tất cả (${counts.all})`}
                className="!min-h-12 !normal-case"
              />
              <Tab
                value="done"
                label={`Đã xử lý (${counts.done})`}
                className="!min-h-12 !normal-case"
              />
            </Tabs>
            <div className="px-4 pb-2 pt-4">
              <CompactSelectField
                label="Phân hệ"
                value={module}
                onChange={setModule}
                allLabel="Tất cả phân hệ"
                options={Array.from(
                  new Set([
                    ...Object.keys(moduleLabels),
                    ...(summary?.modules ?? []).map((row) => row.module),
                  ]),
                )
                  .map((key) => ({
                    value: key,
                    label: `${moduleLabel(key)} (${summary?.modules.find((row) => row.module === key)?.[filter === 'done' ? 'doneCount' : 'pendingCount'] ?? 0})`,
                  }))
                  .sort((a, b) => a.label.localeCompare(b.label, 'vi'))}
              />
              {filter === 'all' && (
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <FormControlLabel
                    className="!ml-0 !mr-0 !mt-1"
                    control={
                      <Checkbox
                        size="small"
                        checked={unread}
                        onChange={(event) => setUnread(event.target.checked)}
                        className="!min-h-11 !min-w-11"
                      />
                    }
                    label={<span className="text-sm">Chỉ chưa đọc</span>}
                  />
                  <DialogActionButton
                    startIcon={<CheckCircleOutlineRoundedIcon fontSize="small" />}
                    disabled={
                      handling.isPending ||
                      bulkHandling.isPending ||
                      notificationsQuery.isLoading ||
                      notificationsQuery.isError ||
                      !items.length
                    }
                    onClick={openBulkConfirmation}
                  >
                    Xử lý tất cả
                  </DialogActionButton>
                </div>
              )}
            </div>
            {error && (
              <Alert severity="error" onClose={() => setError('')} className="!mx-4 !mb-3">
                {error}
              </Alert>
            )}
            {summaryQuery.isError && (
              <Alert
                severity="warning"
                className="!mx-4 !mb-3"
                action={<Button onClick={() => summaryQuery.refetch()}>Thử lại</Button>}
              >
                Chưa cập nhật được số thông báo.
              </Alert>
            )}
          </div>
          <div
            className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
            key={`${filter}-${module}-${unread}`}
          >
            {notificationsQuery.isLoading ? (
              <div className="grid h-48 place-items-center" aria-label="Đang tải thông báo">
                <CircularProgress size={28} />
              </div>
            ) : notificationsQuery.isError ? (
              <div className="p-6 text-center">
                <p className="text-sm">Chưa tải được thông báo</p>
                <Button onClick={() => notificationsQuery.refetch()}>Thử lại</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-slate-500 dark:text-slate-400">
                <CheckCircleOutlineRoundedIcon className="!text-4xl" />
                <p className="text-sm font-semibold">
                  {module || unread
                    ? 'Không có thông báo phù hợp'
                    : filter === 'done'
                      ? 'Chưa có thông báo đã xử lý'
                      : 'Đã xử lý hết thông báo'}
                </p>
              </div>
            ) : (
              items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  busy={handling.isPending || bulkHandling.isPending}
                  onOpen={handleOpen}
                  onHandle={(row) => handling.mutate({ item: row, restore: row.isDone })}
                />
              ))
            )}
            {notificationsQuery.hasNextPage && (
              <div className="p-3 text-center">
                <Button
                  disabled={notificationsQuery.isFetchingNextPage}
                  onClick={() => notificationsQuery.fetchNextPage()}
                  className="!min-h-11"
                >
                  {notificationsQuery.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
                </Button>
              </div>
            )}
          </div>
        </div>
        <Snackbar
          open={open && Boolean(undo)}
          autoHideDuration={6000}
          onClose={(_event, reason) => {
            if (reason !== 'clickaway') setUndo(null);
          }}
          message="Đã chuyển sang Đã xử lý"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          action={
            <Button
              color="inherit"
              disabled={handling.isPending}
              onClick={() => {
                if (undo) handling.mutate({ item: undo, restore: true });
              }}
            >
              Hoàn tác
            </Button>
          }
        />
      </UtilityDrawer>
      <AppFormDialog
        open={open && bulkOpen}
        title="Xử lý tất cả thông báo"
        maxWidth="xs"
        submitting={bulkHandling.isPending}
        onClose={() => setBulkOpen(false)}
        onSubmit={(event) => {
          event.preventDefault();
          if (bulkPreview.data?.count && !bulkHandling.isPending)
            bulkHandling.mutate(bulkPreview.data.token);
        }}
        actions={
          <>
            <DialogActionButton
              disabled={bulkHandling.isPending}
              onClick={() => setBulkOpen(false)}
            >
              Hủy
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              type="submit"
              disabled={bulkPreview.isPending || !bulkPreview.data?.count || bulkHandling.isPending}
            >
              {bulkHandling.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </DialogActionButton>
          </>
        }
      >
        {bulkPreview.isPending ? (
          <div role="status" className="flex items-center gap-3 py-3 text-sm text-slate-500">
            <CircularProgress size={20} />
            Đang kiểm tra số thông báo...
          </div>
        ) : (
          bulkPreview.data && (
            <>
              <p className="text-sm font-semibold text-slate-900">
                {bulkPreview.data.count
                  ? `Đánh dấu ${bulkPreview.data.count.toLocaleString('vi-VN')} thông báo là đã xử lý?`
                  : 'Không có thông báo phù hợp để xử lý.'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {bulkScope.module ? moduleLabel(bulkScope.module) : 'Tất cả phân hệ'}
                {bulkScope.unread ? ' · Chỉ chưa đọc' : ''} · Toàn bộ kết quả
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Chỉ cập nhật thông báo của anh/chị. Báo cáo, thanh toán và chi phí vẫn giữ nguyên
                trạng thái duyệt.
              </p>
            </>
          )
        )}
        {bulkError && (
          <Alert severity="error" className="!mt-3">
            {bulkError}
          </Alert>
        )}
      </AppFormDialog>
      <Snackbar
        open={Boolean(bulkResult)}
        autoHideDuration={6000}
        onClose={() => setBulkResult(null)}
        message={bulkResult}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </>
  );
}
