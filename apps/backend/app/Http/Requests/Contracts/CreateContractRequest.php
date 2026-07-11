<?php

namespace App\Http\Requests\Contracts;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateContractRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'project_id' => ['required_without:projectId', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['required_without:project_id', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'quotation_id' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'contract_no' => ['nullable', 'string', 'max:100'],
            'contractNo' => ['nullable', 'string', 'max:100'],
            'contract_status_id' => ['nullable', 'integer'],
            'contractStatusId' => ['nullable', 'integer'],
            'contract_status_option_id' => ['nullable', 'integer', Rule::exists('options', 'id')->whereNull('deleted_at')],
            'contractStatusOptionId' => ['nullable', 'integer', Rule::exists('options', 'id')->whereNull('deleted_at')],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'depositAmount' => ['nullable', 'numeric', 'min:0'],
            'signed_date' => ['nullable', 'date'],
            'signedDate' => ['nullable', 'date'],
            'expired_date' => ['nullable', 'date'],
            'expiredDate' => ['nullable', 'date'],
            'contract_month' => ['nullable', 'string', 'max:20'],
            'contractMonth' => ['nullable', 'string', 'max:20'],
            'file_url' => ['nullable', 'string'],
            'fileUrl' => ['nullable', 'string'],
            'note' => ['nullable', 'string'],
        ];
    }
}
