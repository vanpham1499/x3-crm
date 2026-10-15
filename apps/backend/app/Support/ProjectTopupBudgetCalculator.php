<?php

namespace App\Support;

use App\Models\PaymentRefund;
use App\Models\Project;
use App\Models\ProjectCost;
use App\Models\Quotation;

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
     *   availableBudget: float,
     *   hasTopupBudgetSource: bool
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
            ->reject(fn (Quotation $quotation): bool => $quotation->isVoided())
            ->map(fn (Quotation $quotation): array => self::calculateQuotation($quotation));
        $eligibleBudget = round((float) $quotationBudgets->sum('eligibleBudget'));
        $paidBudget = round((float) $quotationBudgets->sum('paidBudget'));
        $creditBudget = round((float) $quotationBudgets->sum('creditBudget'));
        $hasTopupBudgetSource = $quotationBudgets
            ->contains(fn (array $budget): bool => ! $budget['isFullyRefunded'] && $budget['eligibleBudget'] > 0);
        $releasedBudget = round($paidBudget + $creditBudget);
        $usedBudget = round((float) $project->costs
            ->where('entry_type', ProjectCost::TYPE_AD_SPEND)
            ->where('status', ProjectCost::STATUS_COMPLETED)
            ->sum(fn (ProjectCost $cost): float => $cost->actualCostAmount()));

        return [
            'eligibleBudget' => $eligibleBudget,
            'paidBudget' => $paidBudget,
            'creditBudget' => $creditBudget,
            // Kept for existing callers; this is now the amount actually released.
            'customerBudget' => $releasedBudget,
            'releasedBudget' => $releasedBudget,
            'usedBudget' => $usedBudget,
            'availableBudget' => round($releasedBudget - $usedBudget),
            'hasTopupBudgetSource' => $hasTopupBudgetSource,
            'promotionGranted' => round((float) $project->costs->filter(fn ($cost) => $cost->isPromotion() && $cost->status === 'completed')->sum('total_amount'), 2),
            'promotionUsed' => round((float) $project->costs->filter(fn ($cost) => $cost->isPromotion() && $cost->status === 'completed')->sum('promotion_used_amount'), 2),
            'promotionAvailable' => round((float) $project->costs->sum(fn ($cost) => $cost->promotionAvailableAmount()), 2),
        ];
    }

    /**
     * @return array{
     *   eligibleBudget: float,
     *   paidBudget: float,
     *   creditBudget: float,
     *   releasedBudget: float,
     *   usablePaidAmount: float,
     *   heldDepositAmount: float,
     *   budgetRefundedAmount: float,
     *   serviceFeeRefundedAmount: float,
     *   isFullyRefunded: bool
     * }
     */
    public static function calculateQuotation(Quotation $quotation): array
    {
        if ($quotation->isVoided()) {
            return ['eligibleBudget' => 0.0, 'paidBudget' => 0.0, 'creditBudget' => 0.0,
                'releasedBudget' => 0.0, 'usablePaidAmount' => 0.0, 'heldDepositAmount' => 0.0,
                'budgetRefundedAmount' => 0.0, 'serviceFeeRefundedAmount' => 0.0, 'isFullyRefunded' => false];
        }
        $quotation->loadMissing(['items', 'paymentAllocations', 'paymentRefunds']);

        $eligibleBudget = QuotationFinancialBasis::eligibleBudget($quotation);
        $grossPaidAmount = round((float) $quotation->paymentAllocations->sum('amount'));
        $completedRefunds = $quotation->paymentRefunds
            ->where('status', PaymentRefund::STATUS_COMPLETED);
        $depositRefundedAmount = round((float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->sum('amount'));
        $paymentRefundedAmount = round((float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_PAYMENT)
            ->sum('amount'));
        $budgetRefundedAmount = round((float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_PAYMENT)
            ->sum('budget_refund_amount'));
        $serviceFeeRefundedAmount = round((float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_PAYMENT)
            ->sum('service_fee_refund_amount'));
        $refundedAmount = $depositRefundedAmount + $paymentRefundedAmount;
        $netPaidAmount = max(0, $grossPaidAmount - $refundedAmount);
        $isFullyRefunded = $grossPaidAmount > 0.01
            && $netPaidAmount <= 0.01
            && $refundedAmount >= $grossPaidAmount - 0.01;
        $heldDepositAmount = ! $isFullyRefunded && self::usesNonTaxableDeposit($quotation)
            ? max(0, min(round((float) $quotation->deposit_amount), $grossPaidAmount) - $depositRefundedAmount)
            : 0.0;
        $usablePaidAmount = $isFullyRefunded
            ? 0.0
            : round(max(0, $netPaidAmount - $heldDepositAmount));
        $fundedBudget = $isFullyRefunded
            ? 0.0
            : round(min($eligibleBudget, max(0, $grossPaidAmount - $heldDepositAmount)));
        $paidBudget = round(max(0, $fundedBudget - $budgetRefundedAmount));
        // Credit only covers budget that was never funded. A returned budget must
        // not silently become debt and become available for another top-up.
        $remainingEligibleBudget = max(0, $eligibleBudget - $fundedBudget);
        $creditLimit = ! $isFullyRefunded && $quotation->topup_credit_enabled
            ? max(0, round((float) $quotation->topup_credit_limit))
            : 0.0;
        $creditBudget = round(min($remainingEligibleBudget, $creditLimit));

        return [
            'eligibleBudget' => $eligibleBudget,
            'paidBudget' => $paidBudget,
            'creditBudget' => $creditBudget,
            'releasedBudget' => round($paidBudget + $creditBudget),
            'usablePaidAmount' => $usablePaidAmount,
            'heldDepositAmount' => round($heldDepositAmount),
            'budgetRefundedAmount' => $budgetRefundedAmount,
            'serviceFeeRefundedAmount' => $serviceFeeRefundedAmount,
            'isFullyRefunded' => $isFullyRefunded,
        ];
    }

    private static function usesNonTaxableDeposit(Quotation $quotation): bool
    {
        return QuotationSettlement::usesNonTaxableDeposit($quotation);
    }

}
