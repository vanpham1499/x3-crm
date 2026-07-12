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
            'transaction_at' => ['nullable', 'date'],
            'transactionAt' => ['nullable', 'date'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'bankAccount' => ['nullable', 'string', 'max:100'],
            'accountNumber' => ['nullable', 'string', 'max:100'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'subAccount' => ['nullable', 'string', 'max:100'],
            'sub_account' => ['nullable', 'string', 'max:100'],
            'gateway' => ['nullable', 'string', 'max:100'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'senderName' => ['nullable', 'string', 'max:255'],
            'transaction_content' => ['required_without_all:transactionContent,content,description', 'string'],
            'transactionContent' => ['required_without_all:transaction_content,content,description', 'string'],
            'content' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'amount' => ['required_without_all:transferAmount,transfer_amount', 'numeric', 'min:0'],
            'transferAmount' => ['required_without_all:amount,transfer_amount', 'numeric', 'min:0'],
            'transfer_amount' => ['required_without_all:amount,transferAmount', 'numeric', 'min:0'],
            'reference' => ['nullable', 'string', 'max:255'],
            'referenceCode' => ['nullable', 'string', 'max:255'],
            'reference_code' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'transferType' => ['nullable', 'string', 'max:50'],
            'transfer_type' => ['nullable', 'string', 'max:50'],
            'accumulated' => ['nullable', 'numeric'],
            'id' => ['nullable'],
            'payload' => ['nullable', 'array'],
        ];
    }
}
