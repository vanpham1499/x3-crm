<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_refunds', function (Blueprint $table): void {
            $table->decimal('budget_refund_amount', 15, 2)->default(0)->after('amount');
            $table->decimal('service_fee_refund_amount', 15, 2)->default(0)->after('budget_refund_amount');
        });

        // Preserve the previous top-up behavior for old refunds. They can be
        // reclassified later from the edit dialog when their composition is known.
        DB::table('payment_refunds')
            ->where('refund_type', 'payment')
            ->update([
                'budget_refund_amount' => DB::raw('amount'),
                'service_fee_refund_amount' => 0,
            ]);

        $projectId = DB::table('projects')
            ->where('project_code', '811.DV1.M.VINFASTNGEAN')
            ->value('id');

        if ($projectId) {
            // Project 811 returned 3.2m of unused advertising budget and 640k
            // of unused management fee. Only the first amount releases top-up budget.
            DB::table('payment_refunds')
                ->where('project_id', $projectId)
                ->where('refund_type', 'payment')
                ->where('amount', 3840000)
                ->update([
                    'budget_refund_amount' => 3200000,
                    'service_fee_refund_amount' => 640000,
                ]);

            // This 440k entry was previously added only to neutralize the old
            // top-up formula. It is retained for audit but no longer counted as a cost.
            DB::table('project_costs')
                ->where('project_id', $projectId)
                ->where('status', 'completed')
                ->where('total_amount', 440000)
                ->where('note', 'Đây là khoản hoàn trả chi phí')
                ->update([
                    'status' => 'cancelled',
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        $projectId = DB::table('projects')
            ->where('project_code', '811.DV1.M.VINFASTNGEAN')
            ->value('id');

        if ($projectId) {
            DB::table('project_costs')
                ->where('project_id', $projectId)
                ->where('status', 'cancelled')
                ->where('total_amount', 440000)
                ->where('note', 'Đây là khoản hoàn trả chi phí')
                ->update([
                    'status' => 'completed',
                    'updated_at' => now(),
                ]);
        }

        Schema::table('payment_refunds', function (Blueprint $table): void {
            $table->dropColumn(['budget_refund_amount', 'service_fee_refund_amount']);
        });
    }
};
