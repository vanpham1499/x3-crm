<?php

namespace App\Http\Requests\Leads;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class ConvertLeadRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'quotation_id' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'customer' => ['nullable', 'array'],
            'customer.customer_name' => ['nullable', 'string', 'max:255'],
            'customer.customerName' => ['nullable', 'string', 'max:255'],
            'customer.phone' => ['nullable', 'string', 'max:50'],
            'customer.email' => ['nullable', 'email', 'max:255'],
            'customer.website' => ['nullable', 'string', 'max:255'],
            'customer.note' => ['nullable', 'string'],
            'project' => ['nullable', 'array'],
            'project.project_name' => ['nullable', 'string', 'max:255'],
            'project.projectName' => ['nullable', 'string', 'max:255'],
            'project.service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project.serviceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'project.manager_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'project.managerUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'project.sales_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'project.salesUserId' => ['nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'project.start_date' => ['nullable', 'date'],
            'project.startDate' => ['nullable', 'date'],
            'project.end_date' => ['nullable', 'date'],
            'project.endDate' => ['nullable', 'date'],
            'project.note' => ['nullable', 'string'],
            'contract' => ['nullable', 'array'],
            'contract.contract_no' => ['nullable', 'string', 'max:100'],
            'contract.contractNo' => ['nullable', 'string', 'max:100'],
            'contract.deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'contract.depositAmount' => ['nullable', 'numeric', 'min:0'],
            'contract.signed_date' => ['nullable', 'date'],
            'contract.signedDate' => ['nullable', 'date'],
            'contract.expired_date' => ['nullable', 'date'],
            'contract.expiredDate' => ['nullable', 'date'],
            'contract.contract_month' => ['nullable', 'string', 'max:20'],
            'contract.contractMonth' => ['nullable', 'string', 'max:20'],
            'contract.note' => ['nullable', 'string'],
        ];
    }
}
