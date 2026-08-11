'use client';

import { useEffect, useMemo, useState } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Autocomplete, MenuItem } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import { DialogActionButton } from '@/components/actions/dialog-action-button';
import { AppDetailDialog } from '@/components/dialog/app-detail-dialog';
import { FormDateTimePicker } from '@/components/form/form-date-time-picker';
import { FormInputField } from '@/components/form/form-input-field';
import { FormSection } from '@/components/form/form-section';
import { FormSelectField } from '@/components/form/form-select-field';
import { ServerPaginatedAutocomplete } from '@/components/form/server-paginated-autocomplete';
import { getApiFieldErrors } from '@/lib/api-error';
import { formatCustomerIdentity } from '@/lib/customer-utils';
import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { Meeting, MeetingPayload, MeetingRelatedType, MeetingType } from '@/types/meeting';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';

type MeetingFormDialogProps = {
  open: boolean;
  meeting?: Meeting | null;
  users: User[];
  currentUserId?: number | null;
  defaultDate?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: MeetingPayload) => Promise<unknown>;
};

function roundToNextHalfHour(value: Dayjs) {
  const normalized = value.second(0).millisecond(0);

  return normalized.minute() < 30 ? normalized.minute(30) : normalized.add(1, 'hour').minute(0);
}

function createDefaultStart(defaultDate?: string) {
  if (!defaultDate) return roundToNextHalfHour(dayjs());

  const selectedDate = dayjs(defaultDate);

  return selectedDate.isSame(dayjs(), 'day')
    ? roundToNextHalfHour(dayjs())
    : selectedDate.hour(9).minute(0).second(0).millisecond(0);
}

function relatedLabel(
  relatedType: MeetingRelatedType,
  related: Lead | Customer | ProjectItem | null,
) {
  if (!related) return '';

  if (relatedType === 'lead') {
    const lead = related as Lead;
    return [lead.leadCode, lead.customerName].filter(Boolean).join(' - ');
  }

  if (relatedType === 'customer') {
    const customer = related as Customer;
    return formatCustomerIdentity(customer);
  }

  const project = related as ProjectItem;
  return [project.projectCode, project.projectName].filter(Boolean).join(' - ');
}

function getInitialRelated(meeting?: Meeting | null): Lead | Customer | ProjectItem | null {
  if (!meeting) return null;
  if (meeting.relatedType === 'project') return (meeting.project as ProjectItem | null) || null;
  if (meeting.relatedType === 'customer') return (meeting.customer as Customer | null) || null;

  return (meeting.lead as Lead | null) || null;
}

