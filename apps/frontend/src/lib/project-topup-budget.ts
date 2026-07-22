import type { ProjectCost } from '@/types/project-cost';
import type { Quotation } from '@/types/quotation';

function quotationBudget(quotation: Quotation) {
  const budget = Number(quotation.metadata?.budget);
  return Number.isFinite(budget) && budget > 0 ? budget : 0;
}

function quotationBudgetWithVat(quotation: Quotation) {
  const budget = quotationBudget(quotation);
  const vatRate = Math.max(0, Number(quotation.vatRate) || 0);

  return budget + Math.round((budget * vatRate) / 100);
}

function topupBudgetUsed(cost: ProjectCost) {
  if (cost.actualCostAmount !== undefined && cost.actualCostAmount !== null) {
    return Number(cost.actualCostAmount) || 0;
  }

  const topupAmount = Math.max(0, Number(cost.totalAmount) || Number(cost.amountBeforeVat) || 0);
  const spentAmount = Math.max(0, Number(cost.cidSpentAmount) || 0);
  const vatRate = Math.max(0, Number(cost.vatRate) || 0);
  const spentAmountWithVat = spentAmount + Math.round((spentAmount * vatRate) / 100);

  return cost.cidIsDead && cost.reconciledAt
    ? Math.min(topupAmount, spentAmountWithVat)
    : topupAmount;
}

export function calculateRealizedProjectCost(costs: ProjectCost[]) {
  return costs.reduce((sum, cost) => {
    if (cost.status !== 'completed') return sum;

    if (cost.realizedCostAmount !== undefined && cost.realizedCostAmount !== null) {
      return sum + (Number(cost.realizedCostAmount) || 0);
    }

    if (cost.entryType === 'ad_spend' && cost.cidIsDead) {
      return sum + topupBudgetUsed(cost);
    }

    return sum + (Number(cost.totalAmount) || 0);
  }, 0);
}

export function isManagedBudgetProject({
  projectType,
  projectCode,
  quotations = [],
}: {
  projectType?: string | null;
  projectCode?: string | null;
  quotations?: Quotation[];
}) {
  const typeFromCode = projectCode?.split('.')[2];

  return [projectType, typeFromCode, ...quotations.map((item) => item.metadata?.projectType)].some(
    (value) =>
      String(value || '')
        .trim()
        .toUpperCase() === 'M',
  );
}

export function calculateAvailableTopupBudget({
  quotations,
  costs,
  quotationId,
  editingCost,
}: {
  quotations: Quotation[];
  costs: ProjectCost[];
  quotationId?: string | number | null;
  editingCost?: ProjectCost | null;
}) {
  const normalizedQuotationId = quotationId ? String(quotationId) : '';
  const scopedQuotations = normalizedQuotationId
    ? quotations.filter((quotation) => String(quotation.id) === normalizedQuotationId)
    : quotations;
  const customerBudget = scopedQuotations.reduce(
    (sum, quotation) => sum + quotationBudgetWithVat(quotation),
    0,
  );
  const savedUsedBudget = costs
    .filter(
      (cost) =>
        cost.entryType === 'ad_spend' &&
        cost.status === 'completed' &&
        cost.id !== editingCost?.id &&
        (!normalizedQuotationId || String(cost.quotationId || '') === normalizedQuotationId),
    )
    .reduce((sum, cost) => sum + topupBudgetUsed(cost), 0);
  const editingCostUsed = editingCost?.status === 'completed' ? topupBudgetUsed(editingCost) : 0;
  const usedBudget = savedUsedBudget + editingCostUsed;

  return {
    customerBudget,
    usedBudget,
    availableBudget: customerBudget - usedBudget,
  };
}
