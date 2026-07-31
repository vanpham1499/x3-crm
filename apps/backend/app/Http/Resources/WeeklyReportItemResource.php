<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WeeklyReportItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'weeklyReportId' => $this->weekly_report_id,
            'replyToMessageId' => $this->reply_to_item_id,
            'itemType' => $this->item_type,
            'title' => $this->title,
            'content' => $this->content,
            'priority' => $this->priority,
            'status' => $this->status,
            'dueDate' => $this->due_date?->toDateString(),
            'assigneeUserId' => $this->assignee_user_id,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee ? [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
            ] : null),
            'author' => $this->whenLoaded('createdBy', fn () => $this->createdBy ? [
                'id' => $this->createdBy->id,
                'code' => $this->createdBy->code,
                'name' => $this->createdBy->name,
            ] : null),
            'canUpdate' => (bool) ($request->user()?->can('update', $this->resource) ?? false),
            'canDelete' => (bool) ($request->user()?->can('delete', $this->resource) ?? false),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
