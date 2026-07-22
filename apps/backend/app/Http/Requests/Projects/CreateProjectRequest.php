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
            'customer_id' => ['required_without:customerId', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['required_without:customer_id', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'service_id' => ['required_without:serviceId', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['required_without:service_id', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project_name' => ['required_without:projectName', 'string', 'max:255'],
            'projectName' => ['required_without:project_name', 'string', 'max:255'],
            'project_type' => ['nullable', Rule::in(['K', 'M', 'N'])],
            'projectType' => ['nullable', Rule::in(['K', 'M', 'N'])],
            'status_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'statusOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->where('group', Option::GROUP_PROJECT_STATUS)->whereNull('deleted_at')],
            'manager_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'managerUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'sales_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'salesUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'report_weekday' => ['nullable', 'integer', 'min:1', 'max:7'],
            'reportWeekday' => ['nullable', 'integer', 'min:1', 'max:7'],
            'zalo_group' => ['nullable', 'string'],
            'zaloGroup' => ['nullable', 'string'],
            'plan_link' => ['nullable', 'string'],
            'planLink' => ['nullable', 'string'],
            'weekly_report_link' => ['nullable', 'string'],
            'weeklyReportLink' => ['nullable', 'string'],
            'customer_tracking_report_link' => ['nullable', 'string'],
            'customerTrackingReportLink' => ['nullable', 'string'],
            'admin_web_account' => ['nullable', 'string'],
            'adminWebAccount' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'startDate' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'endDate' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'contract' => ['nullable', 'array'],
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
