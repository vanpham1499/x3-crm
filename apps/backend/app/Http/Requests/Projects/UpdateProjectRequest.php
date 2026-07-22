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
            'customer_id' => ['sometimes', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['sometimes', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['sometimes', 'nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['sometimes', 'nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'service_id' => ['sometimes', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['sometimes', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project_name' => ['sometimes', 'string', 'max:255'],
            'projectName' => ['sometimes', 'string', 'max:255'],
            'project_type' => ['sometimes', Rule::in(['K', 'M', 'N'])],
            'projectType' => ['sometimes', Rule::in(['K', 'M', 'N'])],
            'status_option_id' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['sometimes', 'nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'manager_user_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'managerUserId' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'sales_user_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'report_weekday' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:7'],
            'reportWeekday' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:7'],
            'zalo_group' => ['sometimes', 'nullable', 'string'],
            'zaloGroup' => ['sometimes', 'nullable', 'string'],
            'plan_link' => ['sometimes', 'nullable', 'string'],
            'planLink' => ['sometimes', 'nullable', 'string'],
            'weekly_report_link' => ['sometimes', 'nullable', 'string'],
            'weeklyReportLink' => ['sometimes', 'nullable', 'string'],
            'customer_tracking_report_link' => ['sometimes', 'nullable', 'string'],
            'customerTrackingReportLink' => ['sometimes', 'nullable', 'string'],
            'admin_web_account' => ['sometimes', 'nullable', 'string'],
            'adminWebAccount' => ['sometimes', 'nullable', 'string'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'startDate' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'endDate' => ['sometimes', 'nullable', 'date'],
            'note' => ['sometimes', 'nullable', 'string'],
            'contract' => ['sometimes', 'nullable', 'array'],
            'contract.id' => ['nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contract.contract_no' => ['nullable', 'string', 'max:100'],
            'contract.contractNo' => ['nullable', 'string', 'max:100'],
            'contract.contract_status_id' => ['nullable', 'integer'],
            'contract.contractStatusId' => ['nullable', 'integer'],
            'contract.contract_status_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->whereNull('deleted_at')],
            'contract.contractStatusOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->whereNull('deleted_at')],
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
