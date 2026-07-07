<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreatePaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'quotation_id' => ['nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'uuid', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'lead_id' => ['nullable', 'uuid', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['nullable', 'uuid', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'uuid', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'uuid', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['nullable', 'uuid', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'contract_id' => ['nullable', 'uuid', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contractId' => ['nullable', 'uuid', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'revenue_id' => ['nullable', 'uuid', Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'revenueId' => ['nullable', 'uuid', Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'transaction_date' => ['required_without:transactionDate', 'date'],
            'transactionDate' => ['required_without:transaction_date', 'date'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'bankAccount' => ['nullable', 'string', 'max:100'],
            'transaction_content' => ['nullable', 'string'],
            'transactionContent' => ['nullable', 'string'],
            'amount' => ['required', 'numeric', 'min:0'],
            'customer_code_text' => ['nullable', 'string', 'max:100'],
            'customerCodeText' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:50'],
            'reconciled_status' => ['nullable', 'string', 'max:50'],
            'reconciledStatus' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string'],
        ];
    }
}
