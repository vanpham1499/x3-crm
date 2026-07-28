<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class KpiTargetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'period' => $this->period_month?->format('Y-m'),
            'scopeType' => $this->scope_type,
            'scopeId' => (int) $this->scope_id,
            'targetAmount' => (float) $this->target_amount,
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
