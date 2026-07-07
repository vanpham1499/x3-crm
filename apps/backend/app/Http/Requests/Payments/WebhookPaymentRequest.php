<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;

class WebhookPaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'transaction_date' => ['nullable', 'date'],
            'transactionDate' => ['nullable', 'date'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'bankAccount' => ['nullable', 'string', 'max:100'],
            'transaction_content' => ['required_without:transactionContent', 'string'],
            'transactionContent' => ['required_without:transaction_content', 'string'],
            'amount' => ['required', 'numeric', 'min:0'],
            'reference' => ['nullable', 'string', 'max:255'],
            'payload' => ['nullable', 'array'],
        ];
    }
}
