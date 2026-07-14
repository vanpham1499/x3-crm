<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const MONEY_EPSILON = 0.01;

    public function up(): void
    {
        DB::table('quotations')
            ->select(['id', 'total_amount'])
            ->orderBy('id')
            ->chunkById(100, function ($quotations): void {
                foreach ($quotations as $quotation) {
                    $receivedAmount = (float) DB::table('payments')
                        ->where('quotation_id', $quotation->id)
                        ->whereNull('deleted_at')
                        ->sum('amount');
                    $totalAmount = (float) $quotation->total_amount;
                    $status = $totalAmount > self::MONEY_EPSILON
                        && $receivedAmount >= $totalAmount - self::MONEY_EPSILON
                            ? 'won'
                            : 'draft';

                    DB::table('quotations')
                        ->where('id', $quotation->id)
                        ->update(['status' => $status]);
                }
            });
    }

    public function down(): void
    {
        // Không thể khôi phục chính xác các trạng thái thủ công cũ.
    }
};
