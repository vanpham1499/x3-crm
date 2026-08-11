'use client';

import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import dayjs from 'dayjs';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { formatCustomerIdentity } from '@/lib/customer-utils';
import type { Meeting } from '@/types/meeting';

type MeetingDetailDialogProps = {
  meeting: Meeting | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onConfirm: (meeting: Meeting) => void;
  onComplete: (meeting: Meeting) => void;
  onCancel: (meeting: Meeting) => void;
  onNoShow: (meeting: Meeting) => void;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Khách không tham gia',
};

const TYPE_LABELS: Record<string, string> = {
  online: 'Họp online',
  onsite: 'Gặp trực tiếp',
  phone: 'Gọi điện',
};

const HISTORY_LABELS: Record<string, string> = {
  created: 'Tạo lịch hẹn',
  updated: 'Cập nhật lịch hẹn',
  rescheduled: 'Đổi lịch hẹn',
  confirmed: 'Xác nhận lịch hẹn',
  completed: 'Hoàn thành lịch hẹn',
  cancelled: 'Hủy lịch hẹn',
  no_show: 'Khách không tham gia',
};

function relatedLabel(meeting: Meeting) {
  if (meeting.project) {
    return [meeting.project.projectCode, meeting.project.projectName].filter(Boolean).join(' - ');
  }

  if (meeting.customer) {
    return formatCustomerIdentity(meeting.customer);
  }

  return [meeting.lead?.leadCode, meeting.lead?.customerName].filter(Boolean).join(' - ');
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-800">{value || '-'}</dd>
    </div>
  );
}

export function MeetingDetailDialog({
  meeting,
  loading = false,
  onClose,
  onEdit,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
}: MeetingDetailDialogProps) {
  if (!meeting) return null;

  const active = ['scheduled', 'confirmed'].includes(meeting.status);
  const statusLabel = meeting.isOverdue ? 'Quá giờ chưa cập nhật' : STATUS_LABELS[meeting.status];

  return (
    <AppDetailDialog
      open
      title={meeting.subject}
      eyebrow={meeting.meetingCode || undefined}
      subtitle={relatedLabel(meeting)}
      maxWidth="lg"
      loading={loading}
      onClose={onClose}
      actions={
        meeting.canUpdate && active ? (
          <DialogActionButton startIcon={<EditRoundedIcon />} onClick={() => onEdit(meeting)}>
            Chỉnh sửa
          </DialogActionButton>
        ) : undefined
      }
    >
      <div className="space-y-5 bg-slate-50/60 p-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Ngày hẹn" value={dayjs(meeting.startsAt).format('DD/MM/YYYY')} />
            <DetailItem
              label="Thời gian"
              value={`${dayjs(meeting.startsAt).format('HH:mm')} – ${dayjs(meeting.endsAt).format('HH:mm')}`}
            />
            <DetailItem label="Hình thức" value={TYPE_LABELS[meeting.meetingType]} />
            <DetailItem label="Trạng thái" value={statusLabel} />
            <DetailItem label="Người phụ trách" value={meeting.organizer?.name} />
            <DetailItem label="Phòng ban" value={meeting.organizer?.department?.name} />
            <DetailItem
              label={meeting.meetingType === 'online' ? 'Link Meet' : 'Địa điểm'}
              value={meeting.meetingType === 'online' ? meeting.meetingUrl : meeting.location}
            />
            <DetailItem
              label="Người tham gia"
              value={meeting.participants?.map((participant) => participant.name).join(', ')}
            />
          </dl>

          {meeting.meetingType === 'online' && meeting.meetingUrl ? (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
            >
              <LaunchRoundedIcon fontSize="small" />
              Mở phòng họp
            </a>
          ) : null}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-950">Nội dung cuộc hẹn</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
              {meeting.agenda || 'Chưa có nội dung cần trao đổi.'}
            </p>

            <h4 className="mt-5 text-sm font-bold text-slate-950">Khách tham gia</h4>
            {meeting.guests?.length ? (
              <div className="mt-2 space-y-2">
                {meeting.guests.map((guest) => (
                  <div
                    key={guest.id || `${guest.name}-${guest.email}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-sm font-bold text-slate-800">{guest.name}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {[guest.phone, guest.email].filter(Boolean).join(' · ') || 'Chưa có liên hệ'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-slate-500">Chưa nhập khách tham gia.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-950">Kết quả & hành động tiếp theo</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
              {meeting.result || 'Chưa cập nhật kết quả cuộc họp.'}
            </p>
            {meeting.nextAction ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">
                  Hành động tiếp theo
                </p>
                <p className="mt-1 text-sm font-bold text-amber-900">{meeting.nextAction}</p>
                {meeting.nextActionDate ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Hạn: {dayjs(meeting.nextActionDate).format('DD/MM/YYYY')}
                  </p>
                ) : null}
              </div>
            ) : null}
            {meeting.cancellationReason ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">
                  Lý do hủy
                </p>
                <p className="mt-1 text-sm font-bold text-rose-800">{meeting.cancellationReason}</p>
              </div>
            ) : null}
          </section>
        </div>

        {meeting.histories?.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-950">Lịch sử xử lý</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {meeting.histories.map((history) => (
                <div
                  key={history.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-bold text-slate-700">
                    {HISTORY_LABELS[history.action] || history.action}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {[
                      history.actor?.name,
                      history.createdAt
                        ? dayjs(history.createdAt).format('DD/MM/YYYY HH:mm')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {meeting.canUpdate && active ? (
          <section className="flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {meeting.status === 'scheduled' ? (
              <DialogActionButton
                startIcon={<EventAvailableRoundedIcon />}
                onClick={() => onConfirm(meeting)}
              >
                Xác nhận
              </DialogActionButton>
            ) : null}
            <DialogActionButton
              startIcon={<PersonOffOutlinedIcon />}
              onClick={() => onNoShow(meeting)}
            >
              Không tham gia
            </DialogActionButton>
            <DialogActionButton
              startIcon={<CancelOutlinedIcon />}
              onClick={() => onCancel(meeting)}
            >
              Hủy lịch
            </DialogActionButton>
            <DialogActionButton
              tone="primary"
              startIcon={<CheckCircleOutlineRoundedIcon />}
              onClick={() => onComplete(meeting)}
            >
              Hoàn thành
            </DialogActionButton>
          </section>
        ) : null}
      </div>
    </AppDetailDialog>
  );
}
