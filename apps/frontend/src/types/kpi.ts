export type KpiScopeType = 'service' | 'service_group' | 'department' | 'team' | 'employee';
export type KpiPeriodMode = 'month' | 'quarter' | 'year' | 'range';

export type KpiSummary = {
  targetAmount: number;
  actualAmount: number;
  completionRate: number | null;
};

export type ServiceKpiRow = {
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

export type DepartmentKpiRow = {
  id: number;
  scopeType: 'department' | 'team';
  canManageTarget?: boolean;
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

export type EmployeeKpiRow = {
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
};

export type KpiMonthlyReport = {
  period: string;
  metric?: 'management_fee' | 'legacy_profit';
  services: ServiceKpiRow[];
  departments: DepartmentKpiRow[];
  employees: EmployeeKpiRow[];
  summary: {
    services: KpiSummary;
    departments: KpiSummary;
    employees: KpiSummary;
  };
};

export type KpiReport = {
  periodFrom: string;
  periodTo: string;
  viewerScope: {
    level: 'own' | 'team' | 'department' | 'all';
    teamIds?: number[];
    userId: number | null;
    departmentId: number | null;
    departmentIds?: number[];
  };
  calculationBasis: {
    feePolicyStartsAt?: string;
    feePolicy?: string;
    currency: 'VND';
    sourceAmountBasis: 'gross_including_vat';
    profitAmountBasis: 'before_vat';
    projectScope: 'existing_projects';
    sourceDepositIncluded: true;
    serviceProfitDepositIncluded: false;
    acquisitionProfitDepositIncluded: boolean;
    acquisitionProfitDepositScope: 'none' | 'project_type_k_before_2026_10' | 'project_type_k_only';
  };
  periods: KpiMonthlyReport[];
};

export type KpiPeriodFilters = {
  mode: KpiPeriodMode;
  month: string;
  quarter: string;
  year: string;
  periodFrom: string;
  periodTo: string;
};

export type KpiTargetPayload = {
  period: string;
  scopeType: KpiScopeType;
  scopeId: number;
  targetAmount: number;
};

export type KpiDetailTotals = {
  receivedAmount: number;
  costAmount: number;
  refundAmount: number;
  profitAmount: number;
};

export type KpiDetailEntry = {
  id: string;
  branch: 'service' | 'implementation' | 'acquisition';
  kind: 'received' | 'cost' | 'refund' | 'acquisition_credit' | 'acquisition_refund';
  label: string;
  eventAt: string;
  sourceAmount: number;
  beforeVatAmount: number;
  profitImpactAmount: number;
  reference: string;
  project: {
    id: number;
    code?: string | null;
    name?: string | null;
    type?: string | null;
  };
  quotation?: {
    id: number;
    code?: string | null;
  } | null;
};

export type KpiDetailReport = {
  period: string;
  metric?: 'management_fee' | 'legacy_profit';
  scope: {
    type: KpiScopeType;
    id: number;
    name: string;
  };
  totals: KpiDetailTotals;
  branches: Array<{
    key: 'service' | 'implementation' | 'acquisition';
    label: string;
    totals: KpiDetailTotals;
    entries: KpiDetailEntry[];
  }>;
};
