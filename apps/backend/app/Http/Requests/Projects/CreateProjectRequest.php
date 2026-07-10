<?php

namespace App\Http\Requests\Projects;

use App\Http\Requests\BaseRequest;
use App\Models\Option;
use Illuminate\Validation\Rule;

class CreateProjectRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_code' => ['nullable', 'string', 'max:100'],
            'projectCode' => ['nullable', 'string', 'max:100'],
            'customer_id' => ['required_without:customerId', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['required_without:customer_id', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'service_id' => ['required_without:serviceId', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['required_without:service_id', 'uuid', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project_name' => ['required_without:projectName', 'string', 'max:255'],
            'projectName' => ['required_without:project_name', 'string', 'max:255'],
            'status_option_id' => ['nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['nullable', 'uuid', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'manager_user_id' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'managerUserId' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'sales_user_id' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['nullable', 'uuid', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'zalo_group' => ['nullable', 'string'],
            'zaloGroup' => ['nullable', 'string'],
            'plan_link' => ['nullable', 'string'],
            'planLink' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'startDate' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'endDate' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'contract' => ['nullable', 'array'],
            'contract.id' => ['nullable', 'uuid', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contract.contract_no' => ['nullable', 'string', 'max:100'],
            'contract.contractNo' => ['nullable', 'string', 'max:100'],
            'contract.contract_status_id' => ['nullable', 'uuid', Rule::exists('statuses', 'id')->whereNull('deleted_at')],
            'contract.contractStatusId' => ['nullable', 'uuid', Rule::exists('statuses', 'id')->whereNull('deleted_at')],
            'contract.contractStatusOptionId' => ['nullable', 'string', 'max:100'],
            'contract.deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'contract.depositAmount' => ['nullable', 'numeric', 'min:0'],
            'contract.signed_date' => ['nullable', 'date'],
            'contract.signedDate' => ['nullable', 'date'],
            'contract.expired_date' => ['nullable', 'date'],
            'contract.expiredDate' => ['nullable', 'date'],
            'contract.contract_month' => ['nullable', 'string', 'max:20'],
            'contract.contractMonth' => ['nullable', 'string', 'max:20'],
            'contract.file_url' => ['nullable', 'string'],
            'contract.fileUrl' => ['nullable', 'string'],
            'contract.note' => ['nullable', 'string'],
        ];
    }
}
