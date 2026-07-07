<?php

namespace App\Http\Requests\Projects;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_code' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('projects', 'project_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'projectCode' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('projects', 'project_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'customer_id' => ['sometimes', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['sometimes', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['sometimes', 'nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'service_id' => ['sometimes', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['sometimes', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project_name' => ['sometimes', 'string', 'max:255'],
            'projectName' => ['sometimes', 'string', 'max:255'],
            'status_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'manager_user_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'managerUserId' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'sales_user_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'zalo_group' => ['sometimes', 'nullable', 'string'],
            'zaloGroup' => ['sometimes', 'nullable', 'string'],
            'plan_link' => ['sometimes', 'nullable', 'string'],
            'planLink' => ['sometimes', 'nullable', 'string'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'startDate' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'endDate' => ['sometimes', 'nullable', 'date'],
            'note' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
