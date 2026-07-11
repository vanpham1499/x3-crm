<?php

namespace App\Http\Requests\Invoices;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateInvoiceRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'revenue_id' => ['required_without:revenueId', 'integer', Rule::unique('invoices', 'revenue_id')->whereNull('deleted_at'), Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'revenueId' => ['required_without:revenue_id', 'integer', Rule::unique('invoices', 'revenue_id')->whereNull('deleted_at'), Rule::exists('revenues', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'invoice_type' => ['nullable', 'string', 'max:50'],
            'invoiceType' => ['nullable', 'string', 'max:50'],
            'invoice_no' => ['nullable', 'string', 'max:100', Rule::unique('invoices', 'invoice_no')->whereNull('deleted_at')],
            'invoiceNo' => ['nullable', 'string', 'max:100', Rule::unique('invoices', 'invoice_no')->whereNull('deleted_at')],
            'issued_date' => ['nullable', 'date'],
            'issuedDate' => ['nullable', 'date'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'companyName' => ['nullable', 'string', 'max:255'],
            'tax_code' => ['nullable', 'string', 'max:100'],
            'taxCode' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string'],
            'receiver_email' => ['nullable', 'email', 'max:255'],
            'receiverEmail' => ['nullable', 'email', 'max:255'],
            'amount_before_vat' => ['nullable', 'numeric', 'min:0'],
            'amountBeforeVat' => ['nullable', 'numeric', 'min:0'],
            'vat_amount' => ['nullable', 'numeric', 'min:0'],
            'vatAmount' => ['nullable', 'numeric', 'min:0'],
            'amount_after_vat' => ['nullable', 'numeric', 'min:0'],
            'amountAfterVat' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'issued', 'cancelled'])],
            'file_url' => ['nullable', 'string', 'max:2048'],
            'fileUrl' => ['nullable', 'string', 'max:2048'],
            'note' => ['nullable', 'string'],
        ];
    }
}
