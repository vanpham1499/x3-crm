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
            'invoice_recipient_type' => ['nullable', Rule::in(['customer', 'other'])],
            'invoiceRecipientType' => ['nullable', Rule::in(['customer', 'other'])],
            'invoice_recipient_name' => ['nullable', 'required_if:invoice_recipient_type,other', 'string', 'max:255'],
            'invoiceRecipientName' => ['nullable', 'required_if:invoiceRecipientType,other', 'string', 'max:255'],
            'invoice_representative_name' => ['nullable', 'string', 'max:255'],
            'invoiceRepresentativeName' => ['nullable', 'string', 'max:255'],
            'invoice_tax_code' => ['nullable', 'string', 'max:50'],
            'invoiceTaxCode' => ['nullable', 'string', 'max:50'],
            'invoice_address' => ['nullable', 'string'],
            'invoiceAddress' => ['nullable', 'string'],
            'invoice_email' => ['nullable', 'email', 'max:255'],
            'invoiceEmail' => ['nullable', 'email', 'max:255'],
            'invoice_phone' => ['nullable', 'string', 'max:50'],
            'invoicePhone' => ['nullable', 'string', 'max:50'],
        ];
    }
}
