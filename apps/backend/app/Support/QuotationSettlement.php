<?php

namespace App\Support;

use App\Models\Quotation;

/**
 * Whole-VND quotation decisions, not a mutator for bank/ledger amounts.
 * SQL filtering in QuotationRepository mirrors these rules before pagination.
 */
final class QuotationSettlement
{
    public static function isPaymentLocked(float $totalAmount, float $grossPaidAmount): bool
    {
        $totalAmount = round($totalAmount);

        return $totalAmount > 0 && round($grossPaidAmount) >= $totalAmount;
    }

    public static function usesNonTaxableDeposit(Quotation $quotation): bool
    {
        $metadata = is_array($quotation->metadata) ? $quotation->metadata : [];
        $depositAmount = round((float) $quotation->deposit_amount);
        $expectedTotal = (float) $quotation->subtotal_amount
            + (float) $quotation->vat_amount
            + $depositAmount
            + (float) ($metadata['roundingAdjustment'] ?? 0);

        // Legacy quotes may have exact decimal totals before VND presentation.
        // Preserve that evidence that the deposit was included, rather than
        // comparing a rounded total against an unrounded taxable subtotal only.
        $rawExpectedTotal = $expectedTotal - $depositAmount + (float) $quotation->deposit_amount;

        return ($metadata['depositMode'] ?? null) === Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION
            || ($depositAmount > 0
                && (abs(round((float) $quotation->total_amount) - $expectedTotal) < 0.01
                    || abs((float) $quotation->total_amount - $rawExpectedTotal) < 0.01));
    }

    /**
     * Inputs are raw aggregate amounts. Sum allocations first; round deposit and
     * payment refunds separately, exactly as the quotation API/filter does.
     * Compensation and refunds of unallocated surplus are not quotation refunds.
     */
    public static function snapshot(
        float $totalAmount,
        float $depositLiability,
        float $grossReceivedAmount,
        float $refundedAmount,
        float $depositRefundedAmount,
    ): array {
        $totalAmount = round($totalAmount);
        $depositLiability = round($depositLiability);
        $grossReceivedAmount = round($grossReceivedAmount);
        // Ledger columns have 2 decimal places. Remove binary subtraction noise
        // before the whole-VND boundary, without rounding individual receipts.
        $paymentRefundedAmount = round(round($refundedAmount - $depositRefundedAmount, 2));
        $depositRefundedAmount = round($depositRefundedAmount);
        $refundedAmount = $depositRefundedAmount + $paymentRefundedAmount;
        $receivedAmount = max(0, $grossReceivedAmount - $refundedAmount);
        $isFullyRefunded = $grossReceivedAmount > 0
            && $receivedAmount <= 0
            && $refundedAmount >= $grossReceivedAmount;
        $releasedDeposit = min($depositLiability, $depositRefundedAmount);
        $collectibleAmount = $isFullyRefunded ? 0.0 : max(0, $totalAmount - $releasedDeposit);
        $status = match (true) {
            $isFullyRefunded => 'refunded',
            $grossReceivedAmount <= 0 && $receivedAmount <= 0 => 'unpaid',
            $receivedAmount < $collectibleAmount && $paymentRefundedAmount > 0 => 'partially_refunded',
            $receivedAmount < $collectibleAmount => 'partial',
            $receivedAmount > $collectibleAmount => 'overpaid',
            default => 'paid',
        };
        $quotationStatus = match (true) {
            $isFullyRefunded => Quotation::STATUS_REFUNDED,
            $collectibleAmount > 0 && $receivedAmount >= $collectibleAmount => Quotation::STATUS_WON,
            default => Quotation::STATUS_DRAFT,
        };

        return [
            'total_amount' => $totalAmount,
            'gross_received_amount' => $grossReceivedAmount,
            'refunded_amount' => $refundedAmount,
            'deposit_refunded_amount' => $depositRefundedAmount,
            'payment_refunded_amount' => $paymentRefundedAmount,
            'received_amount' => $receivedAmount,
            'collectible_amount' => $collectibleAmount,
            'outstanding_amount' => max(0, $collectibleAmount - $receivedAmount),
            'excess_amount' => max(0, $receivedAmount - $collectibleAmount),
            'difference_amount' => $receivedAmount - $collectibleAmount,
            'is_fully_refunded' => $isFullyRefunded,
            'is_payment_locked' => self::isPaymentLocked($totalAmount, $grossReceivedAmount),
            'status' => $status,
            'quotation_status' => $quotationStatus,
        ];
    }
}
