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
            $payment->refresh();
            $amount = round((float) ($data['amount'] ?? 0), 2);
            $availableAmount = $this->availableAmount($payment);

            if ($amount <= self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'amount' => ['Số tiền hoàn phải lớn hơn 0.'],
                ]);
            }

            if ($amount > $availableAmount + self::MONEY_EPSILON) {
                throw ValidationException::withMessages([
                    'amount' => [sprintf(
                        'Chỉ có thể hoàn tối đa %s đ từ số dư chưa xử lý.',
                        number_format($availableAmount, 0, ',', '.'),
                    )],
                ]);
            }

            $refund = PaymentRefund::query()->create([
                'payment_id' => $payment->id,
                'amount' => $amount,
                'refunded_at' => Carbon::parse($data['refunded_at'] ?? $data['refundedAt'] ?? now()),
                'recipient_name' => trim((string) ($data['recipient_name'] ?? $data['recipientName'] ?? '')) ?: null,
                'recipient_account' => trim((string) ($data['recipient_account'] ?? $data['recipientAccount'] ?? '')) ?: null,
                'reference' => trim((string) ($data['reference'] ?? '')) ?: null,
                'note' => trim((string) ($data['note'] ?? '')) ?: null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->reconcilePayment($payment->id);

            return $refund->refresh();
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
            ->sum('amount'), 2);
        $availableAmount = round(max(0, (float) $payment->amount - $allocatedAmount - $refundedAmount), 2);
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

        $receivedAmount = (float) PaymentAllocation::query()
            ->where('quotation_id', $quotation->id)
            ->sum('amount');
        $totalAmount = (float) $quotation->total_amount;
        $status = $totalAmount > self::MONEY_EPSILON
            && $receivedAmount >= $totalAmount - self::MONEY_EPSILON
                ? Quotation::STATUS_WON
                : Quotation::STATUS_DRAFT;

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
            ->flatMap(fn (Payment $payment) => $payment->allocations->pluck('quotation_id'))
            ->filter()
            ->unique()
            ->values();
        $quotations = Quotation::query()
            ->whereIn('id', $quotationIds)
            ->get(['id', 'total_amount'])
            ->keyBy(fn (Quotation $quotation): string => (string) $quotation->id);
        $summaries = PaymentAllocation::query()
            ->whereIn('quotation_id', $quotationIds)
            ->selectRaw('quotation_id, COUNT(DISTINCT payment_id) AS transaction_count, COALESCE(SUM(amount), 0) AS received_amount')
            ->groupBy('quotation_id')
            ->get()
            ->keyBy(fn (PaymentAllocation $allocation): string => (string) $allocation->quotation_id);

        foreach ($payments as $payment) {
            $allocatedAmount = round((float) $payment->allocations->sum('amount'), 2);
            $refundedAmount = round((float) $payment->refunds->sum('amount'), 2);
            $availableAmount = round(max(0, (float) $payment->amount - $allocatedAmount - $refundedAmount), 2);
            $payment->setAttribute('ledger_allocated_amount', $allocatedAmount);
            $payment->setAttribute('ledger_refunded_amount', $refundedAmount);
            $payment->setAttribute('ledger_available_amount', $availableAmount);
            $payment->setAttribute('allocation_count', $payment->allocations->count());
            $payment->setAttribute('refund_count', $payment->refunds->count());

            $primaryAllocation = $payment->allocations->first();

            if (! $primaryAllocation) {
                continue;
            }

            $quotation = $quotations->get((string) $primaryAllocation->quotation_id);
            $summary = $summaries->get((string) $primaryAllocation->quotation_id);
            $totalAmount = (float) ($quotation?->total_amount ?? 0);
            $receivedAmount = (float) ($summary?->received_amount ?? 0);

            $payment->setAttribute('collection_total_amount', round($totalAmount, 2));
            $payment->setAttribute('collection_received_amount', round($receivedAmount, 2));
            $payment->setAttribute('collection_outstanding_amount', round(max(0, $totalAmount - $receivedAmount), 2));
            $payment->setAttribute('collection_excess_amount', round(max(0, $receivedAmount - $totalAmount), 2));
            $payment->setAttribute('collection_status', $this->collectionStatus($receivedAmount, $totalAmount));
            $payment->setAttribute('collection_transaction_count', (int) ($summary?->transaction_count ?? 0));
        }
    }

    public function availableAmount(Payment $payment): float
    {
        $allocatedAmount = (float) PaymentAllocation::query()
            ->where('payment_id', $payment->id)
            ->sum('amount');
        $refundedAmount = (float) PaymentRefund::query()
            ->where('payment_id', $payment->id)
            ->sum('amount');

        return round(max(0, (float) $payment->amount - $allocatedAmount - $refundedAmount), 2);
    }

    public function quotationOutstandingAmount(Quotation $quotation): float
    {
        $receivedAmount = (float) PaymentAllocation::query()
            ->where('quotation_id', $quotation->id)
            ->sum('amount');

        return round(max(0, (float) $quotation->total_amount - $receivedAmount), 2);
    }

    public function collectionStatus(float $receivedAmount, float $totalAmount): string
    {
        if ($receivedAmount <= self::MONEY_EPSILON) {
            return 'unpaid';
        }

        if ($receivedAmount < $totalAmount - self::MONEY_EPSILON) {
            return 'partial';
        }

        if ($receivedAmount > $totalAmount + self::MONEY_EPSILON) {
            return 'overpaid';
        }

        return 'paid';
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
