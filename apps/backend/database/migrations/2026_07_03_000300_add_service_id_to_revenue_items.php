<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('revenue_items', function (Blueprint $table): void {
            if (! Schema::hasColumn('revenue_items', 'service_id')) {
                $table->foreignId('service_id')->nullable()->after('revenue_id')->constrained('services')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('revenue_items', function (Blueprint $table): void {
            $table->dropForeign(['service_id']);
            $table->dropColumn('service_id');
        });
    }
};
