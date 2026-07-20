<?php

namespace App\Http\Resources;

use App\Models\Quotation;
use App\Support\QuotationReference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuotationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $paidAmount = $this->relationLoaded('paymentAllocations')
            ? (float) $this->paymentAllocations->sum('amount')
            : 0.0;
        $totalAmount = (float) $this->total_amount;
        $isPaymentLocked = $totalAmount > 0.01 && $paidAmount >= $totalAmount - 0.01;
        $storedDepositAmount = (float) $this->deposit_amount;
        $metadata = is_array($this->metadata) ? $this->metadata : [];
        $expectedTotalWithDeposit = (float) $this->subtotal_amount
            + (float) $this->vat_amount
            + $storedDepositAmount;
        $usesNonTaxableDeposit = ($metadata['depositMode'] ?? null) === Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION
            || ($storedDepositAmount > 0
                && abs($totalAmount - $expectedTotalWithDeposit) < 0.01);

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
            'status' => $this->status,
            'subtotalAmount' => $this->subtotal_amount,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'totalAmount' => $this->total_amount,
            'paidAmount' => round($paidAmount, 2),
            'outstandingAmount' => round(max(0, $totalAmount - $paidAmount), 2),
            'paymentStatus' => $this->paymentStatus($paidAmount, $totalAmount),
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
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }

    private function paymentStatus(float $paidAmount, float $totalAmount): string
    {
        if ($paidAmount <= 0) {
            return 'unpaid';
        }

        if ($paidAmount < $totalAmount) {
            return 'partial';
        }

        if ($paidAmount > $totalAmount) {
            return 'overpaid';
        }

        return 'paid';
    }
}
