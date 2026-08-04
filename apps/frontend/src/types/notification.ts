export type NotificationKind = 'info' | 'action';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type UserNotification = {
  id: number;
  module: 'lead' | 'project' | 'meeting' | 'weekly_report' | 'cost' | 'payment' | 'p2point' | string;
  eventKey: string;
  title: string;
  message?: string | null;
  kind: NotificationKind;
  severity: NotificationSeverity;
  entityType?: string | null;
  entityId?: number | null;
  actionUrl?: string | null;
  data: Record<string, unknown>;
  readAt?: string | null;
  resolvedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  isRead: boolean;
  isResolved: boolean;
  actor?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export type NotificationSummary = {
  totalCount: number;
  archivedCount: number;
  unreadCount: number;
  pendingActionCount: number;
  attentionCount: number;
};

export type NotificationPage = {
  data: UserNotification[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
    from?: number | null;
    to?: number | null;
  };
};
