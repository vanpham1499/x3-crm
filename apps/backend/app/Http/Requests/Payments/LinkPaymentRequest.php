<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class LinkPaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'customerId' => ['nullable', 'integer', Rule::exists('customers', 'id')->whereNull('deleted_at')],
            'project_id' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'projectId' => ['nullable', 'integer', Rule::exists('projects', 'id')->whereNull('deleted_at')],
            'receipt_type' => ['nullable', Rule::in(['customer', 'internal', 'other'])],
            'receiptType' => ['nullable', Rule::in(['customer', 'internal', 'other'])],
        ];
    }
}
