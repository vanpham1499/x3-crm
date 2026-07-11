<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            if (! Schema::hasColumn('leads', 'status_option_id')) {
                $table->foreignId('status_option_id')->nullable()->after('customer_name')->constrained('options')->nullOnDelete();
            }

            if (! Schema::hasColumn('leads', 'source_option_id')) {
                $table->foreignId('source_option_id')->nullable()->after('assigned_user_id')->constrained('options')->nullOnDelete();
            }

            if (! Schema::hasColumn('leads', 'industry_option_id')) {
                $table->foreignId('industry_option_id')->nullable()->after('website')->constrained('options')->nullOnDelete();
            }
        });

        DB::statement('alter table leads alter column status_id drop not null');
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropForeign(['status_option_id']);
            $table->dropForeign(['source_option_id']);
            $table->dropForeign(['industry_option_id']);
            $table->dropColumn(['status_option_id', 'source_option_id', 'industry_option_id']);
        });
    }
};
