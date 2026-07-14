<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const MONEY_EPSILON = 0.01;

    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->decimal('allocated_amount', 15, 2)->default(0)->after('amount');
            $table->decimal('excess_amount', 15, 2)->default(0)->after('allocated_amount');
            $table->decimal('cumulative_received', 15, 2)->default(0)->after('excess_amount');
            $table->decimal('outstanding_after', 15, 2)->default(0)->after('cumulative_received');
            $table->unsignedInteger('sequence_no')->nullable()->after('outstanding_after');
        });

        DB::table('quotations')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(100, function ($quotations): void {
                foreach ($quotations as $quotation) {
                    $payments = DB::table('payments')
                        ->where('quotation_id', $quotation->id)
                        ->whereNull('deleted_at')
                        ->orderByRaw('COALESCE(transaction_at, transaction_date::timestamp) ASC')
                        ->orderBy('id')
                        ->get(['id', 'amount', 'matched_at']);
                    $totalAmount = (float) $quotation->total_amount;
                    $cumulativeReceived = 0.0;
                    $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';

                    foreach ($payments as $index => $payment) {
                        $amount = max(0, (float) $payment->amount);
                        $outstandingBefore = max(0, $totalAmount - $cumulativeReceived);
                        $allocatedAmount = min($amount, $outstandingBefore);
                        $excessAmount = max(0, $amount - $allocatedAmount);
                        $cumulativeReceived += $amount;
                        $outstandingAfter = max(0, $totalAmount - $cumulativeReceived);

                        DB::table('payments')->where('id', $payment->id)->update([
                            'allocated_amount' => round($allocatedAmount, 2),
                            'excess_amount' => round($excessAmount, 2),
                            'cumulative_received' => round($cumulativeReceived, 2),
                            'outstanding_after' => round($outstandingAfter, 2),
                            'sequence_no' => $index + 1,
                            'status' => $this->allocationStatus(
                                $allocatedAmount,
                                $excessAmount,
                                $outstandingAfter,
                                $matchStatus,
                            ),
                            'reconciled_status' => $matchStatus,
                            'matched_at' => $payment->matched_at ?? now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropColumn([
                'allocated_amount',
                'excess_amount',
                'cumulative_received',
                'outstanding_after',
                'sequence_no',
            ]);
        });
    }

    private function allocationStatus(
        float $allocatedAmount,
        float $excessAmount,
        float $outstandingAfter,
        string $matchStatus,
    ): string {
        if ($allocatedAmount > self::MONEY_EPSILON && $excessAmount > self::MONEY_EPSILON) {
            return 'paid_with_excess';
        }

        if ($excessAmount > self::MONEY_EPSILON) {
            return 'overpaid';
        }

        if ($allocatedAmount > self::MONEY_EPSILON && $outstandingAfter <= self::MONEY_EPSILON) {
            return 'paid';
        }

        if ($allocatedAmount > self::MONEY_EPSILON) {
            return 'applied';
        }

        return $matchStatus;
    }
};
