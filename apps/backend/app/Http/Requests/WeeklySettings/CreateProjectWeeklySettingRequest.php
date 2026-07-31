<?php

namespace App\Http\Requests\WeeklySettings;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateProjectWeeklySettingRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['required_without:projectId', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['required_without:project_id', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'report_owner_user_id' => ['required_without:reportOwnerUserId', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'reportOwnerUserId' => ['required_without:report_owner_user_id', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'report_weekday' => ['nullable', 'integer', Rule::in([1, 2, 3, 4, 5])],
            'reportWeekday' => ['nullable', 'integer', Rule::in([1, 2, 3, 4, 5])],
            'monthly_budget' => ['nullable', 'numeric', 'min:0'],
            'monthlyBudget' => ['nullable', 'numeric', 'min:0'],
            'management_fee_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'managementFeeRate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'isActive' => ['nullable', 'boolean'],
        ];
    }
}
