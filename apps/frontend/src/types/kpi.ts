export type KpiScopeType = 'service' | 'department';
export type KpiPeriodMode = 'month' | 'quarter' | 'year' | 'range';

export type KpiSummary = {
  targetAmount: number;
  actualAmount: number;
  completionRate: number | null;
};

export type ServiceKpiRow = {
  id: number;
  scopeType: 'service';
  code?: string | null;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
  targetAmount: number;
  receivedAmount: number;
  costAmount: number;
  refundAmount: number;
  actualAmount: number;
  completionRate: number | null;
};

export type DepartmentKpiRow = {
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

export type EmployeeKpiRow = {
  id: number;
  code?: string | null;
  name: string;
  departmentId?: number | null;
  departmentName?: string | null;
  isActive: boolean;
  implementationReceivedAmount: number;
  implementationCostAmount: number;
  implementationRefundAmount: number;
  implementationAmount: number;
  acquisitionCreditAmount: number;
  acquisitionRefundAmount: number;
  acquisitionAmount: number;
  actualAmount: number;
};

export type KpiMonthlyReport = {
  period: string;
  services: ServiceKpiRow[];
  departments: DepartmentKpiRow[];
  employees: EmployeeKpiRow[];
  summary: {
    services: KpiSummary;
    departments: KpiSummary;
  };
};

export type KpiReport = {
  periodFrom: string;
  periodTo: string;
  calculationBasis: {
    currency: 'VND';
    sourceAmountBasis: 'gross_including_vat';
    profitAmountBasis: 'before_vat';
    projectScope: 'existing_projects';
    sourceDepositIncluded: true;
    serviceProfitDepositIncluded: false;
    acquisitionProfitDepositIncluded: true;
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
