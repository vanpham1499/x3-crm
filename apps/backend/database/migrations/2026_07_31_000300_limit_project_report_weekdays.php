<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CONSTRAINT = 'project_weekly_settings_report_weekday_check';

    public function up(): void
    {
        Schema::table('project_weekly_settings', function (Blueprint $table): void {
            $table->unsignedTinyInteger('report_weekday')->nullable()->change();
        });

        DB::table('project_weekly_settings')
            ->whereNotNull('report_weekday')
            ->where(function ($query): void {
                $query->where('report_weekday', '<', 1)->orWhere('report_weekday', '>', 5);
            })
            ->update([
                'report_weekday' => null,
                'is_active' => false,
                'updated_at' => now(),
            ]);

        DB::statement(sprintf(
            'ALTER TABLE project_weekly_settings ADD CONSTRAINT %s CHECK (report_weekday IS NULL OR report_weekday BETWEEN 1 AND 5)',
            self::CONSTRAINT,
        ));
    }

    public function down(): void
    {
        DB::statement(sprintf(
            'ALTER TABLE project_weekly_settings DROP CONSTRAINT IF EXISTS %s',
            self::CONSTRAINT,
        ));

        DB::table('project_weekly_settings')
            ->whereNull('report_weekday')
            ->update([
                'report_weekday' => 1,
                'is_active' => false,
                'updated_at' => now(),
            ]);

        Schema::table('project_weekly_settings', function (Blueprint $table): void {
            $table->unsignedTinyInteger('report_weekday')->nullable(false)->change();
        });
    }
};
