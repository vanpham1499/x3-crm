import type { ProjectItem } from '@/types/project';
import type { Customer } from '@/types/customer';
import type { User } from '@/types/user';
import type { PaginationMeta } from '@/types/pagination';

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
  dueDate?: string | null;
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

export type WeeklyReportDueStatus = 'not_due' | 'due_today' | 'overdue' | 'on_time' | 'late';

export type WeeklyReportProgressStatus = WeeklyReportStatus | 'not_created';

export type WeeklyReportBoardFilters = {
  keyword: string;
  reportOwnerUserId: string;
  reportWeekday: string;
  dueStatus: string;
  progressStatus: string;
  weeklyCondition: string;
};

export type WeeklyReportBoardRow = {
  settingId: number;
  projectId: number;
  reportOwnerUserId?: number | null;
  reportWeekday: number;
  dueDate: string;
  periodStartDate: string;
  periodEndDate: string;
  dueStatus: WeeklyReportDueStatus;
  progressStatus: WeeklyReportProgressStatus;
  weeklyCondition?: string | null;
  project: {
    id: number;
    projectCode?: string | null;
    projectName?: string | null;
    startDate?: string | null;
    customer?: {
      id: number;
      customerCode?: string | null;
      customerName?: string | null;
    } | null;
  };
  reportOwner?: Pick<User, 'id' | 'code' | 'name'> | null;
  report?: WeeklyReport | null;
};

export type WeeklyReportBoardSummary = {
  total: number;
  dueToday: number;
  overdue: number;
  waitingApproval: number;
  completed: number;
};

export type WeeklyReportBoardMeta = PaginationMeta & {
  weekStart: string;
  weekEnd: string;
  summary: WeeklyReportBoardSummary;
};

export type WeeklyReportBoardResponse = {
  data: WeeklyReportBoardRow[];
  meta: WeeklyReportBoardMeta;
};

export type WeeklyReportItemFormValue = {
  id: number;
  itemType: string;
  content: string;
  status: string;
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

export type WeeklyAssignmentSummary = {
  reportOwnerUserId: number;
  reportWeekday: number;
  projectCount: number;
};
