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
  level: 'all' | 'department' | 'team' | 'own';
  label: string;
  userId: number;
  userCode?: string | null;
  userName: string;
  departmentId?: number | null;
  teamId?: number | null;
  departmentIds?: number[];
  teamIds?: number[];
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

export type DashboardProjectReportPeriod = {
  period: string;
  label: string;
  total: number;
  profitAmount: number;
};

export type DashboardProjectEmployee = {
  id: number;
  code?: string | null;
  name: string;
  isActive: boolean | null;
  isDeleted: boolean;
  total: number;
  profitAmount: number;
  projectValues: number[];
  profitValues: number[];
  statusSeries: DashboardLeadStatusSeries[];
};

export type DashboardProjectReport = {
  periods: DashboardProjectReportPeriod[];
  employees: DashboardProjectEmployee[];
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
  to: string | null;
  previousTo: string | null;
  profitAmount: number | null;
  cumulativeProfitAmount: number | null;
  previousProfitAmount: number | null;
  previousCumulativeProfitAmount: number | null;
  difference: number | null;
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
  scopeType: 'department' | 'team';
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
  teamId?: number | null;
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
  cashComparison: DashboardCashComparison;
  projectProfit: DashboardProjectProfit | null;
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
    acquisitionProfitDepositIncluded: boolean;
    acquisitionProfitDepositScope: 'none' | 'project_type_k_before_2026_10' | 'project_type_k_only';
  };
  summary: DashboardSummary;
  operations: DashboardOperations;
  leadReport: DashboardLeadReport | null;
  projectReport: DashboardProjectReport | null;
  trend: {
    granularity: 'day' | 'month';
    points: DashboardTrendPoint[];
  };
  profitTrend: {
    granularity: 'day' | 'month';
    points: DashboardProfitTrendPoint[];
    from: string;
    to: string | null;
    previousFrom: string;
    previousTo: string | null;
    partial: boolean;
    future: boolean;
    asOf: string;
    currentAmount: number;
    previousAmount: number;
    comparable: boolean;
    comparisonReason: 'future' | 'different_basis' | null;
    difference: number | null;
    changeRate: number | null;
  } | null;
  services: DashboardServiceRow[];
  departments: DashboardDepartmentRow[];
  employees: DashboardEmployeeRow[];
  updatedAt: string;
};

export type DashboardComparisonPoint = {
  label: string;
  current: number | null;
  previous: number | null;
  quotation?: number | null;
};
export type DashboardCashComparison = {
  granularity: 'day' | 'month';
  points: DashboardComparisonPoint[];
  from: string;
  to: string | null;
  previousFrom: string;
  previousTo: string | null;
  partial: boolean;
  asOf: string;
  received: number;
  refund: number;
  net: number;
  previousNet: number;
  difference: number;
  changeRate: number | null;
  details: Array<{
    date: string;
    kind: string;
    amount: number;
    reference: string;
    side: 'current' | 'previous';
  }>;
};
export type DashboardProfitEntry = {
  project: string;
  projectId: number;
  reference: string;
  kind: string;
  period: string | null;
  amount: number | null;
  reason?: string;
};
export type DashboardProjectProfit = {
  points: DashboardComparisonPoint[];
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  revenue: number;
  cost: number;
  profit: number;
  previousProfit: number;
  comparable: boolean;
  partial: boolean;
  changeRate: number | null;
  review: DashboardProfitEntry[];
  details: DashboardProfitEntry[];
};
