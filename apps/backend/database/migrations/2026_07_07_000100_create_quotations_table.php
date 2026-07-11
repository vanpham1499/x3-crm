<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotations', function (Blueprint $table): void {
            $table->id();
            $table->string('quotation_code', 120)->unique();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('contract_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('service_code', 80)->nullable();
            $table->string('service_name')->nullable();
            $table->string('status', 50)->default('draft');
            $table->decimal('subtotal_amount', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('deposit_amount', 15, 2)->default(0);
            $table->date('valid_until')->nullable();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['lead_id', 'status', 'deleted_at']);
            $table->index(['customer_id', 'project_id', 'contract_id']);
            $table->index(['service_id', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotations');
    }
};
