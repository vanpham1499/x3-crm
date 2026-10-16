<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actionUrl = $this->action_url;
        if ($this->event_key === 'weekly_report_message'
            && preg_match('/^weekly_report_message:(\d+)$/', (string) $this->dedupe_key, $match)) {
            $actionUrl = '/weekly-reports/'.$this->entity_id.'#message-'.$match[1];
        }
        return [
            'id' => $this->id,
            'module' => $this->event_key === 'weekly_report_message' ? 'internal_discussion' : $this->module,
            'eventKey' => $this->event_key,
            'title' => $this->title,
            'message' => $this->message,
            'kind' => $this->kind,
            'severity' => $this->severity,
            'entityType' => $this->entity_type,
            'entityId' => $this->entity_id,
            'actionUrl' => $actionUrl,
            'data' => $this->data ?? [],
            'readAt' => $this->read_at?->toISOString(),
            'resolvedAt' => $this->resolved_at?->toISOString(),
            'archivedAt' => $this->archived_at?->toISOString(),
            'handledAt' => $this->handled_at?->toISOString(),
            'isDone' => $this->resource->inboxIsDone(),
            'doneSource' => ! $this->resource->inboxIsDone() ? null : ($this->handled_at ? 'manual' : ($this->archived_at ? 'legacy_archive' : 'workflow')),
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
