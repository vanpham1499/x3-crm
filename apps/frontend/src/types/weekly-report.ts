import type { ProjectItem } from '@/types/project';
import type { Customer } from '@/types/customer';
import type { User } from '@/types/user';

export type WeeklyReportStatus = 'draft' | 'submitted' | 'approved';

export type WeeklyReportAttachment = {
  id: number;
  weeklyReportId?: number;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  uploadedBy?: Pick<User, 'id' | 'name'> | null;
  createdAt?: string;
};

export type WeeklyReportItem = {
  id?: number;
  weeklyReportId?: number;
  itemType?: string | null;
  title?: string | null;
  content: string;
  priority?: string | null;
  status?: string | null;
  dueDate?: string | null;
  assigneeUserId?: number | null;
  assignee?: Pick<User, 'id' | 'name'> | null;
};

export type WeeklyReport = {
  id: number;
  projectId: number;
  customerId?: number | null;
  reporterUserId?: number | null;
  weekStartDate: string;
  weekEndDate: string;
  reportDate?: string | null;
  projectStatus?: string | null;
  weeklyCondition?: string | null;
  status: WeeklyReportStatus;
  monthlyBudget?: string | number | null;
  managementFeeRate?: string | number | null;
  problemSolution?: string | null;
  summary?: string | null;
  nextAction?: string | null;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  project?: Pick<ProjectItem, 'id' | 'projectCode' | 'projectName'> | null;
  customer?: Pick<Customer, 'id' | 'customerCode' | 'customerName'> | null;
  reporter?: Pick<User, 'id' | 'name'> | null;
  approver?: Pick<User, 'id' | 'name'> | null;
  items?: WeeklyReportItem[];
  attachments?: WeeklyReportAttachment[];
  createdAt?: string;
  updatedAt?: string;
};

export type WeeklyReportFilters = {
  projectId: string;
  status: string;
};

export type WeeklyReportItemFormValue = {
  id: number;
  itemType: string;
  title: string;
  content: string;
  priority: string;
  status: string;
  dueDate: string;
  assigneeUserId: string;
};

export type ProjectWeeklySetting = {
  id: number;
  projectId: number;
  reportOwnerUserId?: number | null;
  reportWeekday?: number | null;
  monthlyBudget?: string | number | null;
  managementFeeRate?: string | number | null;
  isActive?: boolean;
  project?: Pick<ProjectItem, 'id' | 'projectCode' | 'projectName'> | null;
  reportOwner?: Pick<User, 'id' | 'name'> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectWeeklySettingFormValues = {
  reportOwnerUserId: string;
  reportWeekday: string;
  monthlyBudget: string;
  managementFeeRate: string;
  isActive: boolean;
};
