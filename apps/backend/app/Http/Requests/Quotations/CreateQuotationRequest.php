<?php

namespace App\Http\Requests\Quotations;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateQuotationRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'quotation_code' => ['nullable', 'string', 'max:120', Rule::unique('quotations', 'quotation_code')->whereNull('deleted_at')],
            'quotationCode' => ['nullable', 'string', 'max:120', Rule::unique('quotations', 'quotation_code')->whereNull('deleted_at')],
            'lead_id' => ['required_without:leadId', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'leadId' => ['required_without:lead_id', 'integer', Rule::exists('leads', 'id')->whereNull('deleted_at')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'contract_id' => ['nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contractId' => ['nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'service_code' => ['nullable', 'string', 'max:80'],
            'serviceCode' => ['nullable', 'string', 'max:80'],
            'service_name' => ['nullable', 'string', 'max:255'],
            'serviceName' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'subtotal_amount' => ['nullable', 'numeric', 'min:0'],
            'subtotalAmount' => ['nullable', 'numeric', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0'],
            'vatRate' => ['nullable', 'numeric', 'min:0'],
            'vat_amount' => ['nullable', 'numeric', 'min:0'],
            'vatAmount' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'totalAmount' => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'depositAmount' => ['nullable', 'numeric', 'min:0'],
            'valid_until' => ['nullable', 'date'],
            'validUntil' => ['nullable', 'date'],
            'note' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
            'items' => ['nullable', 'array'],
            'items.*.service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.serviceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.item_code' => ['nullable', 'string', 'max:100'],
            'items.*.itemCode' => ['nullable', 'string', 'max:100'],
            'items.*.item_name' => ['required_with:items', 'string', 'max:255'],
            'items.*.itemName' => ['required_with:items', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.unitPrice' => ['nullable', 'numeric', 'min:0'],
            'items.*.amount_before_vat' => ['nullable', 'numeric', 'min:0'],
            'items.*.amountBeforeVat' => ['nullable', 'numeric', 'min:0'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.vatRate' => ['nullable', 'numeric', 'min:0'],
            'items.*.vat_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.vatAmount' => ['nullable', 'numeric', 'min:0'],
            'items.*.amount_after_vat' => ['nullable', 'numeric', 'min:0'],
            'items.*.amountAfterVat' => ['nullable', 'numeric', 'min:0'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'items.*.sortOrder' => ['nullable', 'integer', 'min:0'],
            'items.*.metadata' => ['nullable', 'array'],
        ];
    }
}
