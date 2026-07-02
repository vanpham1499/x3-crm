<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenues', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('revenue_code', 100)->nullable();
            $table->string('revenue_type', 50)->default('service_fee');
            $table->date('reported_date')->nullable();
            $table->date('payment_due_date')->nullable();
            $table->date('paid_date')->nullable();
            $table->date('revenue_month')->nullable();
            $table->decimal('amount_before_vat', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('amount_after_vat', 15, 2)->default(0);
            $table->decimal('actual_received_amount', 15, 2)->default(0);
            $table->foreignUuid('payment_status_id')->nullable()->constrained('statuses')->nullOnDelete();
            $table->foreignUuid('invoice_status_id')->nullable()->constrained('statuses')->nullOnDelete();
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['project_id', 'revenue_month', 'deleted_at']);
            $table->index(['payment_status_id', 'invoice_status_id', 'deleted_at']);
            $table->index(['reported_date', 'paid_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenues');
    }
};
