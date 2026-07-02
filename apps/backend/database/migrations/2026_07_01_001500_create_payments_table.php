<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignUuid('revenue_id')->nullable()->constrained('revenues')->nullOnDelete();
            $table->date('transaction_date');
            $table->string('bank_account', 100)->nullable();
            $table->text('transaction_content')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('customer_code_text', 100)->nullable();
            $table->boolean('is_notified')->default(false);
            $table->string('reconciled_status', 50)->default('unmatched');
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['project_id', 'revenue_id', 'deleted_at']);
            $table->index(['transaction_date', 'reconciled_status', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
