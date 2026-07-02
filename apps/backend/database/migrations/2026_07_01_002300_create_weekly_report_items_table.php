<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_report_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('item_type', 50)->default('problem');
            $table->string('title')->nullable();
            $table->text('content');
            $table->string('priority', 30)->nullable()->default('medium');
            $table->string('status', 30)->default('open');
            $table->date('due_date')->nullable();
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['weekly_report_id', 'deleted_at']);
            $table->index('item_type');
            $table->index(['priority', 'status', 'due_date']);
            $table->index('assignee_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_report_items');
    }
};
