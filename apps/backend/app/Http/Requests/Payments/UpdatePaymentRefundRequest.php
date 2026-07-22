<?php

namespace App\Http\Requests\Payments;

use App\Http\Requests\BaseRequest;
use App\Models\PaymentRefund;
use Illuminate\Validation\Rule;

class UpdatePaymentRefundRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'payment_allocation_id' => ['sometimes', 'nullable', 'integer', 'exists:payment_allocations,id'],
            'paymentAllocationId' => ['sometimes', 'nullable', 'integer', 'exists:payment_allocations,id'],
            'refund_type' => ['sometimes', Rule::in([
                PaymentRefund::TYPE_DEPOSIT,
                PaymentRefund::TYPE_PAYMENT,
                PaymentRefund::TYPE_OVERPAYMENT,
                PaymentRefund::TYPE_COMPENSATION,
            ])],
            'refundType' => ['sometimes', Rule::in([
                PaymentRefund::TYPE_DEPOSIT,
                PaymentRefund::TYPE_PAYMENT,
                PaymentRefund::TYPE_OVERPAYMENT,
                PaymentRefund::TYPE_COMPENSATION,
            ])],
            'status' => ['sometimes', Rule::in([
                PaymentRefund::STATUS_PENDING,
                PaymentRefund::STATUS_COMPLETED,
                PaymentRefund::STATUS_CANCELLED,
            ])],
            'amount' => ['sometimes', 'numeric', 'gt:0'],
            'scheduled_at' => ['sometimes', 'nullable', 'date'],
            'scheduledAt' => ['sometimes', 'nullable', 'date'],
            'refunded_at' => ['nullable', 'date'],
            'refundedAt' => ['nullable', 'date'],
            'recipient_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'recipientName' => ['sometimes', 'nullable', 'string', 'max:255'],
            'recipient_account' => ['sometimes', 'nullable', 'string', 'max:100'],
            'recipientAccount' => ['sometimes', 'nullable', 'string', 'max:100'],
            'recipient_bank' => ['sometimes', 'nullable', 'string', 'max:255'],
            'recipientBank' => ['sometimes', 'nullable', 'string', 'max:255'],
            'reason' => ['sometimes', 'required', 'string', 'max:500'],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
