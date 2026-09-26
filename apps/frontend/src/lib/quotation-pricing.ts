import { calculateManagementFee, type ManagementFeeRate } from './service-quote-config';

export const MAX_QUOTATION_ROUNDING_ADJUSTMENT = 1;

// Match PHP's half-up rounding, including negative adjustment/discount lines.
export function roundQuotationMoney(value: number) {
  return Math.sign(value) * Math.round(Math.abs(value));
}

type PricingLine = { amount: number; excludedFromTotal?: boolean };

export function calculateQuotationTotals({
  lines,
  vatRate,
  deposit = 0,
  targetTotal = null,
}: {
  lines: PricingLine[];
  vatRate: number;
  deposit?: number;
  targetTotal?: number | null;
}) {
  const amounts = lines.map((line) => roundQuotationMoney(line.amount));
  const subtotal = amounts.reduce(
    (sum, amount, index) => sum + (lines[index].excludedFromTotal ? 0 : amount),
    0,
  );
  const vatAmount = roundQuotationMoney((subtotal * vatRate) / 100);
  const depositAmount = roundQuotationMoney(deposit);
  const baseTotal = subtotal + vatAmount + depositAmount;
  const difference = targetTotal === null ? 0 : targetTotal - baseTotal;
  const targetError =
    targetTotal !== null && (!Number.isSafeInteger(targetTotal) || targetTotal <= 0)
      ? 'Tổng thanh toán mong muốn phải là số nguyên lớn hơn 0.'
      : Math.abs(difference) > MAX_QUOTATION_ROUNDING_ADJUSTMENT
        ? 'Chỉ được điều chỉnh làm tròn tối đa 1đ. Vui lòng kiểm tra ngân sách và các hạng mục.'
        : '';
  const roundingAdjustment = targetError ? 0 : difference;
  const lineVatAmounts = amounts.map((amount, index) =>
    lines[index].excludedFromTotal ? 0 : roundQuotationMoney((amount * vatRate) / 100),
  );
  // Keep item VAT totals equal to the quotation VAT without altering its tax rate.
  const lastTaxableIndex = lines.reduce(
    (last, line, index) => (!line.excludedFromTotal && amounts[index] !== 0 ? index : last),
    -1,
  );
  if (lastTaxableIndex >= 0) {
    lineVatAmounts[lastTaxableIndex] +=
      vatAmount - lineVatAmounts.reduce((sum, amount) => sum + amount, 0);
  }

  return {
    subtotal,
    vatAmount,
    depositAmount,
    baseTotal,
    roundingAdjustment,
    total: baseTotal + roundingAdjustment,
    targetError,
    lineVatAmounts,
  };
}

// Quick quotations may mix VAT rates. Each group uses the saved-quotation rule.
export function calculateMixedRateQuotationTotals(lines: Array<PricingLine & { vatRate: number }>) {
  const amounts = lines.map((line) => roundQuotationMoney(line.amount));
  const lineVatAmounts = lines.map(() => 0);
  const vatTotals: Record<string, number> = {};
  const rates = [
    ...new Set(lines.filter((line) => !line.excludedFromTotal).map((line) => line.vatRate)),
  ];
  for (const rate of rates) {
    const indices = lines.flatMap((line, index) =>
      !line.excludedFromTotal && line.vatRate === rate ? [index] : [],
    );
    const totals = calculateQuotationTotals({
      lines: indices.map((index) => ({ amount: amounts[index] })),
      vatRate: rate,
    });
    indices.forEach((index, offset) => {
      lineVatAmounts[index] = totals.lineVatAmounts[offset];
    });
    if (rate !== 0) vatTotals[String(rate)] = totals.vatAmount;
  }
  const subtotal = amounts.reduce(
    (sum, amount, index) => sum + (lines[index].excludedFromTotal ? 0 : amount),
    0,
  );
  return {
    amounts,
    lineVatAmounts,
    subtotal,
    vatTotals,
    total: subtotal + Object.values(vatTotals).reduce((sum, amount) => sum + amount, 0),
  };
}

export function findBudgetForQuotationTotal({
  targetTotal,
  vatRate,
  deposit,
  fixedSubtotal,
  excludeBudget,
  rates,
  currentBudget = 0,
}: {
  targetTotal: number;
  vatRate: number;
  deposit: number;
  fixedSubtotal: number;
  excludeBudget: boolean;
  rates: ManagementFeeRate[];
  currentBudget?: number;
}): { budget: number; error: string } {
  const invalid = {
    budget: currentBudget,
    error: 'Không thể tính ngân sách theo tổng này với biểu phí hiện tại.',
  };
  if (!Number.isSafeInteger(targetTotal) || targetTotal <= 0) {
    return {
      budget: currentBudget,
      error: 'Tổng thanh toán mong muốn phải là số nguyên lớn hơn 0.',
    };
  }
  const taxableTarget = (targetTotal - roundQuotationMoney(deposit)) / (1 + vatRate / 100);
  if (taxableTarget < fixedSubtotal) return invalid;

  // Fee tiers can drop at their boundaries, so a single binary search is unsafe.
  const candidates = new Set<number>([Math.round(currentBudget), 0]);
  for (const rate of rates) {
    const factor = (excludeBudget ? 0 : 1) + rate.single / 100;
    const estimates = [rate.min, ...(rate.max === null ? [] : [rate.max - 1])];
    if (factor > 0) estimates.push((taxableTarget - fixedSubtotal) / factor);
    for (const estimate of estimates) {
      for (let offset = -3; offset <= 3; offset += 1) {
        const budget = Math.round(estimate) + offset;
        if (Number.isSafeInteger(budget) && budget >= 0) candidates.add(budget);
      }
    }
  }
  const matches = [...candidates]
    .map((budget) => {
      const fee = calculateManagementFee({ budget, channelMode: 'single', rates }).amount;
      const totals = calculateQuotationTotals({
        lines: [{ amount: (excludeBudget ? 0 : budget) + fee + fixedSubtotal }],
        vatRate,
        deposit,
        targetTotal,
      });
      return { budget, ...totals };
    })
    .filter((candidate) => !candidate.targetError);
  matches.sort(
    (a, b) =>
      Math.abs(a.roundingAdjustment) - Math.abs(b.roundingAdjustment) ||
      // Prefer a 1đ reduction over increasing the amount on an equal-distance tie.
      a.roundingAdjustment - b.roundingAdjustment ||
      Math.abs(a.budget - currentBudget) - Math.abs(b.budget - currentBudget),
  );
  return matches[0] ? { budget: matches[0].budget, error: '' } : invalid;
}
