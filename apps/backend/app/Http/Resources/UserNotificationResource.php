<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'module' => $this->module,
            'eventKey' => $this->event_key,
            'title' => $this->title,
            'message' => $this->message,
            'kind' => $this->kind,
            'severity' => $this->severity,
            'entityType' => $this->entity_type,
            'entityId' => $this->entity_id,
            'actionUrl' => $this->action_url,
            'data' => $this->data ?? [],
            'readAt' => $this->read_at?->toISOString(),
            'resolvedAt' => $this->resolved_at?->toISOString(),
            'archivedAt' => $this->archived_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'isRead' => $this->read_at !== null,
            'isResolved' => $this->resolved_at !== null,
            'actor' => $this->whenLoaded('actor', fn () => $this->actor ? [
                'id' => $this->actor->id,
                'code' => $this->actor->code,
                'name' => $this->actor->name,
            ] : null),
        ];
    }
}
