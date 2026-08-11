export type DashboardPeriodMode = 'month' | 'quarter' | 'year' | 'range';

export type DashboardPeriodFilters = {
  mode: DashboardPeriodMode;
  month: string;
  quarter: string;
  year: string;
  periodFrom: string;
  periodTo: string;
};

export type DashboardScope = {
  level: 'all' | 'department' | 'own';
  label: string;
  userId: number;
  userName: string;
  departmentId?: number | null;
  departmentIds?: number[];
  departmentName?: string | null;
  targetLabel: string;
};

export type DashboardSummary = {
  receivedAmount: number;
  receivedChangeRate: number | null;
  newCustomerCount: number;
  newCustomerChangeRate: number | null;
  profitAmount: number;
  profitChangeRate: number | null;
  targetAmount: number;
  completionRate: number | null;
};

export type DashboardProjectStatus = {
  id: number;
  key?: string | null;
  label: string;
  color: string;
  count: number;
};

export type DashboardOperations = {
  leads: {
    newCount: number;
    newChangeRate: number | null;
    convertedFromNewCount: number;
    conversionRate: number | null;
    openCount: number;
    totalCount: number;
  };
  customers: {
    newCount: number;
    newChangeRate: number | null;
    totalCount: number;
  };
  projects: {
    newCount: number;
    newChangeRate: number | null;
    totalCount: number;
    managedChangeRate: number | null;
    statuses: DashboardProjectStatus[];
  };
  meetings: {
    today: number;
    upcoming: number;
    waitingConfirmation: number;
    overdue: number;
  } | null;
  weeklyReports: {
    total: number;
    dueToday: number;
    overdue: number;
    waitingApproval: number;
    completed: number;
  } | null;
};

export type DashboardLeadReportPeriod = {
  period: string;
  label: string;
  total: number;
};

export type DashboardLeadStatusSeries = {
  statusId: number;
  key?: string | null;
  label: string;
  color: string;
  total: number;
  values: number[];
};

export type DashboardLeadEmployee = {
  id: number;
  code?: string | null;
  name: string;
  isActive: boolean | null;
  isDeleted: boolean;
  total: number;
  values: number[];
  statusSeries: DashboardLeadStatusSeries[];
};

export type DashboardLeadReport = {
  periods: DashboardLeadReportPeriod[];
  employees: DashboardLeadEmployee[];
};

export type DashboardTrendPoint = {
  period: string;
  label: string;
  quotationAmount: number;
  receivedAmount: number;
  refundAmount: number;
  netAmount: number;
  cumulativeQuotationAmount: number;
  cumulativeReceivedAmount: number;
  cumulativeRefundAmount: number;
  cumulativeNetAmount: number;
  previousNetAmount: number;
  previousCumulativeNetAmount: number;
};

export type DashboardProfitTrendPoint = {
  period: string;
  label: string;
  profitAmount: number;
  cumulativeProfitAmount: number;
  previousProfitAmount: number;
  previousCumulativeProfitAmount: number;
};

export type DashboardServiceRow = {
  id: number;
  scopeType: 'service' | 'service_group';
  code?: string | null;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  memberServices?: Array<{ id: number; code: string; name: string }>;
  targetAmount: number;
  receivedAmount: number;
  costAmount: number;
  refundAmount: number;
  actualAmount: number;
  completionRate: number | null;
};

export type DashboardDepartmentRow = {
  id: number;
  scopeType: 'department';
  name: string;
  targetAmount: number;
  implementationReceivedAmount: number;
  implementationCostAmount: number;
  implementationRefundAmount: number;
  implementationAmount: number;
  acquisitionCreditAmount: number;
  acquisitionRefundAmount: number;
  acquisitionAmount: number;
  actualAmount: number;
  completionRate: number | null;
};

export type DashboardEmployeeRow = {
  id: number;
  scopeType: 'employee';
  code?: string | null;
  name: string;
  departmentId?: number | null;
  departmentName?: string | null;
  isActive: boolean;
  targetAmount: number;
  implementationReceivedAmount: number;
  implementationCostAmount: number;
  implementationRefundAmount: number;
  implementationAmount: number;
  acquisitionCreditAmount: number;
  acquisitionRefundAmount: number;
  acquisitionAmount: number;
  actualAmount: number;
  completionRate: number | null;
  projectCount: number;
  activeProjectCount: number;
  pausedProjectCount: number;
  stoppedProjectCount: number;
  otherProjectCount: number;
};

export type DashboardReport = {
  periodFrom: string;
  periodTo: string;
  comparison: {
    periodFrom: string;
    periodTo: string;
  };
  scope: DashboardScope;
  calculationBasis: {
    currency: 'VND';
    sourceAmountBasis: 'gross_including_vat';
    profitAmountBasis: 'before_vat';
    projectScope: 'existing_projects';
    sourceDepositIncluded: true;
    serviceProfitDepositIncluded: false;
    acquisitionProfitDepositIncluded: true;
    acquisitionProfitDepositScope: 'project_type_k_only';
  };
  summary: DashboardSummary;
  operations: DashboardOperations;
  leadReport: DashboardLeadReport | null;
  trend: {
    granularity: 'day' | 'month';
    points: DashboardTrendPoint[];
  };
  profitTrend: {
    granularity: 'day' | 'month';
    points: DashboardProfitTrendPoint[];
  } | null;
  services: DashboardServiceRow[];
  departments: DashboardDepartmentRow[];
  employees: DashboardEmployeeRow[];
  updatedAt: string;
};
