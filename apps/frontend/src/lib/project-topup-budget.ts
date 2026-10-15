import type { ProjectCost } from '@/types/project-cost';
import { roundQuotationMoney } from './quotation-pricing';
import type { Quotation } from '@/types/quotation';

function metadataFlag(value: unknown) {
  return (
    value === true ||
    value === 1 ||
    ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
  );
}

export function quotationProjectType(quotation: Quotation) {
  for (const value of [
    quotation.metadata?.projectType,
    String(quotation.metadata?.projectCodeBase || '').split('.')[2],
    quotation.quotationCode?.split('.')[2],
  ]) {
    const type = String(value || '')
      .trim()
      .toUpperCase();
    if (['K', 'M', 'O', 'N'].includes(type)) return type;
  }
  return null;
}

export function calculateQuotationEligibleTopupBudget(quotation: Quotation) {
  if (quotation.isVoided || quotationProjectType(quotation) === 'K') return 0;
  const hasBudgetLine = (quotation.items || []).some((item) => String(item.itemCode) === '-1');
  const budget =
    !hasBudgetLine && quotationProjectType(quotation) === 'M'
      ? Math.max(0, roundQuotationMoney(Number(quotation.metadata?.budget) || 0))
      : 0;
  const vatRate = Math.max(0, Number(quotation.vatRate) || 0);
  const extraTopupBudget = (quotation.items || []).reduce((sum, item) => {
    if (metadataFlag(item.metadata?.excludedFromTotal)) return sum;
    if (['-2', '-3'].includes(String(item.itemCode))) return sum;
    if (String(item.itemCode) !== '-1' && !metadataFlag(item.metadata?.countsTowardTopupBudget))
      return sum;

    if (item.amountAfterVat !== null && item.amountAfterVat !== undefined) {
      const amountAfterVat = Number(item.amountAfterVat);
      if (Number.isFinite(amountAfterVat)) return sum + roundQuotationMoney(amountAfterVat);
    }

    const amountBeforeVat = Number(item.amountBeforeVat) || 0;
    const itemVatRate = Math.max(0, Number(item.vatRate) || 0);

    const afterVat =
      amountBeforeVat +
      (item.vatAmount != null
        ? Number(item.vatAmount)
        : roundQuotationMoney(amountBeforeVat * itemVatRate) / 100);
    return sum + roundQuotationMoney(afterVat);
  }, 0);

  return roundQuotationMoney(
    Math.max(0, budget + roundQuotationMoney((budget * vatRate) / 100) + extraTopupBudget),
  );
}

function quotationTopupBreakdown(quotation: Quotation) {
  const hasServerEligibleBudget =
    quotation.topupEligibleAmount !== null &&
    quotation.topupEligibleAmount !== undefined &&
    Number.isFinite(Number(quotation.topupEligibleAmount));
  const eligibleBudget = Math.round(
    quotationProjectType(quotation) === 'K'
      ? 0
      : hasServerEligibleBudget
        ? Number(quotation.topupEligibleAmount)
        : calculateQuotationEligibleTopupBudget(quotation),
  );
  const grossPaidAmount = Math.max(0, Math.round(Number(quotation.grossPaidAmount) || 0));
  const refundedAmount = Math.max(0, Math.round(Number(quotation.refundedAmount) || 0));
  const budgetRefundedAmount = Math.max(0, Math.round(Number(quotation.budgetRefundedAmount) || 0));
  const isFullyRefunded =
    quotation.isFullyRefunded === true ||
    quotation.paymentStatus === 'refunded' ||
    quotation.status === 'refunded';
  const depositRefundedAmount = Math.max(
    0,
    Math.round(Number(quotation.depositRefundedAmount) || 0),
  );
  const heldDepositAmount = isFullyRefunded
    ? 0
    : Math.max(
        0,
        Math.min(Math.max(0, Math.round(Number(quotation.depositAmount) || 0)), grossPaidAmount) -
          depositRefundedAmount,
      );
  const usablePaidAmount = isFullyRefunded
    ? 0
    : Math.max(0, grossPaidAmount - refundedAmount - heldDepositAmount);
  const hasServerPaidBudget =
    quotation.topupPaidBudget !== null &&
    quotation.topupPaidBudget !== undefined &&
    Number.isFinite(Number(quotation.topupPaidBudget));
  const fundedBudget = isFullyRefunded
    ? 0
    : Math.min(eligibleBudget, Math.max(0, grossPaidAmount - heldDepositAmount));
  const paidBudget = hasServerPaidBudget
    ? Math.min(eligibleBudget, Math.max(0, Math.round(Number(quotation.topupPaidBudget))))
    : Math.max(0, fundedBudget - budgetRefundedAmount);
  const remainingEligibleBudget = Math.max(0, eligibleBudget - fundedBudget);
  const creditBudget =
    !isFullyRefunded && quotation.topupCreditEnabled
      ? Math.min(
          remainingEligibleBudget,
          Math.max(0, Math.round(Number(quotation.topupCreditLimit) || 0)),
        )
      : 0;

  return {
    eligibleBudget,
    paidBudget,
    creditBudget,
    releasedBudget: paidBudget + creditBudget,
    isFullyRefunded,
  };
}

export function topupBudgetUsed(cost: ProjectCost) {
  if (cost.fundingSource === 'promotion') return 0;
  const topupAmount = Math.max(0, Number(cost.totalAmount) || Number(cost.amountBeforeVat) || 0);

  if (cost.entryType === 'ad_spend' && cost.cidIsDead) {
    const confirmedRefund =
      cost.cidIncident?.status === 'confirmed'
        ? Math.max(0, Number(cost.cidIncident.refundedAmount) || 0)
        : cost.cidIncident
          ? 0
          : cost.reconciledAt
            ? Math.max(0, Number(cost.cidRefundedAmount) || 0)
            : 0;

    return Math.max(0, topupAmount - Math.min(topupAmount, confirmedRefund));
  }

  if (cost.actualCostAmount !== undefined && cost.actualCostAmount !== null) {
    return Number(cost.actualCostAmount) || 0;
  }

  return topupAmount;
}

export function calculateRealizedProjectCost(costs: ProjectCost[]) {
  return costs.reduce((sum, cost) => {
    if (cost.fundingSource === 'promotion') return sum;
    if (cost.entryType === 'partner_cost' && cost.usesPaymentLedger) {
      return cost.status === 'cancelled' ? sum : sum + (Number(cost.partnerPaidAmount) || 0);
    }
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
  const quotationBudgets = scopedQuotations
    .filter((quotation) => !quotation.isVoided)
    .map(quotationTopupBreakdown);
  const eligibleBudget = quotationBudgets.reduce((sum, item) => sum + item.eligibleBudget, 0);
  const paidBudget = quotationBudgets.reduce((sum, item) => sum + item.paidBudget, 0);
  const creditBudget = quotationBudgets.reduce((sum, item) => sum + item.creditBudget, 0);
  const customerBudget = paidBudget + creditBudget;
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
  // Match the backend: sum actual costs, round used once, then subtract.
  const usedBudget = roundQuotationMoney(savedUsedBudget + editingCostUsed);

  return {
    eligibleBudget,
    paidBudget,
    creditBudget,
    customerBudget,
    releasedBudget: customerBudget,
    usedBudget,
    availableBudget: customerBudget - usedBudget,
    hasTopupBudgetSource: quotationBudgets.some(
      (item) => item.eligibleBudget > 0 && !item.isFullyRefunded,
    ),
  };
}
