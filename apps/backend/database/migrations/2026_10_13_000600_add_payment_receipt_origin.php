<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->string('payment_channel', 20)->nullable();
            $table->decimal('platform_fee_amount', 18, 2)->default(0);
            $table->foreignId('source_payment_id')->nullable()->constrained('payments')->restrictOnDelete();
        });
        // Existing records remain unclassified. No historical transaction is rewritten.
        DB::statement("CREATE UNIQUE INDEX payments_paypal_reference_unique ON payments (lower(trim(bank_account)), lower(trim(reference))) WHERE payment_channel = 'paypal' AND receipt_type = 'customer' AND deleted_at IS NULL");
        Schema::create('payment_receipt_audits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->restrictOnDelete();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->jsonb('before')->nullable();
            $table->jsonb('after');
            $table->text('reason');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_receipt_audits');
        DB::statement('DROP INDEX IF EXISTS payments_paypal_reference_unique');
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('source_payment_id');
            $table->dropColumn(['payment_channel', 'platform_fee_amount']);
        });
    }
};
