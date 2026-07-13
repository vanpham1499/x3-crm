<?php

namespace App\Http\Resources;

use App\Support\QuotationReference;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
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
            'customerCodeText' => $this->customer_code_text,
            'isNotified' => $this->is_notified,
            'reconciledStatus' => $this->reconciled_status,
            'status' => $this->status,
            'matchedAt' => $this->matched_at?->toISOString(),
            'note' => $this->note,
            'reference' => $this->reference,
            'quotation' => $this->whenLoaded('quotation', fn () => $this->quotation ? [
                'id' => $this->quotation->id,
                'quotationCode' => $this->quotation->quotation_code,
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
