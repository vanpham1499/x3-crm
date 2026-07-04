<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            if (! Schema::hasColumn('contracts', 'contract_status_option_id')) {
                $table->foreignUuid('contract_status_option_id')->nullable()->after('contract_status_id')->constrained('options')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            if (Schema::hasColumn('contracts', 'contract_status_option_id')) {
                $table->dropForeign(['contract_status_option_id']);
                $table->dropColumn('contract_status_option_id');
            }
        });
    }
};
