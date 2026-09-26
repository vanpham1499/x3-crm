<?php

namespace App\Http\Resources;

use App\Models\PaymentRefund;
use App\Support\ProjectTopupBudgetCalculator;
use App\Support\QuotationReference;
use App\Support\QuotationSettlement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuotationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $grossPaidAmount = round($this->relationLoaded('paymentAllocations')
            ? (float) $this->paymentAllocations->sum('amount')
            : 0.0);
        $completedRefunds = $this->relationLoaded('paymentRefunds')
            ? $this->paymentRefunds
                ->where('status', PaymentRefund::STATUS_COMPLETED)
            : collect();
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
        $compensationAmount = round((float) $completedRefunds
            ->where('refund_type', PaymentRefund::TYPE_COMPENSATION)
            ->sum('amount'));
        $outboundAmount = $refundedAmount + $compensationAmount;
        $overCompensationAmount = max(0, $outboundAmount - $grossPaidAmount);
        $metadata = is_array($this->metadata) ? $this->metadata : [];
        $usesNonTaxableDeposit = QuotationSettlement::usesNonTaxableDeposit($this->resource);
        $snapshot = QuotationSettlement::snapshot(
            (float) $this->total_amount,
            $usesNonTaxableDeposit ? (float) $this->deposit_amount : 0.0,
            $grossPaidAmount, $refundedAmount, $depositRefundedAmount,
        );
        $paidAmount = $snapshot['received_amount'];
        $totalAmount = $snapshot['total_amount'];
        $isFullyRefunded = $snapshot['is_fully_refunded'];
        $collectibleAmount = $snapshot['collectible_amount'];
        $outstandingAmount = $snapshot['outstanding_amount'];
        $paymentStatus = $snapshot['status'];
        $status = $snapshot['quotation_status'];
        $isPaymentLocked = $snapshot['is_payment_locked'];
        $topupBudget = ProjectTopupBudgetCalculator::calculateQuotation($this->resource);

        return [
            'id' => $this->id,
            'quotationCode' => $this->quotation_code,
            'paymentContent' => $this->resource->isVoided() ? null : QuotationReference::canonical($this->quotation_code),
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'contractId' => $this->contract_id,
            'serviceId' => $this->service_id,
            'serviceCode' => $this->service_code,
            'serviceName' => $this->service_name,
            'status' => $this->resource->isVoided() ? 'voided' : $status,
            'isVoided' => $this->resource->isVoided(),
            'voidedAt' => $this->voided_at?->toISOString(),
            'voidDetails' => ($request->user()?->can('void', $this->resource) ?? false) ? $this->void_details : null,
            'canVoid' => ! $this->resource->isVoided() && (bool) ($request->user()?->can('void', $this->resource) ?? false),
            'subtotalAmount' => $this->subtotal_amount,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'totalAmount' => $totalAmount,
            'targetTotalAmount' => $metadata['targetTotalAmount'] ?? null,
            'roundingAdjustment' => (float) ($metadata['roundingAdjustment'] ?? 0),
            'paidAmount' => round($paidAmount, 2),
            'grossPaidAmount' => round($grossPaidAmount, 2),
            'refundedAmount' => round($refundedAmount, 2),
            'depositRefundedAmount' => round($depositRefundedAmount, 2),
            'paymentRefundedAmount' => round($paymentRefundedAmount, 2),
            'budgetRefundedAmount' => round($budgetRefundedAmount, 2),
            'serviceFeeRefundedAmount' => round($serviceFeeRefundedAmount, 2),
            'compensationAmount' => round($compensationAmount, 2),
            'outboundAmount' => round($outboundAmount, 2),
            'overCompensationAmount' => round($overCompensationAmount, 2),
            'collectibleAmount' => $this->resource->isVoided() ? 0 : round($collectibleAmount, 2),
            'outstandingAmount' => $this->resource->isVoided() ? 0 : round($outstandingAmount, 2),
            'paymentStatus' => $this->resource->isVoided() ? 'voided' : $paymentStatus,
            'isFullyRefunded' => $isFullyRefunded,
            'isPaymentLocked' => $this->resource->isVoided() || $isPaymentLocked,
            'depositAmount' => $usesNonTaxableDeposit ? $this->deposit_amount : 0,
            'topupCreditEnabled' => (bool) $this->topup_credit_enabled,
            'topupCreditLimit' => $this->topup_credit_limit,
            'topupCreditNote' => $this->topup_credit_note,
            'topupCreditApprovedAt' => $this->topup_credit_approved_at?->toISOString(),
            'topupEligibleAmount' => $topupBudget['eligibleBudget'],
            'topupPaidBudget' => $topupBudget['paidBudget'],
            'topupCreditBudget' => $topupBudget['creditBudget'],
            'topupReleasedBudget' => $topupBudget['releasedBudget'],
            'topupUsablePaidAmount' => $topupBudget['usablePaidAmount'],
            'topupHeldDepositAmount' => $topupBudget['heldDepositAmount'],
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
            'topupCreditApprovedBy' => $this->whenLoaded('topupCreditApprovedBy', fn () => $this->topupCreditApprovedBy ? [
                'id' => $this->topupCreditApprovedBy->id,
                'code' => $this->topupCreditApprovedBy->code,
                'name' => $this->topupCreditApprovedBy->name,
            ] : null),
            'canUpdate' => (bool) ($request->user()?->can('update', $this->resource) ?? false),
            'canDelete' => (bool) ($request->user()?->can('delete', $this->resource) ?? false),
            'canApproveTopupCredit' => (bool) ($request->user()?->hasPermission('quotation.approve_topup_credit') ?? false),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
