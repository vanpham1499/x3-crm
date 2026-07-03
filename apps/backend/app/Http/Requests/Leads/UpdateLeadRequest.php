<?php

namespace App\Http\Requests\Leads;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class UpdateLeadRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customerName' => ['sometimes', 'string', 'max:255'],
            'status_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_STATUS)->whereNull('deleted_at')],
            'occurred_date' => ['sometimes', 'nullable', 'date'],
            'occurredDate' => ['sometimes', 'nullable', 'date'],
            'assigned_user_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'assignedUserId' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'source_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sourceOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'industry_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'industryOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'interested_service_option_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interested_service_option_ids' => ['sometimes', 'nullable', 'array'],
            'interested_service_option_ids.*' => ['uuid', 'distinct', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interestedServiceOptionId' => ['sometimes', 'nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interestedServiceOptionIds' => ['sometimes', 'nullable', 'array'],
            'interestedServiceOptionIds.*' => ['uuid', 'distinct', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interested_service_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'interestedServiceId' => ['sometimes', 'nullable', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'interested_service_text' => ['sometimes', 'nullable', 'string', 'max:255'],
            'interestedServiceText' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:255'],
            'plan_link' => ['sometimes', 'nullable', 'string'],
            'planLink' => ['sometimes', 'nullable', 'string'],
            'zalo_group' => ['sometimes', 'nullable', 'string'],
            'zaloGroup' => ['sometimes', 'nullable', 'string'],
            'note' => ['sometimes', 'nullable', 'string'],
            'closed_date' => ['sometimes', 'nullable', 'date'],
            'closedDate' => ['sometimes', 'nullable', 'date'],
            'converted_customer_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'convertedCustomerId' => ['sometimes', 'nullable', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
        ];
    }
}
