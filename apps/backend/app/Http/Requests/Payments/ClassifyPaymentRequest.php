<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use Illuminate\Validation\Rule;

class ClassifyPaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'receipt_type' => ['required_without:receiptType', Rule::in(['customer', 'internal', 'other'])],
            'receiptType' => ['required_without:receipt_type', Rule::in(['customer', 'internal', 'other'])],
        ];
    }
}
