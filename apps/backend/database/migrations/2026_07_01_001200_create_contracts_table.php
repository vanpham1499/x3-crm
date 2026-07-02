<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('contract_no', 100)->nullable();
            $table->foreignUuid('contract_status_id')->nullable()->constrained('statuses')->nullOnDelete();
            $table->decimal('deposit_amount', 15, 2)->nullable()->default(0);
            $table->date('signed_date')->nullable();
            $table->date('expired_date')->nullable();
            $table->string('contract_month', 20)->nullable();
            $table->text('file_url')->nullable();
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['project_id', 'contract_status_id', 'deleted_at']);
            $table->index(['signed_date', 'expired_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
