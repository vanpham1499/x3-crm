<?php

namespace App\Http\Requests\Services;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateServiceRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'parent_id' => ['sometimes', 'nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'parentId' => ['sometimes', 'nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'code' => ['sometimes', 'string', 'max:20'],
            'name' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'nullable', 'string'],
            'invoice_content' => ['sometimes', 'nullable', 'string'],
            'invoiceContent' => ['sometimes', 'nullable', 'string'],
            'invoice_timing' => ['sometimes', 'nullable', 'string'],
            'invoiceTiming' => ['sometimes', 'nullable', 'string'],
            'description' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'sortOrder' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'unit' => ['sometimes', 'nullable', 'string', 'max:50'],
            'default_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'defaultPrice' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'nullable', 'boolean'],
            'isActive' => ['sometimes', 'nullable', 'boolean'],
        ];
    }
}
