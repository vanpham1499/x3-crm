<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'reference')) {
                $table->string('reference', 255)->nullable()->after('webhook_payload');
                $table->index(['bank_account', 'reference', 'deleted_at'], 'payments_bank_reference_idx');
            }
        });

        DB::table('quotations')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(100, function ($quotations): void {
                foreach ($quotations as $quotation) {
                    $payments = DB::table('payments')
                        ->where('quotation_id', $quotation->id)
                        ->whereNull('deleted_at');
                    $paymentCount = (clone $payments)->count();

                    if ($paymentCount === 0) {
                        continue;
                    }

                    $received = (float) (clone $payments)->sum('amount');
                    $total = (float) $quotation->total_amount;
                    $matchStatus = $quotation->project_id ? 'matched_project' : 'matched_quotation';
                    $status = $this->collectionStatus($received, $total, $matchStatus);

                    (clone $payments)->update([
                        'status' => $status,
                        'reconciled_status' => $matchStatus,
                        'updated_at' => now(),
                    ]);

                    (clone $payments)->whereNull('matched_at')->update(['matched_at' => now()]);

                    if ($received > 0 && $quotation->status !== 'lost') {
                        DB::table('quotations')->where('id', $quotation->id)->update([
                            'status' => 'won',
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (Schema::hasColumn('payments', 'reference')) {
                $table->dropIndex('payments_bank_reference_idx');
                $table->dropColumn('reference');
            }
        });
    }

    private function collectionStatus(float $received, float $total, string $matchStatus): string
    {
        if ($received <= 0) {
            return $matchStatus;
        }

        if ($received < $total) {
            return 'partial';
        }

        if ($received > $total) {
            return 'overpaid';
        }

        return 'paid';
    }
};
