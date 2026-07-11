<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('revenues', function (Blueprint $table): void {
            $table->string('payment_status', 30)->default('unpaid')->after('actual_received_amount');
            $table->string('invoice_status', 30)->default('not_issued')->after('payment_status');

            $table->index(['payment_status', 'deleted_at']);
            $table->index(['invoice_status', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::table('revenues', function (Blueprint $table): void {
            $table->dropIndex(['payment_status', 'deleted_at']);
            $table->dropIndex(['invoice_status', 'deleted_at']);
            $table->dropColumn(['payment_status', 'invoice_status']);
        });
    }
};
