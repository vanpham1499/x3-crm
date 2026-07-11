<?php

namespace App\Http\Requests\Invoices;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateInvoiceRequest extends BaseRequest
{
    public function rules(): array
    {
        $invoiceId = $this->route('id');

        return [
            'customer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'invoice_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'invoiceType' => ['sometimes', 'nullable', 'string', 'max:50'],
            'invoice_no' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('invoices', 'invoice_no')->ignore($invoiceId)->whereNull('deleted_at')],
            'invoiceNo' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('invoices', 'invoice_no')->ignore($invoiceId)->whereNull('deleted_at')],
            'issued_date' => ['sometimes', 'nullable', 'date'],
            'issuedDate' => ['sometimes', 'nullable', 'date'],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'companyName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tax_code' => ['sometimes', 'nullable', 'string', 'max:100'],
            'taxCode' => ['sometimes', 'nullable', 'string', 'max:100'],
            'address' => ['sometimes', 'nullable', 'string'],
            'receiver_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'receiverEmail' => ['sometimes', 'nullable', 'email', 'max:255'],
            'amount_before_vat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amountBeforeVat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vatAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amount_after_vat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'amountAfterVat' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'status' => ['sometimes', 'nullable', 'string', Rule::in(['draft', 'issued', 'cancelled'])],
            'file_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'fileUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'note' => ['sometimes', 'nullable', 'string'],
        ];
    }
}
