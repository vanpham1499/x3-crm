import type { AppOption } from '@/types/option';
import type { ProjectItem } from '@/types/project';
import type { User } from '@/types/user';

export type P2PointType = 'bonus' | 'penalty';

export const P2_CATEGORY_OPTION_GROUP = 'p2_category';

export type P2Category = {
  key: string;
  label: string;
  type: P2PointType;
  defaultScore: number;
};

export function p2CategoryFromOption(option: AppOption): P2Category {
  const meta = option.meta || {};
  const defaultScore = Number(meta.defaultScore);

  return {
    key: option.key || '',
    label: option.label,
    type: meta.type === 'bonus' ? 'bonus' : 'penalty',
    defaultScore: Number.isFinite(defaultScore) ? defaultScore : 0,
  };
}

export type P2Point = {
  id: number;
  userId: number;
  projectId?: number | null;
  entryDate: string;
  category: string;
  categoryLabel?: string;
  type: P2PointType;
  score: string | number;
  customerRef?: string | null;
  note?: string | null;
  isApproved: boolean;
  approvedBy?: number | null;
  approvedAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'code' | 'departmentId'> | null;
  project?: Pick<ProjectItem, 'id' | 'projectCode' | 'projectName' | 'managerUserId'> | null;
  approver?: Pick<User, 'id' | 'name'> | null;
  canUpdate?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type P2PointSummary = {
  userId: number;
  code?: string | null;
  name: string;
  bonusScore: number;
  penaltyScore: number;
  total: number;
  count: number;
  pendingCount: number;
};

export type P2PointOverview = {
  bonusScore: number;
  penaltyScore: number;
  netScore: number;
  pendingCount: number;
};

export type P2PointFilters = {
  userId: string;
  category: string;
  type: string;
  approvalStatus: string;
  dateFrom: string;
  dateTo: string;
};

export type P2PointFormValues = {
  userId: string;
  projectId: string;
  entryDate: string;
  category: string;
  score: string;
  note: string;
};