export function MeetingFormDialog({
  open,
  meeting,
  users,
  currentUserId,
  defaultDate,
  isSubmitting,
  onClose,
  onSubmit,
}: MeetingFormDialogProps) {
  const initialStart = useMemo(() => {
    if (meeting?.startsAt) return dayjs(meeting.startsAt);

    return createDefaultStart(defaultDate);
  }, [defaultDate, meeting?.startsAt]);
  const initialEnd = meeting?.endsAt ? dayjs(meeting.endsAt) : initialStart.add(1, 'hour');
  const [relatedType, setRelatedType] = useState<MeetingRelatedType>(
    meeting?.relatedType || 'project',
  );
  const [related, setRelated] = useState<Lead | Customer | ProjectItem | null>(
    getInitialRelated(meeting),
  );
  const [organizerUserId, setOrganizerUserId] = useState(
    String(meeting?.organizerUserId || currentUserId || ''),
  );
  const [subject, setSubject] = useState(meeting?.subject || '');
  const [meetingType, setMeetingType] = useState<MeetingType>(meeting?.meetingType || 'online');
  const [startsAt, setStartsAt] = useState(initialStart.format('YYYY-MM-DDTHH:mm'));
  const [endsAt, setEndsAt] = useState(initialEnd.format('YYYY-MM-DDTHH:mm'));
  const [location, setLocation] = useState(meeting?.location || '');
  const [meetingUrl, setMeetingUrl] = useState(meeting?.meetingUrl || '');
  const [agenda, setAgenda] = useState(meeting?.agenda || '');
  const [participantUserIds, setParticipantUserIds] = useState<number[]>(
    meeting?.participants?.map((participant) => participant.id) || [],
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    const normalizedStart = meeting?.startsAt
      ? dayjs(meeting.startsAt)
      : createDefaultStart(defaultDate);
    const nextEnd = meeting?.endsAt ? dayjs(meeting.endsAt) : normalizedStart.add(1, 'hour');

    setRelatedType(meeting?.relatedType || 'project');
    setRelated(getInitialRelated(meeting));
    setOrganizerUserId(String(meeting?.organizerUserId || currentUserId || ''));
    setSubject(meeting?.subject || '');
    setMeetingType(meeting?.meetingType || 'online');
    setStartsAt(normalizedStart.format('YYYY-MM-DDTHH:mm'));
    setEndsAt(nextEnd.format('YYYY-MM-DDTHH:mm'));
    setLocation(meeting?.location || '');
    setMeetingUrl(meeting?.meetingUrl || '');
    setAgenda(meeting?.agenda || '');
    setParticipantUserIds(meeting?.participants?.map((participant) => participant.id) || []);
    setFieldErrors({});
  }, [currentUserId, defaultDate, meeting, open]);

  const selectedParticipants = users.filter((user) => participantUserIds.includes(user.id));

  const handleRelatedChange = (
    nextRelated: Lead | Customer | ProjectItem | null,
    type: MeetingRelatedType = relatedType,
  ) => {
    setRelated(nextRelated);
    if (!nextRelated) return;

    const label = relatedLabel(type, nextRelated);
    if (!subject.trim()) setSubject(`Trao đổi - ${label}`);

    if (type === 'lead') {
      const lead = nextRelated as Lead;
      if (lead.assignedUserId) setOrganizerUserId(String(lead.assignedUserId));
      return;
    }

    if (type === 'customer') {
      const customer = nextRelated as Customer;
      if (customer.salesUserId) setOrganizerUserId(String(customer.salesUserId));
      return;
    }

    const project = nextRelated as ProjectItem;
    if (project.salesUserId) setOrganizerUserId(String(project.salesUserId));
    if (project.managerUserId && project.managerUserId !== project.salesUserId) {
      setParticipantUserIds((current) =>
        current.includes(project.managerUserId as number)
          ? current
          : [...current, project.managerUserId as number],
      );
    }
  };

  const submit = async () => {
    const parsedStartsAt = dayjs(startsAt);
    const parsedEndsAt = dayjs(endsAt);

    const localErrors: Record<string, string> = {};
    if (!related) localErrors.related = 'Vui lòng chọn Lead, Khách hàng hoặc Dự án.';
    if (!organizerUserId) localErrors.organizerUserId = 'Vui lòng chọn người phụ trách.';
    if (!subject.trim()) localErrors.subject = 'Vui lòng nhập tiêu đề lịch hẹn.';
    if (
      !parsedStartsAt.isValid() ||
      !parsedEndsAt.isValid() ||
      !parsedEndsAt.isAfter(parsedStartsAt)
    ) {
      localErrors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    const payload: MeetingPayload = {
      leadId: relatedType === 'lead' ? Number(related?.id) : null,
      customerId: relatedType === 'customer' ? Number(related?.id) : null,
      projectId: relatedType === 'project' ? Number(related?.id) : null,
      organizerUserId: Number(organizerUserId),
      subject: subject.trim(),
      meetingType,
      startsAt: parsedStartsAt.toISOString(),
      endsAt: parsedEndsAt.toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
      location: location.trim() || null,
      meetingUrl: meetingUrl.trim() || null,
      agenda: agenda.trim() || null,
      participantUserIds: participantUserIds.filter((id) => id !== Number(organizerUserId)),
      guests:
        meeting?.guests?.map((guest) => ({
          name: guest.name.trim(),
          email: guest.email?.trim() || null,
          phone: guest.phone?.trim() || null,
        })) || [],
    };

    try {
      setFieldErrors({});
      await onSubmit(payload);
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error));
    }
  };

  return (
    <AppDetailDialog
      open={open}
      title={meeting ? 'Chỉnh sửa lịch hẹn' : 'Tạo lịch hẹn'}
      eyebrow={meeting?.meetingCode || undefined}
      subtitle={related ? relatedLabel(relatedType, related) : 'Gắn với dữ liệu CRM'}
      maxWidth="lg"
      onClose={onClose}
      actions={
        <>
          <DialogActionButton disabled={isSubmitting} onClick={onClose}>
            Hủy
          </DialogActionButton>
          <DialogActionButton
            tone="primary"
            startIcon={<SaveRoundedIcon />}
            disabled={isSubmitting}
            onClick={() => void submit()}
          >
            {isSubmitting ? 'Đang lưu...' : meeting ? 'Lưu thay đổi' : 'Tạo lịch hẹn'}
          </DialogActionButton>
        </>
      }
    >
      <div className="grid items-start gap-5 bg-slate-50/60 p-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <FormSection title="Thông tin lịch hẹn">
            <FormSelectField
              label="Đối tượng liên quan"
              value={relatedType}
              onChange={(event) => {
                const nextType = event.target.value as MeetingRelatedType;
                setRelatedType(nextType);
                setRelated(null);
                setSubject('');
              }}
            >
              <MenuItem value="lead">Lead</MenuItem>
              <MenuItem value="customer">Khách hàng</MenuItem>
              <MenuItem value="project">Dự án</MenuItem>
            </FormSelectField>

            {relatedType === 'lead' ? (
              <ServerPaginatedAutocomplete<Lead>
                endpoint="/leads"
                queryKey={['leads', 'meeting-form']}
                label="Lead"
                value={(related as Lead | null) || null}
                required
                error={Boolean(fieldErrors.related || fieldErrors.leadId)}
                helperText={fieldErrors.related || fieldErrors.leadId}
                getOptionLabel={(option) =>
                  [option.leadCode, option.customerName].filter(Boolean).join(' - ')
                }
                onChange={(value) => handleRelatedChange(value, 'lead')}
              />
            ) : relatedType === 'customer' ? (
              <ServerPaginatedAutocomplete<Customer>
                endpoint="/customers"
                queryKey={['customers', 'meeting-form']}
                label="Khách hàng"
                value={(related as Customer | null) || null}
                required
                error={Boolean(fieldErrors.related || fieldErrors.customerId)}
                helperText={fieldErrors.related || fieldErrors.customerId}
                getOptionLabel={(option) => formatCustomerIdentity(option)}
                onChange={(value) => handleRelatedChange(value, 'customer')}
              />
            ) : (
              <ServerPaginatedAutocomplete<ProjectItem>
                endpoint="/projects"
                queryKey={['projects', 'meeting-form']}
                label="Dự án"
                value={(related as ProjectItem | null) || null}
                required
                error={Boolean(fieldErrors.related || fieldErrors.projectId)}
                helperText={fieldErrors.related || fieldErrors.projectId}
                getOptionLabel={(option) =>
                  [option.projectCode, option.projectName].filter(Boolean).join(' - ')
                }
                onChange={(value) => handleRelatedChange(value, 'project')}
              />
            )}

            <FormSelectField
              required
              label="Người phụ trách"
              value={organizerUserId}
              error={Boolean(fieldErrors.organizerUserId)}
              helperText={fieldErrors.organizerUserId}
              onChange={(event) => setOrganizerUserId(event.target.value)}
            >
              {users
                .filter((user) => user.isActive !== false)
                .map((user) => (
                  <MenuItem key={user.id} value={String(user.id)}>
                    {[user.code, user.name].filter(Boolean).join(' - ')}
                  </MenuItem>
                ))}
            </FormSelectField>

            <FormSelectField
              required
              label="Hình thức"
              value={meetingType}
              onChange={(event) => setMeetingType(event.target.value as MeetingType)}
            >
              <MenuItem value="online">Họp online</MenuItem>
              <MenuItem value="onsite">Gặp trực tiếp</MenuItem>
              <MenuItem value="phone">Gọi điện</MenuItem>
            </FormSelectField>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormDateTimePicker
                required
                label="Bắt đầu"
                value={startsAt}
                error={Boolean(fieldErrors.startsAt)}
                helperText={fieldErrors.startsAt}
                onChange={setStartsAt}
              />
              <FormDateTimePicker
                required
                label="Kết thúc"
                value={endsAt}
                min={startsAt}
                error={Boolean(fieldErrors.endsAt)}
                helperText={fieldErrors.endsAt}
                onChange={setEndsAt}
              />
            </div>

            {meetingType === 'online' ? (
              <FormInputField
                type="url"
                label="Link Meet"
                value={meetingUrl}
                error={Boolean(fieldErrors.meetingUrl)}
                helperText={fieldErrors.meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
              />
            ) : meetingType === 'onsite' ? (
              <FormInputField
                label="Địa điểm"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            ) : null}
          </FormSection>
        </div>

        <div className="xl:col-span-7">
          <FormSection title="Nội dung & người tham gia">
            <FormInputField
              required
              label="Tiêu đề"
              value={subject}
              error={Boolean(fieldErrors.subject)}
              helperText={fieldErrors.subject}
              onChange={(event) => setSubject(event.target.value)}
            />

            <FormInputField
              multiline
              minRows={3}
              label="Nội dung cần trao đổi"
              value={agenda}
              error={Boolean(fieldErrors.agenda)}
              helperText={fieldErrors.agenda}
              onChange={(event) => setAgenda(event.target.value)}
            />

            <Autocomplete<User, true, false, false>
              multiple
              limitTags={3}
              options={users.filter(
                (user) => user.isActive !== false && user.id !== Number(organizerUserId),
              )}
              value={selectedParticipants.filter((user) => user.id !== Number(organizerUserId))}
              getOptionLabel={(option) => [option.code, option.name].filter(Boolean).join(' - ')}
              isOptionEqualToValue={(option, selected) => option.id === selected.id}
              onChange={(_, values) => setParticipantUserIds(values.map((user) => user.id))}
              renderInput={(params) => (
                <FormInputField
                  {...params}
                  label="Người tham gia nội bộ"
                  placeholder="Chọn nhân sự"
                  sx={{
                    '& .MuiInputBase-root': {
                      height: 'auto !important',
                      minHeight: '40px',
                      alignItems: 'flex-start',
                      paddingTop: '4px !important',
                      paddingBottom: '4px !important',
                    },
                    '& .MuiAutocomplete-input': {
                      minWidth: '120px !important',
                    },
                  }}
                />
              )}
            />
          </FormSection>
        </div>
      </div>
    </AppDetailDialog>
  );
}
