<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreatePaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'quotation_id' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'quotationId' => ['nullable', 'integer', Rule::exists('quotations', 'id')->whereNull('deleted_at')],
            'lead_id' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['nullable', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'contract_id' => ['nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contractId' => ['nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'revenue_id' => ['nullable', 'integer', Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'revenueId' => ['nullable', 'integer', Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'transaction_date' => ['required_without_all:transactionDate,transaction_at,transactionAt', 'date'],
            'transactionDate' => ['required_without_all:transaction_date,transaction_at,transactionAt', 'date'],
            'transaction_at' => ['nullable', 'date'],
            'transactionAt' => ['nullable', 'date'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'bankAccount' => ['nullable', 'string', 'max:100'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'senderName' => ['nullable', 'string', 'max:255'],
            'transaction_content' => ['nullable', 'string'],
            'transactionContent' => ['nullable', 'string'],
            'amount' => ['required', 'numeric', 'min:0'],
            'customer_code_text' => ['nullable', 'string', 'max:100'],
            'customerCodeText' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:50'],
            'reconciled_status' => ['nullable', 'string', 'max:50'],
            'reconciledStatus' => ['nullable', 'string', 'max:50'],
            'note' => ['nullable', 'string'],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
