<?php

namespace App\Services;

use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Support\KpiFeeBasis;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use LogicException;

/** Shared event projection for KPI tables, detail, export and dashboard. No writes on reads. */
final class KpiFeeEvents
{
    public static function build(Collection $quotations, Collection $allocations, Collection $refunds): Collection
    {
        $receipts = $allocations->groupBy('quotation_id');
        $returns = $refunds->groupBy('quotation_id');
        $result = collect();
        foreach ($quotations as $quotation) {
            $quoteReceipts = $receipts->get($quotation->id, collect());
            if ($quoteReceipts->isEmpty()) {
                continue;
            }
            $basis = $quotation->kpi_fee_basis;
            if (! is_array($basis)) {
                throw new LogicException('KPI cần khởi tạo dữ liệu phí. Chạy kpi:freeze-fee-basis trước khi sử dụng.');
            }
            $paid = 0.0;
            $recognized = 0.0;
            $refunded = 0.0;
            $timeline = $quoteReceipts->map(fn ($row) => ['at' => self::receiptAt($row), 'row' => $row, 'refund' => false])
                ->concat($returns->get($quotation->id, collect())->map(fn ($row) => [
                    'at' => CarbonImmutable::parse($row->completed_at), 'row' => $row, 'refund' => true,
                ]))
                ->sortBy(fn ($event) => $event['at']->format('Y-m-d H:i:s.u').'-'.($event['refund'] ? '1' : '0').'-'.str_pad((string) $event['row']->id, 20, '0', STR_PAD_LEFT));
            foreach ($timeline as $event) {
                $row = $event['row'];
                $impact = 0.0;
                if (! $event['refund']) {
                    $before = KpiFeeBasis::recognized($basis, $paid);
                    $paid += max(0, (float) $row->amount);
                    $impact = min(max(0, (float) $basis['fee'] - $recognized + $refunded),
                        max(0, KpiFeeBasis::recognized($basis, $paid) - $before));
                    $recognized += $impact;
                } elseif ($row->refund_type === PaymentRefund::TYPE_PAYMENT) {
                    $feePart = self::refundFee($basis, $row);
                    // Never deduct a fee that has not been recognized, or deduct twice.
                    $feePart = min(max(0, $recognized - $refunded), $feePart);
                    $refunded += $feePart;
                    $impact = -$feePart;
                    $paid = max((float) $basis['deposit'], $paid - max(0, (float) $row->amount));
                }
                if (! KpiFeeBasis::applies($event['at']->format('Y-m')) || abs($impact) < 0.005) {
                    continue;
                }
                $reference = $event['refund']
                    ? ($row->reference ?: $row->reason ?: 'Hoàn tiền #'.$row->id)
                    : ($row->payment?->transaction_content ?: $row->payment?->reference ?: 'Khoản thu #'.$row->payment_id);
                $result->push([
                    'id' => ($event['refund'] ? 'fee-refund-' : 'fee-receipt-').$row->id,
                    'at' => $event['at'], 'refund' => $event['refund'],
                    'sourceAmount' => (float) $row->amount, 'amount' => round($impact, 2),
                    'reference' => $reference, 'basis' => $basis, 'quotation' => $quotation,
                    'projectId' => (int) $basis['projectId'],
                ]);
            }
        }

        return $result;
    }

    public static function receiptAt(PaymentAllocation $row): CarbonImmutable
    {
        return CarbonImmutable::parse($row->payment?->transaction_at ?: $row->payment?->transaction_date ?: $row->allocated_at ?: $row->created_at);
    }

    public static function refundFee(array $basis, PaymentRefund $refund): float
    {
        if ($refund->refund_type !== PaymentRefund::TYPE_PAYMENT) {
            return 0.0;
        }
        $split = $refund->service_fee_refund_amount !== null || $refund->budget_refund_amount !== null;
        if ($split) {
            $grossFee = max(0, (float) $refund->service_fee_refund_amount);

            return (float) $basis['feeGross'] > 0
                ? round($grossFee * (float) $basis['fee'] / (float) $basis['feeGross'], 2) : 0.0;
        }

        // Legacy unsplit refunds follow the same fee proportion as their receipt.
        return (float) $basis['billableGross'] > 0
            ? round(max(0, (float) $refund->amount) * (float) $basis['fee'] / (float) $basis['billableGross'], 2) : 0.0;
    }
}
