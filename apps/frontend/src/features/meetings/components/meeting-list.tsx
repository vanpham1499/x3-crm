'use client';

import { useState, type MouseEvent } from 'react';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { AppDataTable } from '@/components/table/app-data-table';
import { EntityTableLink } from '@/components/table/entity-table-link';
import { TablePaginationBar } from '@/components/table/table-pagination-bar';
import type { Meeting } from '@/types/meeting';

type MeetingListProps = {
  meetings: Meeting[];
  isFetching: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (meeting: Meeting) => void;
  onEdit: (meeting: Meeting) => void;
  onConfirm: (meeting: Meeting) => void;
  onComplete: (meeting: Meeting) => void;
  onCancel: (meeting: Meeting) => void;
  onNoShow: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Không tham gia',
};

const TYPE_LABELS: Record<string, string> = {
  online: 'Online',
  onsite: 'Trực tiếp',
  phone: 'Gọi điện',
};

function statusClass(meeting: Meeting) {
  if (meeting.isOverdue) return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (meeting.status === 'confirmed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (meeting.status === 'completed') return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (meeting.status === 'cancelled') return 'bg-rose-50 text-rose-500 ring-rose-100';
  if (meeting.status === 'no_show') return 'bg-amber-50 text-amber-700 ring-amber-200';

  return 'bg-sky-50 text-sky-700 ring-sky-200';
}

function relatedInfo(meeting: Meeting) {
  if (meeting.project) {
    return {
      label:
        meeting.project.projectCode ||
        meeting.project.projectName ||
        `Dự án #${meeting.project.id}`,
      href: `/projects/${meeting.project.id}`,
    };
  }

  if (meeting.customer) {
    return {
      label:
        meeting.customer.customerCode ||
        meeting.customer.customerName ||
        `Khách hàng #${meeting.customer.id}`,
      href: `/customers/${meeting.customer.id}`,
    };
  }

  return {
    label: meeting.lead?.leadCode || meeting.lead?.customerName || `Lead #${meeting.leadId}`,
    href: `/leads/${meeting.leadId}`,
  };
}

export function MeetingList({
  meetings,
  isFetching,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
  onDelete,
}: MeetingListProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);

  const openMenu = (event: MouseEvent<HTMLButtonElement>, meeting: Meeting) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveMeeting(meeting);
  };

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setActiveMeeting(null);
  };

  const isActive = activeMeeting
    ? ['scheduled', 'confirmed'].includes(activeMeeting.status)
    : false;

  return (
    <>
      <AppDataTable
        columns={[
          { key: 'time', label: 'Thời gian', className: 'w-[180px]' },
          { key: 'subject', label: 'Lịch hẹn', className: 'w-[250px]' },
          { key: 'related', label: 'Liên quan', className: 'w-[200px]' },
          { key: 'organizer', label: 'Người phụ trách', className: 'w-[180px]' },
          { key: 'type', label: 'Hình thức', className: 'w-[120px]' },
          { key: 'status', label: 'Trạng thái', className: 'w-[145px]' },
          { key: 'actions', className: 'w-[132px]' },
        ]}
        isLoading={isFetching}
        isEmpty={meetings.length === 0}
        emptyText="Chưa có lịch hẹn"
        minWidthClassName="min-w-[1200px]"
      >
        {meetings.map((meeting) => {
          const related = relatedInfo(meeting);

          return (
            <tr key={meeting.id} className="hover:bg-slate-50/80">
              <td className="px-3 py-3.5">
                <strong className="block text-sm tabular-nums text-slate-900">
                  {dayjs(meeting.startsAt).format('DD/MM/YYYY')}
                </strong>
                <span className="mt-0.5 block text-xs font-semibold tabular-nums text-slate-500">
                  {dayjs(meeting.startsAt).format('HH:mm')} –{' '}
                  {dayjs(meeting.endsAt).format('HH:mm')}
                </span>
              </td>
              <td className="px-3 py-3.5">
                <button
                  type="button"
                  className="block max-w-full truncate text-left font-bold text-slate-900 hover:text-primary"
                  title={meeting.subject}
                  onClick={() => onView(meeting)}
                >
                  {meeting.subject}
                </button>
                <span className="mt-1 block text-xs font-semibold text-slate-400">
                  {meeting.meetingCode}
                </span>
              </td>
              <td className="px-3 py-3.5">
                <EntityTableLink href={related.href} title={related.label} tone="blue">
                  {related.label}
                </EntityTableLink>
              </td>
              <td className="truncate px-3 py-3.5 font-semibold text-slate-700">
                {meeting.organizer?.name || '-'}
              </td>
              <td className="px-3 py-3.5 font-semibold text-slate-700">
                {TYPE_LABELS[meeting.meetingType] || meeting.meetingType}
              </td>
              <td className="px-3 py-3.5">
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ring-1 ${statusClass(meeting)}`}
                >
                  {meeting.isOverdue ? 'Quá giờ' : STATUS_LABELS[meeting.status] || meeting.status}
                </span>
              </td>
              <td className="px-3 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip title="Xem lịch hẹn">
                    <IconButton
                      size="small"
                      aria-label={`Xem lịch hẹn ${meeting.meetingCode || meeting.id}`}
                      onClick={() => onView(meeting)}
                    >
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Chỉnh sửa lịch hẹn">
                    <span>
                      <IconButton
                        size="small"
                        disabled={
                          !meeting.canUpdate || !['scheduled', 'confirmed'].includes(meeting.status)
                        }
                        aria-label={`Chỉnh sửa lịch hẹn ${meeting.meetingCode || meeting.id}`}
                        onClick={() => onEdit(meeting)}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Tác vụ">
                    <IconButton
                      size="small"
                      aria-label={`Tác vụ lịch hẹn ${meeting.meetingCode || meeting.id}`}
                      onClick={(event) => openMenu(event, meeting)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </div>
              </td>
            </tr>
          );
        })}
      </AppDataTable>

      <TablePaginationBar
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeMenu}>
        {activeMeeting?.status === 'scheduled' && activeMeeting.canUpdate ? (
          <MenuItem
            onClick={() => {
              onConfirm(activeMeeting);
              closeMenu();
            }}
          >
            <EventAvailableRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Xác nhận lịch
          </MenuItem>
        ) : null}
        {isActive && activeMeeting?.canUpdate ? (
          <MenuItem
            onClick={() => {
              if (activeMeeting) onComplete(activeMeeting);
              closeMenu();
            }}
          >
            <CheckCircleOutlineRoundedIcon fontSize="small" className="mr-2 text-emerald-600" />
            Hoàn thành
          </MenuItem>
        ) : null}
        {isActive && activeMeeting?.canUpdate ? (
          <MenuItem
            onClick={() => {
              if (activeMeeting) onNoShow(activeMeeting);
              closeMenu();
            }}
          >
            <PersonOffOutlinedIcon fontSize="small" className="mr-2 text-amber-600" />
            Khách không tham gia
          </MenuItem>
        ) : null}
        {isActive && activeMeeting?.canUpdate ? (
          <MenuItem
            onClick={() => {
              if (activeMeeting) onCancel(activeMeeting);
              closeMenu();
            }}
          >
            <CancelOutlinedIcon fontSize="small" className="mr-2 text-rose-600" />
            Hủy lịch
          </MenuItem>
        ) : null}
        {activeMeeting?.canDelete ? (
          <MenuItem
            className="text-rose-600"
            onClick={() => {
              onDelete(activeMeeting);
              closeMenu();
            }}
          >
            <DeleteRoundedIcon fontSize="small" className="mr-2" />
            Xóa lịch
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}
