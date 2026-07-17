<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class KpiPointResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'userId' => $this->user_id,
            'projectId' => $this->project_id,
            'entryDate' => $this->entry_date?->toDateString(),
            'category' => $this->category,
            'categoryLabel' => $this->categoryOption?->label ?: $this->category,
            'type' => $this->type,
            'score' => $this->score,
            'customerRef' => $this->customer_ref,
            'note' => $this->note,
            'isApproved' => (bool) $this->is_approved,
            'approvedBy' => $this->approved_by,
            'approvedAt' => $this->approved_at?->toISOString(),
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'code' => $this->user->code,
                'name' => $this->user->name,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
            ] : null),
            'approver' => $this->whenLoaded('approver', fn () => $this->approver ? [
                'id' => $this->approver->id,
                'name' => $this->approver->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
