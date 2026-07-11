<?php

namespace App\Http\Requests\Leads;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class CreateLeadRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_name' => ['required_without:customerName', 'string', 'max:255'],
            'customerName' => ['required_without:customer_name', 'string', 'max:255'],
            'status_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_STATUS)->whereNull('deleted_at')],
            'occurred_date' => ['nullable', 'date'],
            'occurredDate' => ['nullable', 'date'],
            'assigned_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'assignedUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'source_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'sourceOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SOURCE)->whereNull('deleted_at')],
            'industry_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'industryOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_INDUSTRY)->whereNull('deleted_at')],
            'interested_service_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interested_service_option_ids' => ['nullable', 'array'],
            'interested_service_option_ids.*' => ['integer', 'distinct', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interestedServiceOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interestedServiceOptionIds' => ['nullable', 'array'],
            'interestedServiceOptionIds.*' => ['integer', 'distinct', Rule::exists('options', 'id')->where('group', Option::GROUP_LEAD_SERVICE)->whereNull('deleted_at')],
            'interested_service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'interestedServiceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'interested_service_text' => ['nullable', 'string', 'max:255'],
            'interestedServiceText' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'website' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'plan_link' => ['nullable', 'string'],
            'planLink' => ['nullable', 'string'],
            'zalo_group' => ['nullable', 'string'],
            'zaloGroup' => ['nullable', 'string'],
            'note' => ['nullable', 'string'],
            'closed_date' => ['nullable', 'date'],
            'closedDate' => ['nullable', 'date'],
        ];
    }
}
