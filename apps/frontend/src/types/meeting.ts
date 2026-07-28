import type { Customer } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { PaginationMeta } from '@/types/pagination';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';

export type MeetingStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type MeetingType = 'online' | 'onsite' | 'phone';

export type MeetingRelatedType = 'lead' | 'customer' | 'project';

export type MeetingParticipant = Pick<User, 'id' | 'code' | 'name' | 'departmentId'> & {
  attendanceStatus?: string | null;
};

export type MeetingGuest = {
  id?: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  attendanceStatus?: string | null;
};

export type MeetingHistory = {
  id: number;
  action: string;
  payload?: Record<string, unknown> | null;
  actor?: Pick<User, 'id' | 'code' | 'name'> | null;
  createdAt?: string | null;
};

export type Meeting = {
  id: number;
  meetingCode?: string | null;
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  organizerUserId: number;
  subject: string;
  meetingType: MeetingType;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  status: MeetingStatus;
  isOverdue?: boolean;
  agenda?: string | null;
  result?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
  cancellationReason?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  relatedType: MeetingRelatedType;
  lead?: Pick<Lead, 'id' | 'leadCode' | 'customerName' | 'assignedUserId'> | null;
  customer?: Pick<Customer, 'id' | 'customerCode' | 'customerName' | 'salesUserId'> | null;
  project?: Pick<
    ProjectItem,
    'id' | 'projectCode' | 'projectName' | 'managerUserId' | 'salesUserId'
  > | null;
  organizer?: MeetingParticipant & {
    department?: { id: number; name: string } | null;
  };
  participants?: MeetingParticipant[];
  guests?: MeetingGuest[];
  histories?: MeetingHistory[];
  canUpdate?: boolean;
  canDelete?: boolean;
  createdBy?: Pick<User, 'id' | 'code' | 'name'> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MeetingSummary = {
  today: number;
  upcoming: number;
  waitingConfirmation: number;
  overdue: number;
};

export type MeetingFilters = {
  keyword: string;
  organizerUserId: string;
  departmentId: string;
  meetingType: string;
  status: string;
};

export type MeetingListResponse = {
  data: Meeting[];
  meta: PaginationMeta;
};

export type MeetingPayload = {
  leadId?: number | null;
  customerId?: number | null;
  projectId?: number | null;
  organizerUserId: number;
  subject: string;
  meetingType: MeetingType;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location?: string | null;
  meetingUrl?: string | null;
  agenda?: string | null;
  participantUserIds: number[];
  guests: Array<{
    name: string;
    email?: string | null;
    phone?: string | null;
  }>;
  allowConflict?: boolean;
};
