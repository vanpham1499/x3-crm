<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerTimelineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'leadId' => $this->lead_id,
            'customerId' => $this->customer_id,
            'projectId' => $this->project_id,
            'type' => $this->type,
            'content' => $this->content,
            'contentData' => $this->decodedContent(),
            'nextActionDate' => $this->next_action_date?->toDateString(),
            'createdBy' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
                'email' => $this->createdBy->email,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }

    private function decodedContent(): mixed
    {
        if (! is_string($this->content) || $this->content === '') {
            return null;
        }

        $decoded = json_decode($this->content, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
    }
}
