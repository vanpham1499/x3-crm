<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;

class RefundPaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'refunded_at' => ['nullable', 'date'],
            'refundedAt' => ['nullable', 'date'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'recipientName' => ['nullable', 'string', 'max:255'],
            'recipient_account' => ['nullable', 'string', 'max:100'],
            'recipientAccount' => ['nullable', 'string', 'max:100'],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
