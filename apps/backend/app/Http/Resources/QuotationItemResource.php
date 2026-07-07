<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuotationItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'quotationId' => $this->quotation_id,
            'serviceId' => $this->service_id,
            'itemCode' => $this->item_code,
            'itemName' => $this->item_name,
            'description' => $this->description,
            'quantity' => $this->quantity,
            'unitPrice' => $this->unit_price,
            'amountBeforeVat' => $this->amount_before_vat,
            'vatRate' => $this->vat_rate,
            'vatAmount' => $this->vat_amount,
            'amountAfterVat' => $this->amount_after_vat,
            'sortOrder' => $this->sort_order,
            'metadata' => $this->metadata,
            'service' => $this->whenLoaded('service', fn () => $this->service ? new ServiceResource($this->service) : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
