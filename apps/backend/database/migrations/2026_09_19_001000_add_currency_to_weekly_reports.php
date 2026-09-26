<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add a unit to reports only. Existing amounts and project presets remain unchanged.
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->string('currency', 3)->default('VND');
        });
    }

    public function down(): void
    {
        // Dropping the unit would silently relabel historical foreign-currency reports as VND.
        if (DB::table('weekly_reports')->where('currency', '!=', 'VND')->exists()) {
            throw new RuntimeException('Không thể xóa đơn vị tiền tệ khi còn báo cáo ngoại tệ. Cần kế hoạch chuyển dữ liệu riêng.');
        }
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->dropColumn('currency');
        });
    }
};
