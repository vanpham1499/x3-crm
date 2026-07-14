<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const MONEY_EPSILON = 0.01;

    public function up(): void
    {
        DB::table('payments')
            ->whereNull('deleted_at')
            ->where('receipt_type', 'customer')
            ->where('allocated_amount', '>', self::MONEY_EPSILON)
            ->where('excess_amount', '>', self::MONEY_EPSILON)
            ->where('refunded_amount', '<=', self::MONEY_EPSILON)
            ->update([
                'status' => 'paid_with_excess',
                'updated_at' => now(),
            ]);

        DB::table('payments')
            ->whereNull('deleted_at')
            ->where('receipt_type', 'customer')
            ->whereNotNull('quotation_id')
            ->where('allocated_amount', '<=', self::MONEY_EPSILON)
            ->where('excess_amount', '>', self::MONEY_EPSILON)
            ->where('refunded_amount', '<=', self::MONEY_EPSILON)
            ->orderBy('id')
            ->chunkById(100, function ($payments): void {
                $quotationIds = $payments->pluck('quotation_id')->filter()->unique()->values();
                $quotations = DB::table('quotations')
                    ->whereIn('id', $quotationIds)
                    ->whereNull('deleted_at')
                    ->get(['id', 'total_amount'])
                    ->keyBy('id');
                $receivedAmounts = DB::table('payment_allocations')
                    ->whereIn('quotation_id', $quotationIds)
                    ->whereNull('deleted_at')
                    ->selectRaw('quotation_id, COALESCE(SUM(amount), 0) AS received_amount')
                    ->groupBy('quotation_id')
                    ->pluck('received_amount', 'quotation_id');

                foreach ($payments as $payment) {
                    $quotation = $quotations->get($payment->quotation_id);

                    if (! $quotation) {
                        continue;
                    }

                    $receivedAmount = (float) ($receivedAmounts[$payment->quotation_id] ?? 0);

                    if ($receivedAmount < (float) $quotation->total_amount - self::MONEY_EPSILON) {
                        continue;
                    }

                    DB::table('payments')->where('id', $payment->id)->update([
                        'status' => 'overpaid',
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('payments')
            ->where('status', 'paid_with_excess')
            ->update([
                'status' => 'partially_allocated',
                'updated_at' => now(),
            ]);

        DB::table('payments')
            ->where('status', 'overpaid')
            ->whereNotNull('quotation_id')
            ->update([
                'status' => 'matched_quotation',
                'updated_at' => now(),
            ]);
    }
};
