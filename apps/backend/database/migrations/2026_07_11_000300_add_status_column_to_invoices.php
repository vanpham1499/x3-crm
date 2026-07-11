<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->string('status', 30)->default('draft')->after('status_id');
            $table->unique('revenue_id');

            $table->index(['status', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropIndex(['status', 'deleted_at']);
            $table->dropUnique(['revenue_id']);
            $table->dropColumn('status');
        });
    }
};
