<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            if (! Schema::hasColumn('customers', 'customer_type_option_id')) {
                $table->foreignId('customer_type_option_id')->nullable()->after('customer_type')->constrained('options')->nullOnDelete();
            }

            if (! Schema::hasColumn('customers', 'source_option_id')) {
                $table->foreignId('source_option_id')->nullable()->after('source_id')->constrained('options')->nullOnDelete();
            }

            if (! Schema::hasColumn('customers', 'industry_option_id')) {
                $table->foreignId('industry_option_id')->nullable()->after('industry')->constrained('options')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropForeign(['customer_type_option_id']);
            $table->dropForeign(['source_option_id']);
            $table->dropForeign(['industry_option_id']);
            $table->dropColumn(['customer_type_option_id', 'source_option_id', 'industry_option_id']);
        });
    }
};
