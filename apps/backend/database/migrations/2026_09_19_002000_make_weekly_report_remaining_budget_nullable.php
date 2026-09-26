<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Unknown balance is NULL, not zero. Do not rewrite any historical values.
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->decimal('remaining_account_budget', 15, 2)->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        // Restoring NOT NULL must never silently replace an unknown balance with zero.
        if (DB::table('weekly_reports')->whereNull('remaining_account_budget')->exists()) {
            throw new RuntimeException('Không thể khôi phục ràng buộc khi còn báo cáo để trống ngân sách còn lại. Cần xử lý dữ liệu riêng.');
        }
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->decimal('remaining_account_budget', 15, 2)->nullable(false)->default(0)->change();
        });
    }
};
