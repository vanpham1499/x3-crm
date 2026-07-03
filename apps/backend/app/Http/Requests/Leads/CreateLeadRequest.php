<?php

namespace App\Http\Requests\Leads;

use App\Http\Requests\BaseRequest;
use App\Models\Status;
use Illuminate\Validation\Rule;

class CreateLeadRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'lead_code' => ['nullable', 'string', 'max:50', Rule::unique('leads', 'lead_code')->whereNull('deleted_at')],
            'leadCode' => ['nullable', 'string', 'max:50', Rule::unique('leads', 'lead_code')->whereNull('deleted_at')],
            'customer_name' => ['required_without:customerName', 'string', 'max:255'],
            'customerName' => ['required_without:customer_name', 'string', 'max:255'],
            'status_id' => ['nullable', 'uuid', Rule::exists('statuses', 'id')->where('type', Status::TYPE_LEAD)->whereNull('deleted_at')],
            'statusId' => ['nullable', 'uuid', Rule::exists('statuses', 'id')->where('type', Status::TYPE_LEAD)->whereNull('deleted_at')],
            'occurred_date' => ['nullable', 'date'],
            'occurredDate' => ['nullable', 'date'],
            'assigned_user_id' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'assignedUserId' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'source_id' => ['nullable', 'uuid', Rule::exists('customer_sources', 'id')->whereNull('deleted_at')],
            'sourceId' => ['nullable', 'uuid', Rule::exists('customer_sources', 'id')->whereNull('deleted_at')],
            'interested_service_id' => ['nullable', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'interestedServiceId' => ['nullable', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
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
