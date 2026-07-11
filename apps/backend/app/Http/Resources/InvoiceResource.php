<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'revenueId' => $this->revenue_id,
            'customerId' => $this->customer_id,
            'invoiceType' => $this->invoice_type,
            'invoiceNo' => $this->invoice_no,
            'issuedDate' => $this->issued_date?->toDateString(),
            'companyName' => $this->company_name,
            'taxCode' => $this->tax_code,
            'address' => $this->address,
            'receiverEmail' => $this->receiver_email,
            'amountBeforeVat' => $this->amount_before_vat,
            'vatAmount' => $this->vat_amount,
            'amountAfterVat' => $this->amount_after_vat,
            'status' => $this->status,
            'fileUrl' => $this->file_url,
            'note' => $this->note,
            'revenue' => $this->whenLoaded('revenue', fn () => $this->revenue ? [
                'id' => $this->revenue->id,
                'revenueCode' => $this->revenue->revenue_code,
                'project' => $this->revenue->relationLoaded('project') && $this->revenue->project ? [
                    'id' => $this->revenue->project->id,
                    'projectCode' => $this->revenue->project->project_code,
                    'projectName' => $this->revenue->project->project_name,
                ] : null,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
