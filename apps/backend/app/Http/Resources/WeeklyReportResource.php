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
            'dueDate' => $this->week_end_date?->copy()->addDay()->toDateString(),
            'reportDate' => $this->report_date?->toDateString(),
            'projectStatus' => $this->project_status,
            'weeklyCondition' => $this->weekly_condition,
            'status' => $this->status,
            'currency' => $this->currency ?: 'VND',
            'weeklySpendAmount' => $this->weekly_spend_amount,
            'averageWeeklyBudget' => $this->average_weekly_budget,
            'remainingAccountBudget' => $this->remaining_account_budget,
            'totalBudget' => $this->total_budget,
            'monthlyBudget' => $this->monthly_budget,
            'managementFeeRate' => $this->management_fee_rate,
            'problemSolution' => $this->problem_solution,
            'summary' => $this->summary,
            'nextAction' => $this->next_action,
            'submittedAt' => $this->submitted_at?->toISOString(),
            'approvedBy' => $this->approved_by,
            'approvedAt' => $this->approved_at?->toISOString(),
            'rejectionReason' => $this->rejection_reason,
            'rejectedBy' => $this->rejected_by,
            'rejectedAt' => $this->rejected_at?->toISOString(),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'projectCode' => $this->project->project_code,
                'projectName' => $this->project->project_name,
                'managerUserId' => $this->project->manager_user_id,
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
                'departmentId' => $this->reporter->department_id,
                'teamId' => $this->reporter->team_id,
            ] : null),
            'approver' => $this->whenLoaded('approver', fn () => $this->approver ? [
                'id' => $this->approver->id,
                'code' => $this->approver->code,
                'name' => $this->approver->name,
            ] : null),
            'rejecter' => $this->whenLoaded('rejecter', fn () => $this->rejecter ? [
                'id' => $this->rejecter->id,
                'code' => $this->rejecter->code,
                'name' => $this->rejecter->name,
            ] : null),
            'items' => WeeklyReportItemResource::collection($this->whenLoaded('items')),
            'attachments' => WeeklyReportAttachmentResource::collection($this->whenLoaded('attachments')),
            'canUpdate' => (bool) ($request->user()?->can('update', $this->resource) ?? false),
            'canDelete' => (bool) ($request->user()?->can('delete', $this->resource) ?? false),
            'canApprove' => (bool) ($request->user()?->can('approve', $this->resource) ?? false),
            'canComment' => (bool) ($request->user()?->can('comment', $this->resource) ?? false),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
