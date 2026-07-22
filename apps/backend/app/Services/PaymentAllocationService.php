<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\Quotation;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentAllocationService
{
    private const MONEY_EPSILON = 0.01;

    public function allocate(string|int $paymentId, array $entries, ?int $userId = null): Collection
    {
        return DB::transaction(function () use ($paymentId, $entries, $userId): Collection {
            $payment = Payment::query()->lockForUpdate()->findOrFail($paymentId);
            $this->reconcilePayment($payment->id);
            $payment->refresh();

            if (($payment->receipt_type ?? 'customer') !== 'customer') {
                throw ValidationException::withMessages([
                    'allocations' => ['Giao dịch không phải khoản thu khách hàng nên không thể phân bổ.'],
                ]);
            }

            $entries = collect($entries)
                ->map(fn (array $entry): array => [
                    'quotation_id' => (int) ($entry['quotation_id'] ?? $entry['quotationId'] ?? 0),
                    'amount' => round((float) ($entry['amount'] ?? 0), 2),
                    'note' => trim((string) ($entry['note'] ?? '')) ?: null,
                ])
                ->filter(fn (array $entry): bool => $entry['quotation_id'] > 0 && $entry['amount'] > 0)
                ->values();

            if ($entries->isEmpty()) {
                throw ValidationException::withMessages([
                    'allocations' => ['Cần chọn ít nhất một báo phí và nhập số tiền phân bổ.'],
                ]);
            }

            $requestedAmount = (float) $entries->sum('amount');
            $availableAmount = $this->availableAmount($payment);

            if ($requestedAmount > $availableAmount + self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'allocations' => [sprintf(
                        'Tổng phân bổ không được vượt quá số dư chưa xử lý %s đ.',
                        number_format($availableAmount, 0, ',', '.'),
                    )],
                ]);
            }

            $quotationIds = $entries->pluck('quotation_id')->unique()->values();
            $quotations = Quotation::query()
                ->whereIn('id', $quotationIds)
                ->lockForUpdate()
                ->get()
                ->keyBy(fn (Quotation $quotation): string => (string) $quotation->id);

            if ($quotations->count() !== $quotationIds->count()) {
                throw ValidationException::withMessages([
                    'allocations' => ['Có báo phí không còn tồn tại hoặc đã bị xóa.'],
                ]);
            }

            $requestedByQuotation = $entries->groupBy('quotation_id')->map->sum('amount');

            foreach ($requestedByQuotation as $quotationId => $amount) {
                $quotation = $quotations->get((string) $quotationId);
                $outstanding = $this->quotationOutstandingAmount($quotation);

                if ((float) $amount > $outstanding + self::MONEY_EPSILON) {
                    throw ValidationException::withMessages([
                        'allocations' => [sprintf(
                            'Báo phí %s chỉ còn phải thu %s đ.',
                            $quotation->quotation_code,
                            number_format($outstanding, 0, ',', '.'),
                        )],
                    ]);
                }
            }

            foreach ($entries as $entry) {
                $quotation = $quotations->get((string) $entry['quotation_id']);

                PaymentAllocation::query()->create([
                    'payment_id' => $payment->id,
                    'quotation_id' => $quotation->id,
                    'customer_id' => $quotation->customer_id,
                    'project_id' => $quotation->project_id,
                    'amount' => $entry['amount'],
                    'allocated_at' => now(),
                    'note' => $entry['note'],
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]);
            }

            $this->reconcilePayment($payment->id);

            foreach ($quotationIds as $quotationId) {
                $this->reconcileQuotation($quotationId);
            }

            return PaymentAllocation::query()
                ->with(['quotation.customer', 'quotation.project'])
                ->where('payment_id', $payment->id)
                ->get();
        });
    }

    public function autoAllocateToQuotation(
        string|int $paymentId,
        string|int|null $quotationId,
        ?int $userId = null,
    ): void {
        if (! $quotationId) {
            return;
        }

        $payment = Payment::query()->find($paymentId);
        $quotation = Quotation::query()->find($quotationId);

        if (! $payment || ! $quotation) {
            return;
        }

        $amount = min($this->availableAmount($payment), $this->quotationOutstandingAmount($quotation));

        if ($amount <= self::MONEY_EPSILON) {
            $this->reconcilePayment($payment->id);
            $this->reconcileQuotation($quotation->id);

            return;
        }

        $this->allocate($payment->id, [[
            'quotation_id' => $quotation->id,
            'amount' => $amount,
            'note' => 'Tự động phân bổ theo nội dung chuyển khoản',
        ]], $userId);
    }

    public function removeAllocation(
        string|int $paymentId,
        string|int $allocationId,
        ?int $userId = null,
    ): void {
        DB::transaction(function () use ($paymentId, $allocationId, $userId): void {
            $allocation = PaymentAllocation::query()
                ->where('payment_id', $paymentId)
                ->lockForUpdate()
                ->findOrFail($allocationId);

            if (PaymentRefund::query()
                ->where('payment_allocation_id', $allocation->id)
                ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
                ->exists()) {
                throw ValidationException::withMessages([
                    'allocation' => ['Không thể hủy phân bổ đã phát sinh khoản trả khách.'],
                ]);
            }

            $quotationId = $allocation->quotation_id;
            $allocation->deleted_by = $userId;
            $allocation->save();
            $allocation->delete();

            $this->reconcilePayment($paymentId);
            $this->reconcileQuotation($quotationId);
        });
    }

    public function refund(string|int $paymentId, array $data, ?int $userId = null): PaymentRefund
    {
        return DB::transaction(function () use ($paymentId, $data, $userId): PaymentRefund {
            $payment = Payment::query()->lockForUpdate()->findOrFail($paymentId);
            $this->reconcilePayment($payment->id);
            $payment->refresh()->load(['allocations.quotation', 'refunds']);
            $amount = round((float) ($data['amount'] ?? 0), 2);
            $refundType = (string) ($data['refund_type'] ?? $data['refundType'] ?? '');
            $status = (string) ($data['status'] ?? PaymentRefund::STATUS_PENDING);
            $allocationId = $data['payment_allocation_id'] ?? $data['paymentAllocationId'] ?? null;
            $allocation = $allocationId
                ? $payment->allocations()->with('quotation')->lockForUpdate()->find($allocationId)
                : null;

            if ($amount <= self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'amount' => ['Số tiền trả khách phải lớn hơn 0.'],
                ]);
            }

            if ($allocationId && ! $allocation) {
                throw ValidationException::withMessages([
                    'paymentAllocationId' => ['Khoản phân bổ không thuộc giao dịch tiền vào đã chọn.'],
                ]);
            }

            $limits = $this->refundLimits($payment, $allocation);

            if (in_array($refundType, [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT], true)
                && ! $allocation) {
                throw ValidationException::withMessages([
                    'paymentAllocationId' => ['Cần chọn báo phí đã nhận tiền để thực hiện loại hoàn trả này.'],
                ]);
            }

            $limit = match ($refundType) {
                PaymentRefund::TYPE_DEPOSIT => $limits['deposit'],
                PaymentRefund::TYPE_PAYMENT => $limits['allocation'],
                PaymentRefund::TYPE_OVERPAYMENT => $limits['overpayment'],
                PaymentRefund::TYPE_COMPENSATION => null,
                default => throw ValidationException::withMessages([
                    'refundType' => ['Loại trả khách không hợp lệ.'],
                ]),
            };

            if ($refundType === PaymentRefund::TYPE_COMPENSATION
                && ! $allocation
                && ! $payment->quotation_id
                && ! $payment->customer_id
                && ! $payment->project_id) {
                throw ValidationException::withMessages([
                    'refundType' => ['Cần gắn giao dịch với khách hàng, dự án hoặc báo phí trước khi ghi nhận bù thêm.'],
                ]);
            }

            if ($limit !== null && $amount > $limit + self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'amount' => [sprintf(
                        'Loại trả khách này chỉ còn có thể ghi nhận tối đa %s đ.',
                        number_format($limit, 0, ',', '.'),
                    )],
                ]);
            }

            $quotation = match ($refundType) {
                PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT => $allocation?->quotation,
                PaymentRefund::TYPE_COMPENSATION => $this->singleLinkedQuotation($payment),
                default => null,
            };
            $scheduledAt = Carbon::parse(
                $data['scheduled_at']
                    ?? $data['scheduledAt']
                    ?? $data['refunded_at']
                    ?? $data['refundedAt']
                    ?? now(),
            );
            $refundedAt = Carbon::parse(
                $data['refunded_at'] ?? $data['refundedAt'] ?? $scheduledAt,
            );

            $refund = PaymentRefund::query()->create([
                'payment_id' => $payment->id,
                'payment_allocation_id' => $allocation?->id,
                'quotation_id' => $quotation?->id,
                'customer_id' => $allocation?->customer_id ?? $quotation?->customer_id ?? $payment->customer_id,
                'project_id' => $allocation?->project_id ?? $quotation?->project_id ?? $payment->project_id,
                'refund_type' => $refundType,
                'status' => $status,
                'amount' => $amount,
                'scheduled_at' => $scheduledAt,
                'refunded_at' => $refundedAt,
                'completed_at' => $status === PaymentRefund::STATUS_COMPLETED ? $refundedAt : null,
                'recipient_name' => trim((string) ($data['recipient_name'] ?? $data['recipientName'] ?? '')) ?: null,
                'recipient_account' => trim((string) ($data['recipient_account'] ?? $data['recipientAccount'] ?? '')) ?: null,
                'recipient_bank' => trim((string) ($data['recipient_bank'] ?? $data['recipientBank'] ?? '')) ?: null,
                'reason' => trim((string) ($data['reason'] ?? '')),
                'reference' => trim((string) ($data['reference'] ?? '')) ?: null,
                'note' => trim((string) ($data['note'] ?? '')) ?: null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->reconcilePayment($payment->id);
            $this->reconcileQuotation($quotation?->id);

            return $refund->refresh()->load([
                'payment',
                'allocation',
                'quotation',
                'customer',
                'project',
                'createdBy',
            ]);
        });
    }

    public function updateRefund(
        string|int $refundId,
        array $data,
        ?int $userId = null,
    ): PaymentRefund {
        return DB::transaction(function () use ($refundId, $data, $userId): PaymentRefund {
            $refund = PaymentRefund::query()->lockForUpdate()->findOrFail($refundId);
            $oldQuotationId = $refund->quotation_id;
            $payment = Payment::query()
                ->with(['allocations.quotation', 'refunds'])
                ->lockForUpdate()
                ->findOrFail($refund->payment_id);
            $refundType = (string) ($data['refund_type'] ?? $data['refundType'] ?? $refund->refund_type);
            $status = (string) ($data['status'] ?? $refund->status);
            $amount = round((float) ($data['amount'] ?? $refund->amount), 2);
            $hasAllocationInput = array_key_exists('payment_allocation_id', $data)
                || array_key_exists('paymentAllocationId', $data);
            $allocationId = $hasAllocationInput
                ? ($data['payment_allocation_id'] ?? $data['paymentAllocationId'] ?? null)
                : $refund->payment_allocation_id;

            if (in_array($refundType, [PaymentRefund::TYPE_OVERPAYMENT, PaymentRefund::TYPE_COMPENSATION], true)) {
                $allocationId = null;
            }

            $allocation = $allocationId
                ? $payment->allocations()->with('quotation')->lockForUpdate()->find($allocationId)
                : null;

            if ($amount <= self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'amount' => ['Số tiền trả khách phải lớn hơn 0.'],
                ]);
            }

            if ($allocationId && ! $allocation) {
                throw ValidationException::withMessages([
                    'paymentAllocationId' => ['Khoản phân bổ không thuộc giao dịch tiền vào đã chọn.'],
                ]);
            }

            if (in_array($refundType, [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT], true)
                && ! $allocation) {
                throw ValidationException::withMessages([
                    'paymentAllocationId' => ['Cần chọn báo phí đã nhận tiền cho loại hoàn trả này.'],
                ]);
            }

            if ($refundType === PaymentRefund::TYPE_COMPENSATION
                && ! $allocation
                && ! $payment->quotation_id
                && ! $payment->customer_id
                && ! $payment->project_id) {
                throw ValidationException::withMessages([
                    'refundType' => ['Cần gắn giao dịch với khách hàng, dự án hoặc báo phí trước khi ghi nhận bù thêm.'],
                ]);
            }

            if ($status !== PaymentRefund::STATUS_CANCELLED) {
                $limits = $this->refundLimits($payment, $allocation, $refund->id);
                $limit = match ($refundType) {
                    PaymentRefund::TYPE_DEPOSIT => $limits['deposit'],
                    PaymentRefund::TYPE_PAYMENT => $limits['allocation'],
                    PaymentRefund::TYPE_OVERPAYMENT => $limits['overpayment'],
                    PaymentRefund::TYPE_COMPENSATION => null,
                    default => throw ValidationException::withMessages([
                        'refundType' => ['Loại trả khách không hợp lệ.'],
                    ]),
                };

                if ($limit !== null && $amount > $limit + self::MONEY_EPSILON) {
                    throw ValidationException::withMessages([
                        'amount' => [sprintf(
                            'Loại trả khách này chỉ còn có thể ghi nhận tối đa %s đ.',
                            number_format($limit, 0, ',', '.'),
                        )],
                    ]);
                }
            }

            $quotation = match ($refundType) {
                PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT => $allocation?->quotation,
                PaymentRefund::TYPE_COMPENSATION => $this->singleLinkedQuotation($payment),
                default => null,
            };
            $scheduledAt = Carbon::parse(
                $data['scheduled_at']
                    ?? $data['scheduledAt']
                    ?? $refund->scheduled_at
                    ?? $refund->refunded_at
                    ?? now(),
            );
            $refundedAt = $status === PaymentRefund::STATUS_COMPLETED
                ? Carbon::parse(
                    $data['refunded_at']
                        ?? $data['refundedAt']
                        ?? $refund->refunded_at
                        ?? $scheduledAt,
                )
                : null;

            $refund->fill([
                'payment_allocation_id' => $allocation?->id,
                'quotation_id' => $quotation?->id,
                'customer_id' => $allocation?->customer_id ?? $quotation?->customer_id ?? $payment->customer_id,
                'project_id' => $allocation?->project_id ?? $quotation?->project_id ?? $payment->project_id,
                'refund_type' => $refundType,
                'status' => $status,
                'amount' => $amount,
                'scheduled_at' => $scheduledAt,
                'refunded_at' => $refundedAt,
                'completed_at' => $refundedAt,
                'recipient_name' => $this->updatedStringValue($data, 'recipient_name', 'recipientName', $refund->recipient_name),
                'recipient_account' => $this->updatedStringValue($data, 'recipient_account', 'recipientAccount', $refund->recipient_account),
                'recipient_bank' => $this->updatedStringValue($data, 'recipient_bank', 'recipientBank', $refund->recipient_bank),
                'reason' => $this->updatedStringValue($data, 'reason', 'reason', $refund->reason),
                'reference' => $this->updatedStringValue($data, 'reference', 'reference', $refund->reference),
                'note' => $this->updatedStringValue($data, 'note', 'note', $refund->note),
                'updated_by' => $userId,
            ])->save();

            $this->reconcilePayment($refund->payment_id);
            $this->reconcileQuotation($oldQuotationId);

            if ((string) $oldQuotationId !== (string) $refund->quotation_id) {
                $this->reconcileQuotation($refund->quotation_id);
            }

            return $refund->refresh()->load([
                'payment',
                'allocation',
                'quotation',
                'customer',
                'project',
                'createdBy',
            ]);
        });
    }

    public function removeRefund(string|int $refundId, ?int $userId = null): void
    {
        DB::transaction(function () use ($refundId, $userId): void {
            $refund = PaymentRefund::query()->lockForUpdate()->findOrFail($refundId);
            $paymentId = $refund->payment_id;
            $quotationId = $refund->quotation_id;

            $refund->deleted_by = $userId;
            $refund->save();
            $refund->delete();

            $this->reconcilePayment($paymentId);
            $this->reconcileQuotation($quotationId);
        });
    }

    public function link(string|int $paymentId, array $data): void
    {
        DB::transaction(function () use ($paymentId, $data): void {
            $payment = Payment::query()->lockForUpdate()->findOrFail($paymentId);
            $receiptType = $data['receipt_type'] ?? $data['receiptType'] ?? $payment->receipt_type ?? 'customer';

            if ($receiptType !== 'customer' && ($payment->allocations()->exists() || $payment->refunds()->exists())) {
                throw ValidationException::withMessages([
                    'receiptType' => ['Cần hủy phân bổ và hoàn tiền trước khi đổi loại giao dịch.'],
                ]);
            }

            $update = ['receipt_type' => $receiptType];

            foreach (['customer_id', 'project_id'] as $key) {
                $camelKey = $key === 'customer_id' ? 'customerId' : 'projectId';

                if (array_key_exists($key, $data) || array_key_exists($camelKey, $data)) {
                    $update[$key] = $data[$key] ?? $data[$camelKey] ?? null;
                }
            }

            if ($receiptType === 'customer' && ! empty($update['project_id'])) {
                $projectCustomerId = DB::table('projects')
                    ->where('id', $update['project_id'])
                    ->whereNull('deleted_at')
                    ->value('customer_id');
                $update['customer_id'] = $projectCustomerId;
            }

            if ($receiptType !== 'customer') {
                $update = array_merge($update, [
                    'quotation_id' => null,
                    'customer_id' => null,
                    'project_id' => null,
                    'contract_id' => null,
                ]);
            }

            DB::table('payments')->where('id', $payment->id)->update(array_merge($update, [
                'updated_at' => now(),
            ]));
            $this->reconcilePayment($payment->id);
        });
    }

    public function reconcilePayment(string|int|null $paymentId): void
    {
        if (! $paymentId) {
            return;
        }

        $payment = Payment::query()->find($paymentId);

        if (! $payment) {
            return;
        }

        $allocations = PaymentAllocation::query()
            ->with('quotation')
            ->where('payment_id', $payment->id)
            ->get();
        $allocatedAmount = round((float) $allocations->sum('amount'), 2);
        $refundedAmount = round((float) PaymentRefund::query()
            ->where('payment_id', $payment->id)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('refund_type', '!=', PaymentRefund::TYPE_COMPENSATION)
            ->sum('amount'), 2);
        $availableAmount = $this->availableAmount($payment);
        $firstAllocation = $allocations->first();
        $projectIds = $allocations->pluck('quotation.project_id')->filter()->unique()->values();
        $customerIds = $allocations->pluck('quotation.customer_id')->filter()->unique()->values();
        $receiptType = $payment->receipt_type ?? 'customer';
        $linkedQuotation = $payment->quotation_id
            ? Quotation::query()->find($payment->quotation_id)
            : null;
        $linkedQuotationOutstanding = $linkedQuotation
            ? $this->quotationOutstandingAmount($linkedQuotation)
            : null;

        $status = $this->paymentStatus(
            $payment,
            $allocatedAmount,
            $refundedAmount,
            $availableAmount,
            $receiptType,
            $linkedQuotationOutstanding,
        );
        $reconciledStatus = $receiptType !== 'customer'
            ? 'non_customer'
            : ($allocatedAmount > self::MONEY_EPSILON
                ? 'allocated'
                : ($payment->quotation_id
                    ? 'matched_quotation'
                    : ($payment->project_id
                        ? 'matched_project'
                        : ($payment->customer_id ? 'matched_customer' : 'unmatched'))));

        $update = [
            'allocated_amount' => $allocatedAmount,
            'refunded_amount' => $refundedAmount,
            'excess_amount' => $availableAmount,
            'status' => $status,
            'reconciled_status' => $reconciledStatus,
            'matched_at' => $reconciledStatus === 'unmatched' ? null : ($payment->matched_at ?? now()),
            'updated_at' => now(),
        ];

        if ($firstAllocation) {
            $update['quotation_id'] = $firstAllocation->quotation_id;
            $update['project_id'] = $projectIds->count() === 1 ? $projectIds->first() : null;
            $update['customer_id'] = $customerIds->count() === 1 ? $customerIds->first() : null;
        }

        DB::table('payments')->where('id', $payment->id)->update($update);
    }

    public function reconcileQuotation(string|int|null $quotationId): void
    {
        if (! $quotationId) {
            return;
        }

        $quotation = Quotation::query()->find($quotationId);

        if (! $quotation) {
            return;
        }

        $grossReceivedAmount = (float) PaymentAllocation::query()
            ->where('quotation_id', $quotation->id)
            ->sum('amount');
        $refundedAmount = (float) PaymentRefund::query()
            ->where('quotation_id', $quotation->id)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->whereIn('refund_type', [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT])
            ->sum('amount');
        $depositRefundedAmount = (float) PaymentRefund::query()
            ->where('quotation_id', $quotation->id)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->sum('amount');
        $snapshot = $this->quotationCollectionSnapshot(
            (float) $quotation->total_amount,
            $this->quotationDepositLiability($quotation),
            $grossReceivedAmount,
            $refundedAmount,
            $depositRefundedAmount,
        );
        $status = match (true) {
            $snapshot['is_fully_refunded'] => Quotation::STATUS_REFUNDED,
            $snapshot['collectible_amount'] > self::MONEY_EPSILON
                && $snapshot['received_amount'] >= $snapshot['collectible_amount'] - self::MONEY_EPSILON => Quotation::STATUS_WON,
            default => Quotation::STATUS_DRAFT,
        };

        if ($quotation->status !== $status) {
            DB::table('quotations')->where('id', $quotation->id)->update([
                'status' => $status,
                'updated_at' => now(),
            ]);
        }
    }

    public function appendCollectionContext(Collection $payments): void
    {
        if ($payments->isEmpty()) {
            return;
        }

        $payments->loadMissing([
            'allocations.quotation.customer',
            'allocations.quotation.project',
            'refunds',
        ]);
        $quotationIds = $payments
            ->flatMap(fn (Payment $payment) => $payment->allocations
                ->pluck('quotation_id')
                ->push($payment->quotation_id))
            ->filter()
            ->unique()
            ->values();
        $quotations = Quotation::query()
            ->whereIn('id', $quotationIds)
            ->get(['id', 'subtotal_amount', 'vat_amount', 'total_amount', 'deposit_amount', 'metadata'])
            ->keyBy(fn (Quotation $quotation): string => (string) $quotation->id);
        $allocationIds = $payments
            ->flatMap(fn (Payment $payment) => $payment->allocations->pluck('id'))
            ->filter()
            ->unique()
            ->values();
        $reservedRefundsByAllocation = $allocationIds->isEmpty()
            ? collect()
            : PaymentRefund::query()
                ->whereIn('payment_allocation_id', $allocationIds)
                ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
                ->where('refund_type', '!=', PaymentRefund::TYPE_COMPENSATION)
                ->selectRaw('payment_allocation_id, COALESCE(SUM(amount), 0) AS total')
                ->groupBy('payment_allocation_id')
                ->pluck('total', 'payment_allocation_id');
        $reservedDepositsByQuotation = $quotationIds->isEmpty()
            ? collect()
            : PaymentRefund::query()
                ->whereIn('quotation_id', $quotationIds)
                ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
                ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
                ->selectRaw('quotation_id, COALESCE(SUM(amount), 0) AS total')
                ->groupBy('quotation_id')
                ->pluck('total', 'quotation_id');
        $collectionPayments = $quotationIds->isEmpty()
            ? new Collection
            : Payment::query()
                ->with([
                    'allocations:id,payment_id,quotation_id,amount',
                    'refunds:id,payment_id,quotation_id,refund_type,status,amount',
                ])
                ->where(fn ($query) => $query
                    ->whereIn('quotation_id', $quotationIds)
                    ->orWhereHas('allocations', fn ($relation) => $relation
                        ->whereIn('quotation_id', $quotationIds)))
                ->where(fn ($query) => $query
                    ->whereNull('receipt_type')
                    ->orWhere('receipt_type', 'customer'))
                ->get(['id', 'quotation_id', 'amount', 'receipt_type']);
        $receivedByQuotation = [];
        $paymentIdsByQuotation = [];

        foreach ($collectionPayments as $collectionPayment) {
            $linkedQuotationIds = $collectionPayment->allocations
                ->pluck('quotation_id')
                ->push($collectionPayment->quotation_id)
                ->filter()
                ->unique()
                ->values();

            if ($linkedQuotationIds->count() === 1) {
                $quotationId = (string) $linkedQuotationIds->first();
                $receivedByQuotation[$quotationId] = ($receivedByQuotation[$quotationId] ?? 0)
                    + (float) $collectionPayment->allocations->sum('amount');
                $paymentIdsByQuotation[$quotationId][$collectionPayment->id] = true;

                continue;
            }

            foreach ($collectionPayment->allocations->groupBy('quotation_id') as $quotationId => $allocations) {
                $quotationId = (string) $quotationId;
                $receivedByQuotation[$quotationId] = ($receivedByQuotation[$quotationId] ?? 0)
                    + (float) $allocations->sum('amount');
                $paymentIdsByQuotation[$quotationId][$collectionPayment->id] = true;
            }
        }

        $completedRefundsByQuotation = PaymentRefund::query()
            ->whereIn('quotation_id', $quotationIds)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->whereIn('refund_type', [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT])
            ->selectRaw('quotation_id, COALESCE(SUM(amount), 0) AS total')
            ->groupBy('quotation_id')
            ->pluck('total', 'quotation_id');
        $completedDepositRefundsByQuotation = PaymentRefund::query()
            ->whereIn('quotation_id', $quotationIds)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->selectRaw('quotation_id, COALESCE(SUM(amount), 0) AS total')
            ->groupBy('quotation_id')
            ->pluck('total', 'quotation_id');
        $completedCompensationsByQuotation = PaymentRefund::query()
            ->whereIn('quotation_id', $quotationIds)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('refund_type', PaymentRefund::TYPE_COMPENSATION)
            ->selectRaw('quotation_id, COALESCE(SUM(amount), 0) AS total')
            ->groupBy('quotation_id')
            ->pluck('total', 'quotation_id');
        $grossReceivedByQuotation = $receivedByQuotation;

        foreach ($payments as $payment) {
            $allocatedAmount = round((float) $payment->allocations->sum('amount'), 2);
            $activeRefunds = $payment->refunds->whereIn('status', [
                PaymentRefund::STATUS_PENDING,
                PaymentRefund::STATUS_COMPLETED,
            ]);
            $refundedAmount = round((float) $activeRefunds
                ->where('status', PaymentRefund::STATUS_COMPLETED)
                ->where('refund_type', '!=', PaymentRefund::TYPE_COMPENSATION)
                ->sum('amount'), 2);
            $compensationAmount = round((float) $activeRefunds
                ->where('status', PaymentRefund::STATUS_COMPLETED)
                ->where('refund_type', PaymentRefund::TYPE_COMPENSATION)
                ->sum('amount'), 2);
            $reservedRefundAmount = round((float) $activeRefunds
                ->where('refund_type', '!=', PaymentRefund::TYPE_COMPENSATION)
                ->sum('amount'), 2);
            $reservedOverpaymentAmount = round((float) $activeRefunds
                ->where('refund_type', PaymentRefund::TYPE_OVERPAYMENT)
                ->sum('amount'), 2);
            $availableAmount = round(max(
                0,
                (float) $payment->amount - $allocatedAmount - $reservedOverpaymentAmount,
            ), 2);
            $payment->setAttribute('ledger_allocated_amount', $allocatedAmount);
            $payment->setAttribute('ledger_refunded_amount', $refundedAmount);
            $payment->setAttribute('ledger_compensation_amount', $compensationAmount);
            $payment->setAttribute('ledger_available_amount', $availableAmount);
            $payment->setAttribute(
                'ledger_refundable_amount',
                round(max(0, (float) $payment->amount - $reservedRefundAmount), 2),
            );
            $payment->setAttribute('allocation_count', $payment->allocations->count());
            $payment->setAttribute('refund_count', $payment->refunds->count());

            foreach ($payment->allocations as $allocation) {
                $allocationRefunded = round((float) ($reservedRefundsByAllocation[$allocation->id] ?? 0), 2);
                $allocationRemaining = round(max(0, (float) $allocation->amount - $allocationRefunded), 2);
                $quotation = $quotations->get((string) $allocation->quotation_id);
                $depositRemaining = round(max(
                    0,
                    (float) ($quotation?->deposit_amount ?? 0)
                        - (float) ($reservedDepositsByQuotation[$allocation->quotation_id] ?? 0),
                ), 2);

                $allocation->setAttribute('ledger_refunded_amount', $allocationRefunded);
                $allocation->setAttribute('ledger_refundable_amount', $allocationRemaining);
                $allocation->setAttribute('ledger_deposit_refundable_amount', min(
                    $allocationRemaining,
                    $depositRemaining,
                ));
            }

            $primaryQuotationId = $payment->allocations->first()?->quotation_id
                ?? $payment->quotation_id;

            if (! $primaryQuotationId) {
                continue;
            }

            $quotationId = (string) $primaryQuotationId;
            $quotation = $quotations->get($quotationId);
            $totalAmount = (float) ($quotation?->total_amount ?? 0);
            $grossReceivedAmount = (float) ($grossReceivedByQuotation[$quotationId] ?? 0);
            $refundedAmount = (float) ($completedRefundsByQuotation[$quotationId] ?? 0);
            $depositRefundedAmount = (float) ($completedDepositRefundsByQuotation[$quotationId] ?? 0);
            $compensationAmount = (float) ($completedCompensationsByQuotation[$quotationId] ?? 0);
            $snapshot = $this->quotationCollectionSnapshot(
                $totalAmount,
                $this->quotationDepositLiability($quotation),
                $grossReceivedAmount,
                $refundedAmount,
                $depositRefundedAmount,
            );
            $differenceAmount = $snapshot['difference_amount'];

            $payment->setAttribute('collection_total_amount', round($totalAmount, 2));
            $payment->setAttribute('collection_collectible_amount', $snapshot['collectible_amount']);
            $payment->setAttribute('collection_gross_received_amount', round($grossReceivedAmount, 2));
            $payment->setAttribute('collection_received_amount', $snapshot['received_amount']);
            $payment->setAttribute('collection_refunded_amount', round($refundedAmount, 2));
            $payment->setAttribute('collection_deposit_refunded_amount', round($depositRefundedAmount, 2));
            $payment->setAttribute('collection_compensation_amount', round($compensationAmount, 2));
            $payment->setAttribute(
                'collection_outbound_amount',
                round($refundedAmount + $compensationAmount, 2),
            );
            $payment->setAttribute(
                'collection_over_compensation_amount',
                round(max(0, $refundedAmount + $compensationAmount - $grossReceivedAmount), 2),
            );
            $payment->setAttribute('collection_outstanding_amount', $snapshot['outstanding_amount']);
            $payment->setAttribute('collection_excess_amount', $snapshot['excess_amount']);
            $payment->setAttribute('collection_difference_amount', $differenceAmount);
            $payment->setAttribute('collection_status', $snapshot['status']);
            $payment->setAttribute(
                'collection_transaction_count',
                count($paymentIdsByQuotation[$quotationId] ?? []),
            );
        }
    }

    public function availableAmount(Payment $payment): float
    {
        $allocatedAmount = (float) PaymentAllocation::query()
            ->where('payment_id', $payment->id)
            ->sum('amount');
        $reservedOverpaymentAmount = (float) PaymentRefund::query()
            ->where('payment_id', $payment->id)
            ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
            ->where('refund_type', PaymentRefund::TYPE_OVERPAYMENT)
            ->sum('amount');

        return round(max(0, (float) $payment->amount - $allocatedAmount - $reservedOverpaymentAmount), 2);
    }

    public function quotationOutstandingAmount(Quotation $quotation): float
    {
        $grossReceivedAmount = (float) PaymentAllocation::query()
            ->where('quotation_id', $quotation->id)
            ->sum('amount');
        $refundedAmount = (float) PaymentRefund::query()
            ->where('quotation_id', $quotation->id)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->whereIn('refund_type', [PaymentRefund::TYPE_DEPOSIT, PaymentRefund::TYPE_PAYMENT])
            ->sum('amount');
        $depositRefundedAmount = (float) PaymentRefund::query()
            ->where('quotation_id', $quotation->id)
            ->where('status', PaymentRefund::STATUS_COMPLETED)
            ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
            ->sum('amount');
        $snapshot = $this->quotationCollectionSnapshot(
            (float) $quotation->total_amount,
            $this->quotationDepositLiability($quotation),
            $grossReceivedAmount,
            $refundedAmount,
            $depositRefundedAmount,
        );

        return $snapshot['outstanding_amount'];
    }

    public function refundLimits(
        Payment $payment,
        ?PaymentAllocation $allocation = null,
        string|int|null $exceptRefundId = null,
    ): array {
        $activeRefundQuery = PaymentRefund::query()
            ->whereIn('status', [PaymentRefund::STATUS_PENDING, PaymentRefund::STATUS_COMPLETED])
            ->when($exceptRefundId, fn ($query) => $query->whereKeyNot($exceptRefundId));
        $reservedOverpayment = (float) (clone $activeRefundQuery)
            ->where('payment_id', $payment->id)
            ->where('refund_type', PaymentRefund::TYPE_OVERPAYMENT)
            ->sum('amount');
        $allocatedAmount = (float) PaymentAllocation::query()
            ->where('payment_id', $payment->id)
            ->sum('amount');
        $overpayment = round(max(
            0,
            (float) $payment->amount - $allocatedAmount - $reservedOverpayment,
        ), 2);

        if (! $allocation) {
            return ['overpayment' => $overpayment, 'allocation' => 0.0, 'deposit' => 0.0];
        }

        $reservedAllocation = (float) (clone $activeRefundQuery)
            ->where('payment_allocation_id', $allocation->id)
            ->where('refund_type', '!=', PaymentRefund::TYPE_COMPENSATION)
            ->sum('amount');
        $allocationRemaining = round(max(0, (float) $allocation->amount - $reservedAllocation), 2);
        $quotation = $allocation->relationLoaded('quotation')
            ? $allocation->quotation
            : $allocation->quotation()->first();
        $depositAmount = (float) ($quotation?->deposit_amount ?? 0);
        $reservedDeposit = $quotation
            ? (float) (clone $activeRefundQuery)
                ->where('quotation_id', $quotation->id)
                ->where('refund_type', PaymentRefund::TYPE_DEPOSIT)
                ->sum('amount')
            : 0.0;
        $depositRemaining = round(max(0, $depositAmount - $reservedDeposit), 2);

        return [
            'overpayment' => $overpayment,
            'allocation' => $allocationRemaining,
            'deposit' => min($allocationRemaining, $depositRemaining),
        ];
    }

    private function quotationCollectionSnapshot(
        float $totalAmount,
        float $depositAmount,
        float $grossReceivedAmount,
        float $refundedAmount,
        float $depositRefundedAmount,
    ): array {
        $receivedAmount = round(max(0, $grossReceivedAmount - $refundedAmount), 2);
        $isFullyRefunded = $grossReceivedAmount > self::MONEY_EPSILON
            && $receivedAmount <= self::MONEY_EPSILON
            && $refundedAmount >= $grossReceivedAmount - self::MONEY_EPSILON;
        $releasedDepositAmount = min(
            max(0, $depositAmount),
            max(0, $depositRefundedAmount),
        );
        $collectibleAmount = round(
            $isFullyRefunded ? 0 : max(0, $totalAmount - $releasedDepositAmount),
            2,
        );
        $outstandingAmount = round(max(0, $collectibleAmount - $receivedAmount), 2);
        $excessAmount = round(max(0, $receivedAmount - $collectibleAmount), 2);
        $differenceAmount = round($receivedAmount - $collectibleAmount, 2);
        $paymentRefundedAmount = max(0, $refundedAmount - $depositRefundedAmount);
        $status = match (true) {
            $isFullyRefunded => 'refunded',
            $receivedAmount <= self::MONEY_EPSILON => 'unpaid',
            $receivedAmount < $collectibleAmount - self::MONEY_EPSILON
                && $paymentRefundedAmount > self::MONEY_EPSILON => 'partially_refunded',
            $receivedAmount < $collectibleAmount - self::MONEY_EPSILON => 'partial',
            $receivedAmount > $collectibleAmount + self::MONEY_EPSILON => 'overpaid',
            default => 'paid',
        };

        return [
            'received_amount' => $receivedAmount,
            'collectible_amount' => $collectibleAmount,
            'outstanding_amount' => $outstandingAmount,
            'excess_amount' => $excessAmount,
            'difference_amount' => $differenceAmount,
            'is_fully_refunded' => $isFullyRefunded,
            'status' => $status,
        ];
    }

    private function quotationDepositLiability(?Quotation $quotation): float
    {
        if (! $quotation) {
            return 0.0;
        }

        $depositAmount = (float) $quotation->deposit_amount;
        $metadata = is_array($quotation->metadata) ? $quotation->metadata : [];
        $expectedTotalWithDeposit = (float) $quotation->subtotal_amount
            + (float) $quotation->vat_amount
            + $depositAmount;
        $isIncludedInTotal = ($metadata['depositMode'] ?? null) === Quotation::DEPOSIT_MODE_NON_TAXABLE_ADDITION
            || ($depositAmount > 0
                && abs((float) $quotation->total_amount - $expectedTotalWithDeposit) < self::MONEY_EPSILON);

        return $isIncludedInTotal ? $depositAmount : 0.0;
    }

    private function updatedStringValue(
        array $data,
        string $snakeKey,
        string $camelKey,
        ?string $currentValue,
    ): ?string {
        if (! array_key_exists($snakeKey, $data) && ! array_key_exists($camelKey, $data)) {
            return $currentValue;
        }

        return trim((string) ($data[$snakeKey] ?? $data[$camelKey] ?? '')) ?: null;
    }

    private function singleLinkedQuotation(Payment $payment): ?Quotation
    {
        $allocationQuotationIds = $payment->allocations
            ->pluck('quotation_id')
            ->filter()
            ->unique()
            ->values();

        if ($allocationQuotationIds->count() > 1) {
            return null;
        }

        $quotationId = $allocationQuotationIds->first()
            ?? ($payment->allocations->isEmpty() ? $payment->quotation_id : null);

        return $quotationId ? Quotation::query()->find($quotationId) : null;
    }

    private function paymentStatus(
        Payment $payment,
        float $allocatedAmount,
        float $refundedAmount,
        float $availableAmount,
        string $receiptType,
        ?float $linkedQuotationOutstanding,
    ): string {
        if ($receiptType !== 'customer') {
            return 'non_customer';
        }

        if ($refundedAmount >= (float) $payment->amount - self::MONEY_EPSILON
            && $allocatedAmount <= self::MONEY_EPSILON) {
            return 'refunded';
        }

        if ($refundedAmount > self::MONEY_EPSILON
            && $allocatedAmount > self::MONEY_EPSILON
            && $availableAmount <= self::MONEY_EPSILON) {
            return 'allocated_and_refunded';
        }

        if ($refundedAmount > self::MONEY_EPSILON) {
            return 'partially_refunded';
        }

        if ($allocatedAmount > self::MONEY_EPSILON) {
            return $availableAmount > self::MONEY_EPSILON ? 'paid_with_excess' : 'allocated';
        }

        if ($payment->quotation_id) {
            if ($availableAmount > self::MONEY_EPSILON
                && $linkedQuotationOutstanding !== null
                && $linkedQuotationOutstanding <= self::MONEY_EPSILON) {
                return 'overpaid';
            }

            return 'matched_quotation';
        }

        if ($payment->project_id) {
            return 'matched_project';
        }

        if ($payment->customer_id) {
            return 'matched_customer';
        }

        return 'unmatched';
    }
}
