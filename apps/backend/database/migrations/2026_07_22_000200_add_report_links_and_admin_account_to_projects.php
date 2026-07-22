<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->text('weekly_report_link')->nullable()->after('plan_link');
            $table->text('customer_tracking_report_link')->nullable()->after('weekly_report_link');
            $table->text('admin_web_account')->nullable()->after('customer_tracking_report_link');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn([
                'weekly_report_link',
                'customer_tracking_report_link',
                'admin_web_account',
            ]);
        });
    }
};
