<?php

namespace App\Http\Requests\Services;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class CreateServiceRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'parent_id' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'parentId' => ['nullable', 'integer', Rule::exists('services', 'id')->whereNull('deleted_at')],
            'code' => ['required', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'content' => ['nullable', 'string'],
            'invoice_content' => ['nullable', 'string'],
            'invoiceContent' => ['nullable', 'string'],
            'invoice_timing' => ['nullable', 'string'],
            'invoiceTiming' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'isActive' => ['nullable', 'boolean'],
        ];
    }
}
