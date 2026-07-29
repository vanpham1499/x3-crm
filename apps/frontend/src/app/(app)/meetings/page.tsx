'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { SummaryMetricCard } from '@/components/data-display/summary-metric-card';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { CompactAutocompleteField } from '@/components/form/compact-autocomplete-field';
import { CompactSearchField } from '@/components/form/compact-search-field';
import { CompactSelectField } from '@/components/form/compact-select-field';
import { FormDatePicker } from '@/components/form/form-date-picker';
import { ListFilterBar } from '@/components/form/list-filter-bar';
import { IconTabs } from '@/components/navigation/icon-tabs';
import { PageHeader } from '@/components/shell/page-header';
import { MeetingCalendar } from '@/features/meetings/components/meeting-calendar';
import { MeetingDetailDialog } from '@/features/meetings/components/meeting-detail-dialog';
import { MeetingFormDialog } from '@/features/meetings/components/meeting-form-dialog';
import { MeetingList } from '@/features/meetings/components/meeting-list';
import { MeetingStatusDialog } from '@/features/meetings/components/meeting-status-dialog';
import { getApiErrorMessage } from '@/lib/api-error';
import { hasPermission } from '@/lib/ownership';
import api from '@/services/api/client';
import { useAuthStore } from '@/stores/auth-store';
import type { Department } from '@/types/department';
import type {
  Meeting,
  MeetingFilters,
  MeetingListResponse,
  MeetingPayload,
  MeetingSummary,
} from '@/types/meeting';
import type { User } from '@/types/user';

const INITIAL_FILTERS: MeetingFilters = {
  keyword: '',
  organizerUserId: '',
  departmentId: '',
  meetingType: '',
  status: '',
};

const EMPTY_SUMMARY: MeetingSummary = {
  today: 0,
  upcoming: 0,
  waitingConfirmation: 0,
  overdue: 0,
};

type SummaryScope = '' | 'today' | 'upcoming' | 'waiting' | 'overdue';

type SaveIntent = {
  meetingId?: number;
  payload: MeetingPayload;
};

function conflictMessages(error: unknown): string[] {
  const conflicts = (error as { response?: { data?: { errors?: { conflicts?: unknown } } } })
    ?.response?.data?.errors?.conflicts;

  return Array.isArray(conflicts)
    ? conflicts.filter((message): message is string => typeof message === 'string')
    : [];
}

function monthGridRange(month: Dayjs) {
  const firstOfMonth = month.startOf('month');
  const mondayOffset = (firstOfMonth.day() + 6) % 7;
  const firstDate = firstOfMonth.subtract(mondayOffset, 'day');

  return {
    dateFrom: firstDate.startOf('day').toISOString(),
    dateTo: firstDate.add(41, 'day').endOf('day').toISOString(),
  };
}

