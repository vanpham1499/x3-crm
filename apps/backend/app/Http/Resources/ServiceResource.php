<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parentId' => $this->parent_id,
            'code' => $this->code,
            'name' => $this->name,
            'content' => $this->content,
            'invoiceContent' => $this->invoice_content,
            'invoiceTiming' => $this->invoice_timing,
            'description' => $this->description,
            'level' => $this->level,
            'sortOrder' => $this->sort_order,
            'isActive' => (bool) $this->is_active,
            'parent' => $this->whenLoaded('parent', fn () => $this->parent ? [
                'id' => $this->parent->id,
                'code' => $this->parent->code,
                'name' => $this->parent->name,
            ] : null),
            'children' => ServiceResource::collection($this->whenLoaded('childrenRecursive'))->resolve(),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
