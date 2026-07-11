<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RevenueItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'revenueId' => $this->revenue_id,
            'serviceId' => $this->service_id,
            'servicePackageId' => $this->service_package_id,
            'itemName' => $this->item_name,
            'quantity' => $this->quantity,
            'unit' => $this->unit,
            'unitPrice' => $this->unit_price,
            'amount' => $this->amount,
            'note' => $this->note,
            'service' => $this->whenLoaded('service', fn () => $this->service ? [
                'id' => $this->service->id,
                'code' => $this->service->code,
                'name' => $this->service->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
