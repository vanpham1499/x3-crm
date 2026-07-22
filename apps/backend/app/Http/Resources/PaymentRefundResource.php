<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentRefundResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'paymentId' => $this->payment_id,
            'paymentAllocationId' => $this->payment_allocation_id,
            'quotationId' => $this->quotation_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'refundType' => $this->refund_type,
            'status' => $this->status,
            'amount' => $this->amount,
            'scheduledAt' => $this->scheduled_at?->toISOString(),
            'refundedAt' => $this->refunded_at?->toISOString(),
            'completedAt' => $this->completed_at?->toISOString(),
            'recipientName' => $this->recipient_name,
            'recipientAccount' => $this->recipient_account,
            'recipientBank' => $this->recipient_bank,
            'reason' => $this->reason,
            'reference' => $this->reference,
            'note' => $this->note,
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'id' => $this->payment->id,
                'amount' => $this->payment->amount,
                'transactionAt' => $this->payment->transaction_at?->format('Y-m-d H:i:s')
                    ?? $this->payment->transaction_date?->toDateString(),
                'transactionContent' => $this->payment->transaction_content,
                'reference' => $this->payment->reference,
            ] : null),
            'allocation' => $this->whenLoaded('allocation', fn () => $this->allocation ? [
                'id' => $this->allocation->id,
                'amount' => $this->allocation->amount,
            ] : null),
            'quotation' => $this->whenLoaded('quotation', fn () => $this->quotation ? [
                'id' => $this->quotation->id,
                'quotationCode' => $this->quotation->quotation_code,
                'depositAmount' => $this->quotation->deposit_amount,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
            ] : null),
            'createdBy' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
