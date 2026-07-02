<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('revenue_id')->constrained('revenues')->cascadeOnDelete();
            $table->foreignUuid('customer_id')->constrained('customers')->restrictOnDelete();
            $table->string('invoice_type', 50)->nullable()->default('vat');
            $table->string('invoice_no', 100)->nullable();
            $table->date('issued_date')->nullable();
            $table->string('company_name')->nullable();
            $table->string('tax_code', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('receiver_email')->nullable();
            $table->decimal('amount_before_vat', 15, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('amount_after_vat', 15, 2)->default(0);
            $table->foreignUuid('status_id')->nullable()->constrained('statuses')->nullOnDelete();
            $table->text('file_url')->nullable();
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['revenue_id', 'status_id', 'deleted_at']);
            $table->index(['customer_id', 'issued_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
