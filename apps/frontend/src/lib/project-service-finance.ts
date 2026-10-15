import type { Quotation } from '@/types/quotation';
import type { ProjectCost } from '@/types/project-cost';
import {
  calculateAvailableTopupBudget,
  calculateRealizedProjectCost,
  topupBudgetUsed,
} from './project-topup-budget';

export function calculateProjectServiceFinance(quotations: Quotation[], costs: ProjectCost[]) {
  const active = quotations.filter((quotation) => !quotation.isVoided);
  const needsReview = active.some(
    (quotation) =>
      quotation.financialNeedsReview ||
      quotation.serviceCollectedBeforeVat == null ||
      !Number.isFinite(Number(quotation.serviceCollectedBeforeVat)),
  );
  const collectedBeforeVat = active.reduce(
    (sum, quotation) => sum + (Number(quotation.serviceCollectedBeforeVat) || 0),
    0,
  );
  const compensation = active.reduce(
    (sum, quotation) => sum + (Number(quotation.compensationAmount) || 0),
    0,
  );
  const netAdvertisingBudget = active.reduce((sum, quotation) => {
    if (
      quotation.isFullyRefunded ||
      quotation.paymentStatus === 'refunded' ||
      quotation.status === 'refunded'
    )
      return sum;
    const { eligibleBudget } = calculateAvailableTopupBudget({
      quotations: [quotation],
      costs: [],
    });
    return sum + Math.max(0, eligibleBudget - (Number(quotation.budgetRefundedAmount) || 0));
  }, 0);
  // Advertising principal is funded separately. Retain partner costs, additional
  // costs and any advertising spend beyond the eligible customer budget as losses.
  const actualTopupCost = costs
    .filter((cost) => cost.status === 'completed' && cost.entryType === 'ad_spend')
    .reduce((sum, cost) => sum + topupBudgetUsed(cost), 0);
  const serviceCost =
    calculateRealizedProjectCost(costs) -
    actualTopupCost +
    Math.max(0, actualTopupCost - netAdvertisingBudget);
  return {
    needsReview,
    collectedBeforeVat: needsReview ? null : collectedBeforeVat,
    serviceCost,
    serviceProfit: needsReview ? null : collectedBeforeVat - serviceCost - compensation,
  };
}
