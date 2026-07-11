<?php

namespace App\Http\Resources;

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
            'revenueId' => $this->revenue_id,
            'transactionDate' => $this->transaction_date?->toDateString(),
            'bankAccount' => $this->bank_account,
            'transactionContent' => $this->transaction_content,
            'amount' => $this->amount,
            'customerCodeText' => $this->customer_code_text,
            'isNotified' => $this->is_notified,
            'reconciledStatus' => $this->reconciled_status,
            'status' => $this->status,
            'matchedAt' => $this->matched_at?->toISOString(),
            'note' => $this->note,
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
            'revenue' => $this->whenLoaded('revenue', fn () => $this->revenue ? [
                'id' => $this->revenue->id,
                'revenueCode' => $this->revenue->revenue_code,
                'amountAfterVat' => $this->revenue->amount_after_vat,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
