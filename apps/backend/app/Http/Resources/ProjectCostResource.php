<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectCostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectId' => $this->project_id,
            'quotationId' => $this->quotation_id,
            'entryType' => $this->entry_type,
            'transactionDate' => $this->transaction_date?->toDateString(),
            'status' => $this->status,
            'cid' => $this->cid,
            'adAccount' => $this->ad_account,
            'cidIsDead' => (bool) $this->cid_is_dead,
            'cidSpentAmount' => $this->cid_spent_amount,
            'bankAccountOptionId' => $this->bank_account_option_id,
            'partnerOptionId' => $this->partner_option_id,
            'amountBeforeVat' => $this->amount_before_vat,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'discountAmount' => $this->discount_amount,
            'totalAmount' => $this->total_amount,
            'acceptanceStatus' => $this->acceptance_status,
            'inputInvoiceStatus' => $this->input_invoice_status,
            'invoiceNumber' => $this->invoice_number,
            'reconciliationResult' => $this->reconciliation_result,
            'invoiceStatus' => $this->invoice_status,
            'invoiceRecipientType' => $this->invoice_recipient_type,
            'invoiceRecipientName' => $this->invoice_recipient_name,
            'reconciliationNote' => $this->reconciliation_note,
            'cashOutAmount' => $this->cashOutAmount(),
            'actualCostAmount' => $this->actualCostAmount(),
            'originalBalanceAmount' => $this->originalBalanceAmount(),
            'handledBalanceAmount' => $this->handledBalanceAmount(),
            'releasedBalanceAmount' => $this->handledBalanceAmount(),
            'remainingBalanceAmount' => $this->remainingBalanceAmount(),
            'realizedCostAmount' => $this->realizedCostAmount(),
            'balanceStatus' => $this->balanceStatus(),
            'note' => $this->note,
            'reconciledAt' => $this->reconciled_at?->toISOString(),
            'reconciledBy' => $this->whenLoaded('reconciledBy', fn () => $this->reconciledBy ? [
                'id' => $this->reconciledBy->id,
                'code' => $this->reconciledBy->code,
                'name' => $this->reconciledBy->name,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'projectType' => $this->project->project_type,
                'customer' => $this->project->relationLoaded('customer') && $this->project->customer ? [
                    'id' => $this->project->customer->id,
                    'customerCode' => $this->project->customer->customer_code,
                    'customerName' => $this->project->customer->customer_name,
                ] : null,
            ] : null),
            'quotation' => $this->whenLoaded('quotation', fn () => $this->quotation ? [
                'id' => $this->quotation->id,
                'quotationCode' => $this->quotation->quotation_code,
            ] : null),
            'bankAccountOption' => $this->whenLoaded('bankAccountOption', fn () => $this->bankAccountOption ? new OptionResource($this->bankAccountOption) : null),
            'partnerOption' => $this->whenLoaded('partnerOption', fn () => $this->partnerOption ? new OptionResource($this->partnerOption) : null),
            'adjustments' => $this->whenLoaded('adjustments', fn () => $this->adjustments->map(fn ($adjustment) => [
                'id' => $adjustment->id,
                'adjustmentType' => $adjustment->adjustment_type,
                'status' => $adjustment->status,
                'amount' => $adjustment->amount,
                'reference' => $adjustment->reference,
                'note' => $adjustment->note,
                'createdAt' => $adjustment->created_at?->toISOString(),
                'updatedAt' => $adjustment->updated_at?->toISOString(),
            ])->values()),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
