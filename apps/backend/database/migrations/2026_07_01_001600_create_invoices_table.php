<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('revenue_id')->constrained('revenues')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
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
            $table->foreignId('status_id')->nullable()->constrained('statuses')->nullOnDelete();
            $table->text('file_url')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
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
