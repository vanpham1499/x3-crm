<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WeeklyReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'projectId' => $this->project_id,
            'customerId' => $this->customer_id,
            'reporterUserId' => $this->reporter_user_id,
            'weekStartDate' => $this->week_start_date?->toDateString(),
            'weekEndDate' => $this->week_end_date?->toDateString(),
            'reportDate' => $this->report_date?->toDateString(),
            'projectStatus' => $this->project_status,
            'weeklyCondition' => $this->weekly_condition,
            'status' => $this->status,
            'monthlyBudget' => $this->monthly_budget,
            'managementFeeRate' => $this->management_fee_rate,
            'problemSolution' => $this->problem_solution,
            'summary' => $this->summary,
            'nextAction' => $this->next_action,
            'submittedAt' => $this->submitted_at?->toISOString(),
            'approvedBy' => $this->approved_by,
            'approvedAt' => $this->approved_at?->toISOString(),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'customerCode' => $this->customer->customer_code,
                'customerName' => $this->customer->customer_name,
            ] : null),
            'reporter' => $this->whenLoaded('reporter', fn () => $this->reporter ? [
                'id' => $this->reporter->id,
                'code' => $this->reporter->code,
                'name' => $this->reporter->name,
            ] : null),
            'approver' => $this->whenLoaded('approver', fn () => $this->approver ? [
                'id' => $this->approver->id,
                'name' => $this->approver->name,
            ] : null),
            'items' => WeeklyReportItemResource::collection($this->whenLoaded('items')),
            'attachments' => WeeklyReportAttachmentResource::collection($this->whenLoaded('attachments')),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
