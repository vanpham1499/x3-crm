import type { User } from '@/types/user';

export type Department = {
  id: number;
  name: string;
  leaderUserId: number;
  leader?: User | null;
  members: User[];
  membersCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type DepartmentFormValues = {
  name: string;
  leaderUserId: string;
  memberUserIds: string[];
};

export type DepartmentPayload = {
  name: string;
  leaderUserId: number;
  memberUserIds: number[];
};
