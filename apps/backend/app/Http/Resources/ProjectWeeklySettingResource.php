<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectWeeklySettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectId' => $this->project_id,
            'reportOwnerUserId' => $this->report_owner_user_id,
            'reportWeekday' => $this->report_weekday,
            'monthlyBudget' => $this->monthly_budget,
            'managementFeeRate' => $this->management_fee_rate,
            'isActive' => (bool) $this->is_active,
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
            ] : null),
            'reportOwner' => $this->whenLoaded('reportOwner', fn () => $this->reportOwner ? [
                'id' => $this->reportOwner->id,
                'code' => $this->reportOwner->code,
                'name' => $this->reportOwner->name,
            ] : null),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
