<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            if (! Schema::hasColumn('leads', 'interested_service_option_id')) {
                $table->foreignId('interested_service_option_id')
                    ->nullable()
                    ->after('industry_option_id')
                    ->constrained('options')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            if (Schema::hasColumn('leads', 'interested_service_option_id')) {
                $table->dropForeign(['interested_service_option_id']);
                $table->dropColumn('interested_service_option_id');
            }
        });
    }
};