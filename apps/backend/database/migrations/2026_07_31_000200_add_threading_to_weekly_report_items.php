<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weekly_report_items', function (Blueprint $table): void {
            $table
                ->foreignId('reply_to_item_id')
                ->nullable()
                ->after('weekly_report_id')
                ->constrained('weekly_report_items')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('weekly_report_items', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('reply_to_item_id');
        });
    }
};
