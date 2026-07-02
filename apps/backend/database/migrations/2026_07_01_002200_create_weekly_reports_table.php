<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignUuid('reporter_user_id')->constrained('users')->restrictOnDelete();
            $table->date('week_start_date');
            $table->date('week_end_date');
            $table->date('report_date');
            $table->string('project_status', 50);
            $table->string('weekly_condition', 50)->nullable();
            $table->string('status', 50)->default('draft');
            $table->decimal('monthly_budget', 15, 2)->default(0);
            $table->decimal('management_fee_rate', 5, 2)->default(0);
            $table->text('problem_solution')->nullable();
            $table->text('summary')->nullable();
            $table->text('next_action')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['project_id', 'week_start_date', 'week_end_date', 'deleted_at']);
            $table->index(['reporter_user_id', 'status', 'deleted_at']);
            $table->index(['customer_id', 'reporter_user_id']);
            $table->index(['week_start_date', 'week_end_date', 'report_date']);
            $table->index(['project_status', 'weekly_condition', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_reports');
    }
};
