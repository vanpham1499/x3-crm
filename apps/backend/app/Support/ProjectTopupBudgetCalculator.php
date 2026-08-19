<?php

namespace App\Support;

use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\Quotation;
use App\Models\QuotationItem;

class ProjectTopupBudgetCalculator
{
    /**
     * @return array{
     *   eligibleBudget: float,
     *   paidBudget: float,
     *   creditBudget: float,
     *   customerBudget: float,
     *   releasedBudget: float,
     *   usedBudget: float,
     *   availableBudget: float
     * }
     */
    public static function calculate(Project $project): array
    {
        $project->loadMissing([
            'quotations.items',
            'quotations.paymentAllocations',
            'quotations.paymentRefunds',
            'costs.cidIncident',
        ]);

        $quotationBudgets = $project->quotations
            ->map(fn (Quotation $quotation): array => self::calculateQuotation($quotation));
        $eligibleBudget = round((float) $quotationBudgets->sum('eligibleBudget'), 2);
        $paidBudget = round((float) $quotationBudgets->sum('paidBudget'), 2);
        $creditBudget = round((float) $quotationBudgets->sum('creditBudget'), 2);
        $releasedBudget = round($paidBudget + $creditBudget, 2);
        $usedBudget = round((float) $project->costs
            ->where('entry_type', ProjectCost::TYPE_AD_SPEND)
            ->where('status', ProjectCost::STATUS_COMPLETED)
            ->sum(fn (ProjectCost $cost): float => $cost->actualCostAmount()), 2);

        return [
            'eligibleBudget' => $eligibleBudget,
            'paidBudget' => $paidBudget,
            'creditBudget' => $creditBudget,
            // Kept for existing callers; this is now the amount actually released.
            'customerBudget' => $releasedBudget,
            'releasedBudget' => $releasedBudget,
            'usedBudget' => $usedBudget,
            'availableBudget' => round($releasedBudget - $usedBudget, 2),
        ];
    }

    /**
     * @return array{
     *   eligibleBudget: float,
     *   paidBudget: float,
     *   creditBudget: float,
     *   releasedBudget: float,
     *   usablePaidAmount: float,
     *   heldDepositAmount: float
     * }
     */
    public static function calculateQuotation(Quotation $quotation): array
    {
        $quotation->loadMissing(['items', 'paymentAllocations', 'paymentRefunds']);

        $eligibleBudget = self::quotationBudget($quotation);
        $grossPaidAmount = (float) $quotation->paymentAllocations->sum('amount');
        $completedRefunds = $quotation->paymentRefunds
            ->where('status', PaymentRefund::STATUS_COMPLETED);
        $depositRefundedAmount = (float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->sum('amount');
        $paymentRefundedAmount = (float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_PAYMENT)
            ->sum('amount');
        $refundedAmount = $depositRefundedAmount + $paymentRefundedAmount;
        $netPaidAmount = max(0, $grossPaidAmount - $refundedAmount);
        $heldDepositAmount = self::usesNonTaxableDeposit($quotation)
            ? max(0, min((float) $quotation->deposit_amount, $grossPaidAmount) - $depositRefundedAmount)
            : 0.0;
        $usablePaidAmount = round(max(0, $netPaidAmount - $heldDepositAmount), 2);
        $paidBudget = round(min($eligibleBudget, $usablePaidAmount), 2);
        $remainingEligibleBudget = max(0, $eligibleBudget - $paidBudget);
        $creditLimit = $quotation->topup_credit_enabled
            ? max(0, (float) $quotation->topup_credit_limit)
            : 0.0;
        $creditBudget = round(min($remainingEligibleBudget, $creditLimit), 2);

        return [
            'eligibleBudget' => $eligibleBudget,
            'paidBudget' => $paidBudget,
            'creditBudget' => $creditBudget,
            'releasedBudget' => round($paidBudget + $creditBudget, 2),
            'usablePaidAmount' => $usablePaidAmount,
            'heldDepositAmount' => round($heldDepositAmount, 2),
        ];
    }

    private static function quotationBudget(Quotation $quotation): float
    {
        $metadata = is_array($quotation->metadata) ? $quotation->metadata : [];
        $budget = max(0, (float) ($metadata['budget'] ?? 0));
        $quotationVatRate = max(0, (float) ($quotation->vat_rate ?? 0));
        $budgetWithVat = $budget + round($budget * $quotationVatRate / 100, 2);
        $extraBudget = (float) $quotation->items
            ->filter(fn (QuotationItem $item): bool => self::countsTowardTopupBudget($item))
            ->sum(fn (QuotationItem $item): float => self::itemAmountAfterVat($item));

        return round($budgetWithVat + $extraBudget, 2);
    }

    private static function usesNonTaxableDeposit(Quotation $quotation): bool
    {
        $metadata = is_array($quotation->metadata) ? $quotation->metadata : [];
        $storedDepositAmount = (float) $quotation->deposit_amount;
        $expectedTotalWithDeposit = (float) $quotation->subtotal_amount
            + (float) $quotation->vat_amount
            + $storedDepositAmount;

        return ($metadata['depositMode'] ?? null) === Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION
            || ($storedDepositAmount > 0
                && abs((float) $quotation->total_amount - $expectedTotalWithDeposit) < 0.01);
    }

    private static function countsTowardTopupBudget(QuotationItem $item): bool
    {
        $metadata = is_array($item->metadata) ? $item->metadata : [];

        return filter_var(
            $metadata['countsTowardTopupBudget'] ?? false,
            FILTER_VALIDATE_BOOLEAN,
        );
    }

    private static function itemAmountAfterVat(QuotationItem $item): float
    {
        if ($item->amount_after_vat !== null) {
            return (float) $item->amount_after_vat;
        }

        $amountBeforeVat = (float) ($item->amount_before_vat ?? 0);
        $vatRate = max(0, (float) ($item->vat_rate ?? 0));

        return round($amountBeforeVat + ($amountBeforeVat * $vatRate / 100), 2);
    }
}
