<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->decimal('weekly_spend_amount', 15, 2)->default(0)->after('status');
            $table->decimal('average_weekly_budget', 15, 2)->default(0)->after('weekly_spend_amount');
            $table->decimal('remaining_account_budget', 15, 2)->default(0)->after('average_weekly_budget');
            $table->decimal('total_budget', 15, 2)->default(0)->after('remaining_account_budget');
        });

        DB::table('weekly_reports')->update([
            'total_budget' => DB::raw('monthly_budget'),
        ]);
    }

    public function down(): void
    {
        Schema::table('weekly_reports', function (Blueprint $table): void {
            $table->dropColumn([
                'weekly_spend_amount',
                'average_weekly_budget',
                'remaining_account_budget',
                'total_budget',
            ]);
        });
    }
};
