<?php

namespace App\Support;

use App\Models\PaymentRefund;
use App\Models\Quotation;

/** Operational service revenue, independent of the monthly KPI policy. No ledger writes. */
final class QuotationServiceRevenue
{
    public static function calculate(Quotation $quotation, array $topup): array
    {
        if ($quotation->isVoided()) {
            return ['beforeVat' => 0.0, 'collectedBeforeVat' => 0.0, 'needsReview' => false];
        }
        $quotation->loadMissing(['items', 'paymentAllocations', 'paymentRefunds']);
        $included = $quotation->items->reject(fn ($item) => QuotationFinancialBasis::excluded($item));
        $serviceItems = $included->reject(fn ($item) => (string) $item->item_code === '-1'
            || QuotationFinancialBasis::isBudgetItem($quotation, $item));
        $beforeVat = round((float) $serviceItems->sum('amount_before_vat'), 2);
        $gross = round((float) $serviceItems->sum(fn ($item) => QuotationFinancialBasis::gross($item)), 2);
        $billableGross = round((float) $quotation->subtotal_amount + (float) $quotation->vat_amount
            + (float) ($quotation->metadata['roundingAdjustment'] ?? 0));
        $needsReview = $quotation->items->isEmpty()
            || abs((float) $included->sum('amount_before_vat') - (float) $quotation->subtotal_amount) > 1
            || abs((float) $included->sum(fn ($item) => QuotationFinancialBasis::gross($item)) - $billableGross) > 1
            || $beforeVat < 0 || $gross < 0
            || (QuotationFinancialBasis::projectType($quotation) === 'K'
                && $included->contains(fn ($item) => (string) $item->item_code === '-1' && (float) $item->amount_before_vat > 0))
            || ((float) ($quotation->metadata['budget'] ?? 0) > 0
                && QuotationFinancialBasis::projectType($quotation) !== 'K'
                && ! $quotation->items->contains(fn ($item) => (string) $item->item_code === '-1'));

        $collected = 0.0;
        if (! $needsReview && ! $topup['isFullyRefunded'] && $billableGross > 0 && $gross > 0) {
            $grossPaid = round((float) $quotation->paymentAllocations->sum('amount'));
            $deposit = QuotationSettlement::usesNonTaxableDeposit($quotation)
                ? max(0, round((float) $quotation->deposit_amount)) : 0.0;
            $refundGross = 0.0;
            foreach ($quotation->paymentRefunds->where('status', PaymentRefund::STATUS_COMPLETED)
                ->where('refund_type', PaymentRefund::TYPE_PAYMENT) as $refund) {
                // Explicit budget refunds do not claw back a service fee.
                $hasSplit = $refund->service_fee_refund_amount !== null || $refund->budget_refund_amount !== null;
                $refundGross += $hasSplit ? max(0, (float) $refund->service_fee_refund_amount)
                    : max(0, (float) $refund->amount) * $gross / $billableGross;
            }
            $paidServiceGross = min($gross, max(0, $grossPaid - $deposit) * $gross / $billableGross);
            $netServiceGross = min($topup['usablePaidAmount'], max(0, $paidServiceGross - $refundGross));
            $collected = round($netServiceGross * $beforeVat / $gross, 2);
            // A refund followed by overcollection needs chronological reconciliation;
            // never silently show an understated/overstated profit from aggregate totals.
            $needsReview = $refundGross > 0 && $grossPaid - $deposit > $billableGross + 1;
        }

        return [
            'beforeVat' => $needsReview ? null : $beforeVat,
            'collectedBeforeVat' => $needsReview ? null : $collected,
            'needsReview' => $needsReview,
        ];
    }
}
