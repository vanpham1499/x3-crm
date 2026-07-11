<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RevenueResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectId' => $this->project_id,
            'revenueCode' => $this->revenue_code,
            'revenueType' => $this->revenue_type,
            'reportedDate' => $this->reported_date?->toDateString(),
            'paymentDueDate' => $this->payment_due_date?->toDateString(),
            'paidDate' => $this->paid_date?->toDateString(),
            'revenueMonth' => $this->revenue_month?->toDateString(),
            'amountBeforeVat' => $this->amount_before_vat,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'amountAfterVat' => $this->amount_after_vat,
            'actualReceivedAmount' => $this->actual_received_amount,
            'paymentStatus' => $this->payment_status,
            'invoiceStatus' => $this->invoice_status,
            'note' => $this->note,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'customer' => $this->project->relationLoaded('customer') && $this->project->customer ? [
                    'id' => $this->project->customer->id,
                    'customerCode' => $this->project->customer->customer_code,
                    'customerName' => $this->project->customer->customer_name,
                ] : null,
            ] : null),
            'items' => RevenueItemResource::collection($this->whenLoaded('items')),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
