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
            $table->timestamp('refunded_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('payment_refunds')
            ->whereNull('refunded_at')
            ->update([
                'refunded_at' => DB::raw('COALESCE(completed_at, scheduled_at, created_at, CURRENT_TIMESTAMP)'),
            ]);

        Schema::table('payment_refunds', function (Blueprint $table): void {
            $table->timestamp('refunded_at')->nullable(false)->change();
        });
    }
};
