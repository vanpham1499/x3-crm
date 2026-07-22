<?php

namespace App\Http\Resources;

use App\Models\PaymentRefund;
use App\Models\Quotation;
use App\Support\QuotationReference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuotationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $grossPaidAmount = $this->relationLoaded('paymentAllocations')
            ? (float) $this->paymentAllocations->sum('amount')
            : 0.0;
        $completedRefunds = $this->relationLoaded('paymentRefunds')
            ? $this->paymentRefunds
                ->where('status', PaymentRefund::STATUS_COMPLETED)
            : collect();
        $depositRefundedAmount = (float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->sum('amount');
        $paymentRefundedAmount = (float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_PAYMENT)
            ->sum('amount');
        $refundedAmount = $depositRefundedAmount + $paymentRefundedAmount;
        $compensationAmount = (float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_COMPENSATION)
            ->sum('amount');
        $outboundAmount = $refundedAmount + $compensationAmount;
        $overCompensationAmount = max(0, $outboundAmount - $grossPaidAmount);
        $paidAmount = max(0, $grossPaidAmount - $refundedAmount);
        $totalAmount = (float) $this->total_amount;
        $storedDepositAmount = (float) $this->deposit_amount;
        $metadata = is_array($this->metadata) ? $this->metadata : [];
        $expectedTotalWithDeposit = (float) $this->subtotal_amount
            + (float) $this->vat_amount
            + $storedDepositAmount;
        $usesNonTaxableDeposit = ($metadata['depositMode'] ?? null) === Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION
            || ($storedDepositAmount > 0
                && abs($totalAmount - $expectedTotalWithDeposit) < 0.01);
        $releasedDepositAmount = $usesNonTaxableDeposit
            ? min($storedDepositAmount, $depositRefundedAmount)
            : 0.0;
        $isFullyRefunded = $grossPaidAmount > 0.01
            && $paidAmount <= 0.01
            && $refundedAmount >= $grossPaidAmount - 0.01;
        $collectibleAmount = $isFullyRefunded
            ? 0.0
            : max(0, $totalAmount - $releasedDepositAmount);
        $outstandingAmount = max(0, $collectibleAmount - $paidAmount);
        $paymentStatus = $this->paymentStatus(
            $grossPaidAmount,
            $paidAmount,
            $collectibleAmount,
            $paymentRefundedAmount,
            $isFullyRefunded,
        );
        $status = match (true) {
            $isFullyRefunded => Quotation::STATUS_REFUNDED,
            $collectibleAmount > 0.01 && $paidAmount >= $collectibleAmount - 0.01 => Quotation::STATUS_WON,
            default => Quotation::STATUS_DRAFT,
        };
        $isPaymentLocked = $totalAmount > 0.01 && $grossPaidAmount >= $totalAmount - 0.01;

        return [
            'id' => $this->id,
            'quotationCode' => $this->quotation_code,
            'paymentContent' => QuotationReference::canonical($this->quotation_code),
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'contractId' => $this->contract_id,
            'serviceId' => $this->service_id,
            'serviceCode' => $this->service_code,
            'serviceName' => $this->service_name,
            'status' => $status,
            'subtotalAmount' => $this->subtotal_amount,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'totalAmount' => $this->total_amount,
            'paidAmount' => round($paidAmount, 2),
            'grossPaidAmount' => round($grossPaidAmount, 2),
            'refundedAmount' => round($refundedAmount, 2),
            'depositRefundedAmount' => round($depositRefundedAmount, 2),
            'paymentRefundedAmount' => round($paymentRefundedAmount, 2),
            'compensationAmount' => round($compensationAmount, 2),
            'outboundAmount' => round($outboundAmount, 2),
            'overCompensationAmount' => round($overCompensationAmount, 2),
            'collectibleAmount' => round($collectibleAmount, 2),
            'outstandingAmount' => round($outstandingAmount, 2),
            'paymentStatus' => $paymentStatus,
            'isFullyRefunded' => $isFullyRefunded,
            'isPaymentLocked' => $isPaymentLocked,
            'depositAmount' => $usesNonTaxableDeposit ? $this->deposit_amount : 0,
            'accountReconciliationImageUrls' => $this->account_reconciliation_image_urls ?? [],
            'validUntil' => $this->valid_until?->toDateString(),
            'note' => $this->note,
            'metadata' => $this->metadata,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => $this->lead->id,
                'leadCode' => $this->lead->lead_code,
                'customerName' => $this->lead->customer_name,
                'assignedUserId' => $this->lead->assigned_user_id,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
                'salesUserId' => $this->customer->sales_user_id,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'projectType' => $this->project->project_type,
                'managerUserId' => $this->project->manager_user_id,
                'salesUserId' => $this->project->sales_user_id,
            ] : null),
            'contract' => $this->whenLoaded('contract', fn () => $this->contract ? [
                'id' => $this->contract->id,
                'contractNo' => $this->contract->contract_no,
            ] : null),
            'service' => $this->whenLoaded('service', fn () => $this->service ? new ServiceResource($this->service) : null),
            'items' => QuotationItemResource::collection($this->whenLoaded('items')),
            'createdBy' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
                'email' => $this->createdBy->email,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }

    private function paymentStatus(
        float $grossPaidAmount,
        float $paidAmount,
        float $collectibleAmount,
        float $paymentRefundedAmount,
        bool $isFullyRefunded,
    ): string {
        if ($isFullyRefunded) {
            return 'refunded';
        }

        if ($grossPaidAmount <= 0.01 && $paidAmount <= 0.01) {
            return 'unpaid';
        }

        if ($paidAmount < $collectibleAmount - 0.01) {
            return $paymentRefundedAmount > 0.01 ? 'partially_refunded' : 'partial';
        }

        if ($paidAmount > $collectibleAmount + 0.01) {
            return 'overpaid';
        }

        return 'paid';
    }
}
