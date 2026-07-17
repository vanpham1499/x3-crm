<?php

namespace App\Http\Resources;

use App\Support\QuotationReference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $allocatedAmount = $this->ledger_allocated_amount ?? $this->allocated_amount ?? 0;
        $refundedAmount = $this->ledger_refunded_amount ?? $this->refunded_amount ?? 0;
        $availableAmount = $this->ledger_available_amount
            ?? max(0, (float) $this->amount - (float) $allocatedAmount - (float) $refundedAmount);

        return [
            'id' => $this->id,
            'quotationId' => $this->quotation_id,
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'contractId' => $this->contract_id,
            'transactionDate' => $this->transaction_date?->toDateString(),
            'transactionAt' => $this->transaction_at?->format('Y-m-d H:i:s')
                ?? data_get($this->webhook_payload, 'transactionDate'),
            'bankAccount' => $this->bank_account,
            'bankGateway' => data_get($this->webhook_payload, 'gateway'),
            'senderName' => $this->senderName(),
            'transactionContent' => $this->transaction_content,
            'amount' => $this->amount,
            'allocatedAmount' => round((float) $allocatedAmount, 2),
            'refundedAmount' => round((float) $refundedAmount, 2),
            'availableAmount' => round((float) $availableAmount, 2),
            'unallocatedAmount' => round((float) $availableAmount, 2),
            'excessAmount' => round((float) $availableAmount, 2),
            'cumulativeReceived' => $this->cumulative_received,
            'outstandingAfter' => $this->outstanding_after,
            'sequenceNumber' => $this->sequence_no,
            'allocationStatus' => $this->status,
            'allocationCount' => $this->allocation_count ?? $this->allocations?->count() ?? 0,
            'refundCount' => $this->refund_count ?? $this->refunds?->count() ?? 0,
            'collectionTotalAmount' => $this->collection_total_amount,
            'collectionReceivedAmount' => $this->collection_received_amount,
            'collectionOutstandingAmount' => $this->collection_outstanding_amount,
            'collectionExcessAmount' => $this->collection_excess_amount,
            'collectionDifferenceAmount' => $this->collection_difference_amount,
            'collectionStatus' => $this->collection_status,
            'collectionTransactionCount' => $this->collection_transaction_count,
            'customerCodeText' => $this->customer_code_text,
            'isNotified' => $this->is_notified,
            'reconciledStatus' => $this->reconciled_status,
            'status' => $this->status,
            'receiptType' => $this->receipt_type ?? 'customer',
            'matchedAt' => $this->matched_at?->toISOString(),
            'note' => $this->note,
            'reference' => $this->reference,
            'quotation' => $this->whenLoaded('quotation', fn () => $this->quotation ? [
                'id' => $this->quotation->id,
                'quotationCode' => $this->quotation->quotation_code,
                'totalAmount' => $this->quotation->total_amount,
            ] : null),
            'allocations' => $this->whenLoaded('allocations', fn () => $this->allocations->map(
                fn ($allocation): array => [
                    'id' => $allocation->id,
                    'paymentId' => $allocation->payment_id,
                    'quotationId' => $allocation->quotation_id,
                    'customerId' => $allocation->customer_id,
                    'projectId' => $allocation->project_id,
                    'amount' => $allocation->amount,
                    'allocatedAt' => $allocation->allocated_at?->toISOString(),
                    'note' => $allocation->note,
                    'quotation' => $allocation->quotation ? [
                        'id' => $allocation->quotation->id,
                        'quotationCode' => $allocation->quotation->quotation_code,
                        'totalAmount' => $allocation->quotation->total_amount,
                        'customer' => $allocation->quotation->customer ? [
                            'id' => $allocation->quotation->customer->id,
                            'customerCode' => $allocation->quotation->customer->customer_code,
                            'customerName' => $allocation->quotation->customer->customer_name,
                        ] : null,
                        'project' => $allocation->quotation->project ? [
                            'id' => $allocation->quotation->project->id,
                            'projectCode' => $allocation->quotation->project->project_code,
                            'projectName' => $allocation->quotation->project->project_name,
                        ] : null,
                    ] : null,
                ],
            )->values()),
            'refunds' => $this->whenLoaded('refunds', fn () => $this->refunds->map(
                fn ($refund): array => [
                    'id' => $refund->id,
                    'paymentId' => $refund->payment_id,
                    'amount' => $refund->amount,
                    'refundedAt' => $refund->refunded_at?->toISOString(),
                    'recipientName' => $refund->recipient_name,
                    'recipientAccount' => $refund->recipient_account,
                    'reference' => $refund->reference,
                    'note' => $refund->note,
                ],
            )->values()),
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
            'contract' => $this->whenLoaded('contract', fn () => $this->contract ? [
                'id' => $this->contract->id,
                'contractNo' => $this->contract->contract_no,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }

    private function senderName(): ?string
    {
        $senderName = $this->sender_name
            ?? data_get($this->webhook_payload, 'senderName')
            ?? data_get($this->webhook_payload, 'sender_name');

        if (is_string($senderName) && trim($senderName) !== '') {
            return trim($senderName);
        }

        $description = trim((string) data_get($this->webhook_payload, 'description', ''));
        $content = trim((string) ($this->transaction_content ?? data_get($this->webhook_payload, 'content', '')));

        if ($description === '' || QuotationReference::compact($description) === QuotationReference::compact($content)) {
            return null;
        }

        return $description;
    }
}
