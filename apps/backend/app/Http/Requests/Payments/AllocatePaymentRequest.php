<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class AllocatePaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'allocations' => ['required', 'array', 'min:1'],
            'allocations.*.quotation_id' => [
                'required_without:allocations.*.quotationId',
                'integer',
                Rule::exists('quotations', 'id')->whereNull('deleted_at'),
            ],
            'allocations.*.quotationId' => [
                'required_without:allocations.*.quotation_id',
                'integer',
                Rule::exists('quotations', 'id')->whereNull('deleted_at'),
            ],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0'],
            'allocations.*.note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
