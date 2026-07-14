<?php

namespace App\Http\Requests\Quotations;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateQuotationRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['sometimes', 'nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'contract_id' => ['sometimes', 'nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'contractId' => ['sometimes', 'nullable', 'integer', Rule::exists('contracts', 'id')->whereNull('deleted_at')],
            'service_id' => ['sometimes', 'nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'serviceId' => ['sometimes', 'nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'service_code' => ['sometimes', 'nullable', 'string', 'max:80'],
            'serviceCode' => ['sometimes', 'nullable', 'string', 'max:80'],
            'service_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'serviceName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'subtotal_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'subtotalAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vat_rate' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vatRate' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vat_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'vatAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'total_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'totalAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'depositAmount' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'valid_until' => ['sometimes', 'nullable', 'date'],
            'validUntil' => ['sometimes', 'nullable', 'date'],
            'note' => ['sometimes', 'nullable', 'string'],
            'metadata' => ['sometimes', 'nullable', 'array'],
            'items' => ['sometimes', 'nullable', 'array'],
            'items.*.service_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.serviceId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'items.*.item_code' => ['nullable', 'string', 'max:100'],
            'items.*.itemCode' => ['nullable', 'string', 'max:100'],
            'items.*.item_name' => ['required_with:items', 'string', 'max:255'],
            'items.*.itemName' => ['required_with:items', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_price' => ['nullable', 'numeric'],
            'items.*.unitPrice' => ['nullable', 'numeric'],
            'items.*.amount_before_vat' => ['nullable', 'numeric'],
            'items.*.amountBeforeVat' => ['nullable', 'numeric'],
            'items.*.vat_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.vatRate' => ['nullable', 'numeric', 'min:0'],
            'items.*.vat_amount' => ['nullable', 'numeric'],
            'items.*.vatAmount' => ['nullable', 'numeric'],
            'items.*.amount_after_vat' => ['nullable', 'numeric'],
            'items.*.amountAfterVat' => ['nullable', 'numeric'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'items.*.sortOrder' => ['nullable', 'integer', 'min:0'],
            'items.*.metadata' => ['nullable', 'array'],
        ];
    }
}