export default function MeetingsPage() {
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const currentUser = useAuthStore((state) => state.user);
  const canCreate = hasPermission(currentUser, 'meeting.create');
  const [activeTab, setActiveTab] = useState(0);
  const [month, setMonth] = useState(dayjs().startOf('month'));
  const [filters, setFilters] = useState<MeetingFilters>(INITIAL_FILTERS);
  const deferredKeyword = useDeferredValue(filters.keyword);
  const [summaryScope, setSummaryScope] = useState<SummaryScope>('');
  const [selectedListDate, setSelectedListDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [formMeeting, setFormMeeting] = useState<Meeting | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [completeMeeting, setCompleteMeeting] = useState<Meeting | null>(null);
  const [cancelMeeting, setCancelMeeting] = useState<Meeting | null>(null);
  const [noShowMeeting, setNoShowMeeting] = useState<Meeting | null>(null);
  const [deleteMeeting, setDeleteMeeting] = useState<Meeting | null>(null);
  const [conflictIntent, setConflictIntent] = useState<SaveIntent | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const calendarRange = useMemo(() => monthGridRange(month), [month]);
  const selectedListDateRange = useMemo(
    () =>
      selectedListDate
        ? {
            dateFrom: dayjs(selectedListDate).startOf('day').toISOString(),
            dateTo: dayjs(selectedListDate).endOf('day').toISOString(),
          }
        : null,
    [selectedListDate],
  );

  const requestFilters = useMemo(
    () => ({
      keyword: deferredKeyword || undefined,
      organizer_user_id: filters.organizerUserId || undefined,
      department_id: filters.departmentId || undefined,
      meeting_type: filters.meetingType || undefined,
      status: filters.status || undefined,
    }),
    [deferredKeyword, filters],
  );

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'meeting-options'],
    queryFn: () =>
      api.get<User[]>('/users/lookup?context=meeting').then((response) => response.data),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', 'meeting-options'],
    queryFn: () => api.get<Department[]>('/departments/lookup').then((response) => response.data),
    enabled:
      hasPermission(currentUser, 'department.lookup') ||
      hasPermission(currentUser, 'department.view'),
  });

  const { data: summary = EMPTY_SUMMARY } = useQuery<MeetingSummary>({
    queryKey: ['meetings', 'summary'],
    queryFn: () => api.get<MeetingSummary>('/meetings/summary').then((response) => response.data),
  });

  const { data: calendarMeetings = [], isFetching: isCalendarFetching } = useQuery<Meeting[]>({
    queryKey: ['meetings', 'calendar', calendarRange, requestFilters],
    queryFn: ({ signal }) =>
      api
        .get<Meeting[]>('/meetings', {
          params: {
            ...requestFilters,
            date_from: calendarRange.dateFrom,
            date_to: calendarRange.dateTo,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
    enabled: activeTab === 0,
  });

  const { data: listResponse, isFetching: isListFetching } = useQuery<MeetingListResponse>({
    queryKey: ['meetings', 'list', requestFilters, summaryScope, selectedListDate, page, pageSize],
    queryFn: ({ signal }) =>
      api
        .get<MeetingListResponse>('/meetings', {
          params: {
            ...requestFilters,
            scope: summaryScope || undefined,
            date_from: selectedListDateRange?.dateFrom,
            date_to: selectedListDateRange?.dateTo,
            page,
            per_page: pageSize,
          },
          signal,
        })
        .then((response) => response.data),
    placeholderData: keepPreviousData,
    enabled: activeTab === 1,
  });

  const { data: detailMeeting, isFetching: isDetailFetching } = useQuery<Meeting>({
    queryKey: ['meetings', 'detail', detailId],
    queryFn: () => api.get<Meeting>(`/meetings/${detailId}`).then((response) => response.data),
    enabled: Boolean(detailId),
  });

  const refreshMeetings = () => {
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ meetingId, payload }: SaveIntent) =>
      meetingId
        ? api.put<Meeting>(`/meetings/${meetingId}`, payload)
        : api.post<Meeting>('/meetings', payload),
    onSuccess: (_, variables) => {
      refreshMeetings();
      setFormOpen(false);
      setFormMeeting(null);
      setConflictIntent(null);
      setConflicts([]);
      notify.success(variables.meetingId ? 'Đã cập nhật lịch hẹn' : 'Đã tạo lịch hẹn');
    },
    onError: (error, variables) => {
      const messages = conflictMessages(error);

      if (messages.length > 0) {
        setConflictIntent(variables);
        setConflicts(messages);
        return;
      }

      notify.error(getApiErrorMessage(error, 'Không thể lưu lịch hẹn'));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (meeting: Meeting) => api.post(`/meetings/${meeting.id}/confirm`),
    onSuccess: () => {
      refreshMeetings();
      notify.success('Đã xác nhận lịch hẹn');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xác nhận lịch hẹn')),
  });

  const completeMutation = useMutation({
    mutationFn: ({ meeting, payload }: { meeting: Meeting; payload: Record<string, unknown> }) =>
      api.post(`/meetings/${meeting.id}/complete`, payload),
    onSuccess: () => {
      refreshMeetings();
      setCompleteMeeting(null);
      notify.success('Đã hoàn thành lịch hẹn');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể hoàn thành lịch hẹn')),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ meeting, payload }: { meeting: Meeting; payload: Record<string, unknown> }) =>
      api.post(`/meetings/${meeting.id}/cancel`, payload),
    onSuccess: () => {
      refreshMeetings();
      setCancelMeeting(null);
      notify.success('Đã hủy lịch hẹn');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể hủy lịch hẹn')),
  });

  const noShowMutation = useMutation({
    mutationFn: (meeting: Meeting) => api.post(`/meetings/${meeting.id}/no-show`),
    onSuccess: () => {
      refreshMeetings();
      setNoShowMeeting(null);
      notify.success('Đã cập nhật khách không tham gia');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể cập nhật lịch hẹn')),
  });

  const deleteMutation = useMutation({
    mutationFn: (meeting: Meeting) => api.delete(`/meetings/${meeting.id}`),
    onSuccess: () => {
      refreshMeetings();
      setDeleteMeeting(null);
      setDetailId(null);
      notify.success('Đã xóa lịch hẹn');
    },
    onError: (error) => notify.error(getApiErrorMessage(error, 'Không thể xóa lịch hẹn')),
  });

  const updateFilter = <Key extends keyof MeetingFilters>(key: Key, value: MeetingFilters[Key]) => {
    setPage(1);
    setSummaryScope('');
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreate = (date?: string) => {
    if (!canCreate) return;
    setFormMeeting(null);
    setDefaultDate(date);
    setFormOpen(true);
  };

  const openEdit = (meeting: Meeting) => {
    setDetailId(null);
    setFormMeeting(meeting);
    setDefaultDate(undefined);
    setFormOpen(true);
  };

  const openSummary = (scope: Exclude<SummaryScope, ''>) => {
    setPage(1);
    setFilters(INITIAL_FILTERS);
    setSelectedListDate('');
    setSummaryScope((current) => (current === scope ? '' : scope));
    setActiveTab(1);
  };

  const openDayList = (date: string) => {
    setPage(1);
    setSummaryScope('');
    setSelectedListDate(date);
    setActiveTab(1);
  };

  const meta = listResponse?.meta || {
    currentPage: page,
    lastPage: 1,
    perPage: pageSize,
    total: 0,
    from: null,
    to: null,
  };
  const listActionProps = {
    onView: (meeting: Meeting) => setDetailId(meeting.id),
    onEdit: openEdit,
    onConfirm: (meeting: Meeting) => confirmMutation.mutate(meeting),
    onComplete: setCompleteMeeting,
    onCancel: setCancelMeeting,
    onNoShow: setNoShowMeeting,
    onDelete: setDeleteMeeting,
  };

  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <PageHeader
        title="Lịch hẹn"
        action={
          canCreate
            ? {
                label: 'Tạo lịch hẹn',
                icon: <AddRoundedIcon />,
                onClick: () => openCreate(),
              }
            : undefined
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          label="Lịch hôm nay"
          value={summary.today}
          helper="Tất cả cuộc hẹn trong ngày"
          active={summaryScope === 'today'}
          tone="blue"
          icon={<TodayOutlinedIcon />}
          onClick={() => openSummary('today')}
        />
        <SummaryMetricCard
          label="7 ngày tới"
          value={summary.upcoming}
          helper="Lịch đang chờ xử lý"
          active={summaryScope === 'upcoming'}
          tone="emerald"
          icon={<EventAvailableOutlinedIcon />}
          onClick={() => openSummary('upcoming')}
        />
        <SummaryMetricCard
          label="Chờ xác nhận"
          value={summary.waitingConfirmation}
          helper="Lịch chưa được xác nhận"
          active={summaryScope === 'waiting'}
          tone="amber"
          icon={<HelpOutlineRoundedIcon />}
          onClick={() => openSummary('waiting')}
        />
        <SummaryMetricCard
          label="Quá giờ"
          value={summary.overdue}
          helper="Cần cập nhật kết quả"
          active={summaryScope === 'overdue'}
          tone="rose"
          icon={<WarningAmberRoundedIcon />}
          onClick={() => openSummary('overdue')}
        />
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-border-tabs">
          <IconTabs
            value={activeTab}
            ariaLabel="Điều hướng lịch hẹn"
            items={[
              { label: 'Lịch tháng', icon: <CalendarMonthOutlinedIcon /> },
              { label: 'Danh sách', icon: <FormatListBulletedRoundedIcon /> },
            ]}
            onChange={(tab) => {
              setActiveTab(tab);
              if (tab === 0) setSummaryScope('');
            }}
          />
        </div>

        <ListFilterBar className="border-b border-slate-200 p-4">
          <CompactSearchField
            label="Tìm kiếm"
            placeholder="Mã, tiêu đề, khách hàng, dự án"
            value={filters.keyword}
            onChange={(value) => updateFilter('keyword', value)}
          />
          <div className="w-full md:w-44">
            <CompactAutocompleteField
              label="Người phụ trách"
              value={filters.organizerUserId}
              options={users
                .filter((user) => user.isActive !== false)
                .map((user) => ({
                  value: String(user.id),
                  label: [user.code, user.name].filter(Boolean).join(' - '),
                }))}
              onChange={(value) => updateFilter('organizerUserId', value)}
            />
          </div>
          <div className="w-full md:w-44">
            <CompactAutocompleteField
              label="Phòng ban"
              value={filters.departmentId}
              options={departments.map((department) => ({
                value: String(department.id),
                label: department.name,
              }))}
              onChange={(value) => updateFilter('departmentId', value)}
            />
          </div>
          <div className="w-full md:w-44">
            <CompactSelectField
              label="Hình thức"
              value={filters.meetingType}
              options={[
                { value: 'online', label: 'Họp online' },
                { value: 'onsite', label: 'Gặp trực tiếp' },
                { value: 'phone', label: 'Gọi điện' },
              ]}
              onChange={(value) => updateFilter('meetingType', value)}
            />
          </div>
          <div className="w-full md:w-44">
            <CompactSelectField
              label="Trạng thái"
              value={filters.status}
              options={[
                { value: 'scheduled', label: 'Chờ xác nhận' },
                { value: 'confirmed', label: 'Đã xác nhận' },
                { value: 'completed', label: 'Hoàn thành' },
                { value: 'cancelled', label: 'Đã hủy' },
                { value: 'no_show', label: 'Không tham gia' },
                { value: 'overdue', label: 'Quá giờ' },
              ]}
              onChange={(value) => updateFilter('status', value)}
            />
          </div>
          {activeTab === 1 ? (
            <div className="w-full md:w-44">
              <FormDatePicker
                label="Ngày hẹn"
                value={selectedListDate}
                onChange={(value) => {
                  setPage(1);
                  setSummaryScope('');
                  setSelectedListDate(value);
                }}
              />
            </div>
          ) : null}
        </ListFilterBar>

        {activeTab === 0 ? (
          <MeetingCalendar
            month={month}
            meetings={calendarMeetings}
            isLoading={isCalendarFetching}
            canCreate={canCreate}
            onMonthChange={(value) => setMonth(value.startOf('month'))}
            onSelectDate={openCreate}
            onSelectMeeting={(meeting) => setDetailId(meeting.id)}
            onShowMore={openDayList}
          />
        ) : (
          <MeetingList
            meetings={listResponse?.data || []}
            isFetching={isListFetching}
            page={meta.currentPage}
            totalPages={meta.lastPage}
            totalItems={meta.total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPage(1);
              setPageSize(value);
            }}
            {...listActionProps}
          />
        )}
      </section>

      <MeetingFormDialog
        open={formOpen}
        meeting={formMeeting}
        users={users}
        currentUserId={currentUser?.id}
        defaultDate={defaultDate}
        isSubmitting={saveMutation.isPending}
        onClose={() => {
          if (saveMutation.isPending) return;
          setFormOpen(false);
          setFormMeeting(null);
        }}
        onSubmit={(payload) =>
          saveMutation.mutateAsync({
            meetingId: formMeeting?.id,
            payload,
          })
        }
      />

      <MeetingDetailDialog
        meeting={detailMeeting || null}
        loading={isDetailFetching}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
        onConfirm={(meeting) => confirmMutation.mutate(meeting)}
        onComplete={setCompleteMeeting}
        onCancel={setCancelMeeting}
        onNoShow={setNoShowMeeting}
      />

      <MeetingStatusDialog
        meeting={completeMeeting}
        mode="complete"
        isSubmitting={completeMutation.isPending}
        onClose={() => setCompleteMeeting(null)}
        onSubmit={(payload) =>
          completeMeeting
            ? completeMutation.mutateAsync({ meeting: completeMeeting, payload })
            : Promise.resolve()
        }
      />

      <MeetingStatusDialog
        meeting={cancelMeeting}
        mode="cancel"
        isSubmitting={cancelMutation.isPending}
        onClose={() => setCancelMeeting(null)}
        onSubmit={(payload) =>
          cancelMeeting
            ? cancelMutation.mutateAsync({ meeting: cancelMeeting, payload })
            : Promise.resolve()
        }
      />

      <ConfirmDialog
        open={Boolean(noShowMeeting)}
        title="Khách không tham gia?"
        description="Lịch hẹn sẽ được kết thúc với trạng thái khách không tham gia."
        confirmText="Cập nhật"
        loading={noShowMutation.isPending}
        onClose={() => setNoShowMeeting(null)}
        onConfirm={() => {
          if (noShowMeeting) noShowMutation.mutate(noShowMeeting);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteMeeting)}
        title="Xóa lịch hẹn?"
        description="Lịch hẹn sẽ không còn xuất hiện trên lịch và danh sách."
        confirmText="Xóa lịch"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteMeeting(null)}
        onConfirm={() => {
          if (deleteMeeting) deleteMutation.mutate(deleteMeeting);
        }}
      />

      <ConfirmDialog
        open={Boolean(conflictIntent)}
        title="Phát hiện trùng lịch"
        description="Một hoặc nhiều nhân sự đang có lịch trong khoảng thời gian này."
        confirmText="Vẫn lưu lịch"
        loading={saveMutation.isPending}
        onClose={() => {
          setConflictIntent(null);
          setConflicts([]);
        }}
        onConfirm={() => {
          if (!conflictIntent) return;
          saveMutation.mutate({
            ...conflictIntent,
            payload: { ...conflictIntent.payload, allowConflict: true },
          });
        }}
      >
        <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {conflicts.map((message) => (
            <li key={message} className="text-sm font-semibold text-amber-800">
              • {message}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
