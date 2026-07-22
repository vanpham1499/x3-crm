<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use App\Models\PaymentRefund;
use Illuminate\Validation\Rule;

class RefundPaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'payment_allocation_id' => ['nullable', 'integer', 'exists:payment_allocations,id'],
            'paymentAllocationId' => ['nullable', 'integer', 'exists:payment_allocations,id'],
            'refund_type' => [
                'required_without:refundType',
                Rule::in([
                    PaymentRefund::TYPE_DEPOSIT,
                    PaymentRefund::TYPE_PAYMENT,
                    PaymentRefund::TYPE_OVERPAYMENT,
                    PaymentRefund::TYPE_COMPENSATION,
                ]),
            ],
            'refundType' => [
                'required_without:refund_type',
                Rule::in([
                    PaymentRefund::TYPE_DEPOSIT,
                    PaymentRefund::TYPE_PAYMENT,
                    PaymentRefund::TYPE_OVERPAYMENT,
                    PaymentRefund::TYPE_COMPENSATION,
                ]),
            ],
            'status' => ['nullable', Rule::in([
                PaymentRefund::STATUS_PENDING,
                PaymentRefund::STATUS_COMPLETED,
            ])],
            'amount' => ['required', 'numeric', 'gt:0'],
            'scheduled_at' => ['nullable', 'date'],
            'scheduledAt' => ['nullable', 'date'],
            'refunded_at' => ['nullable', 'date'],
            'refundedAt' => ['nullable', 'date'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'recipientName' => ['nullable', 'string', 'max:255'],
            'recipient_account' => ['nullable', 'string', 'max:100'],
            'recipientAccount' => ['nullable', 'string', 'max:100'],
            'recipient_bank' => ['nullable', 'string', 'max:255'],
            'recipientBank' => ['nullable', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
