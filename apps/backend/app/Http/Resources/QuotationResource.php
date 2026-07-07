<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuotationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quotationCode' => $this->quotation_code,
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
            'depositAmount' => $this->deposit_amount,
            'validUntil' => $this->valid_until?->toDateString(),
            'note' => $this->note,
            'metadata' => $this->metadata,
            'lead' => $this->whenLoaded('lead', fn () => $this->lead ? [
                'id' => $this->lead->id,
                'leadCode' => $this->lead->lead_code,
                'customerName' => $this->lead->customer_name,
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
}
