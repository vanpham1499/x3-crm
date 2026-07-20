<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (! Schema::hasColumn('quotations', 'account_reconciliation_image_urls')) {
                $table->json('account_reconciliation_image_urls')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            if (Schema::hasColumn('quotations', 'account_reconciliation_image_urls')) {
                $table->dropColumn('account_reconciliation_image_urls');
            }
        });
    }
};
