<?php

namespace App\Http\Requests\Leads;

use App\Http\Requests\BaseRequest;
use App\Models\Status;
use Illuminate\Validation\Rule;

class UpdateLeadRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'lead_code' => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('leads', 'lead_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'leadCode' => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('leads', 'lead_code')->ignore($this->route('id'))->whereNull('deleted_at')],
            'customer_name' => ['sometimes', 'string', 'max:255'],
            'customerName' => ['sometimes', 'string', 'max:255'],
            'status_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('statuses', 'id')->where('type', Status::TYPE_LEAD)->whereNull('deleted_at')],
            'statusId' => ['sometimes', 'nullable', 'uuid', Rule::exists('statuses', 'id')->where('type', Status::TYPE_LEAD)->whereNull('deleted_at')],
            'occurred_date' => ['sometimes', 'nullable', 'date'],
            'occurredDate' => ['sometimes', 'nullable', 'date'],
            'assigned_user_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'assignedUserId' => ['sometimes', 'nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'source_id' => ['sometimes', 'nullable', 'uuid', Rule::exists('customer_sources', 'id')->whereNull('deleted_at')],
            'sourceId' => ['sometimes', 'nullable', 'uuid', Rule::exists('customer_sources', 'id')->whereNull('deleted_at')],
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
