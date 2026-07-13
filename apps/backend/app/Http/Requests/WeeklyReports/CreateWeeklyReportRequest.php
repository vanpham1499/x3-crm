<?php

namespace App\Http\Requests\WeeklyReports;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateWeeklyReportRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['required_without:projectId', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['required_without:project_id', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'reporter_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'reporterUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'week_start_date' => ['required_without:weekStartDate', 'date'],
            'weekStartDate' => ['required_without:week_start_date', 'date'],
            'week_end_date' => ['required_without:weekEndDate', 'date'],
            'weekEndDate' => ['required_without:week_end_date', 'date'],
            'report_date' => ['nullable', 'date'],
            'reportDate' => ['nullable', 'date'],
            'project_status' => ['required_without:projectStatus', 'string', 'max:50'],
            'projectStatus' => ['required_without:project_status', 'string', 'max:50'],
            'weekly_condition' => ['nullable', 'string', 'max:50'],
            'weeklyCondition' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:50'],
            'monthly_budget' => ['nullable', 'numeric', 'min:0'],
            'monthlyBudget' => ['nullable', 'numeric', 'min:0'],
            'management_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'managementFeeRate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'problem_solution' => ['nullable', 'string'],
            'problemSolution' => ['nullable', 'string'],
            'summary' => ['nullable', 'string'],
            'next_action' => ['nullable', 'string'],
            'nextAction' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.item_type' => ['nullable', 'string', 'max:50'],
            'items.*.itemType' => ['nullable', 'string', 'max:50'],
            'items.*.title' => ['nullable', 'string', 'max:255'],
            'items.*.content' => ['required_with:items', 'string'],
            'items.*.priority' => ['nullable', 'string', 'max:30'],
            'items.*.status' => ['nullable', 'string', 'max:30'],
            'items.*.due_date' => ['nullable', 'date'],
            'items.*.dueDate' => ['nullable', 'date'],
            'items.*.assignee_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'items.*.assigneeUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
        ];
    }
}
