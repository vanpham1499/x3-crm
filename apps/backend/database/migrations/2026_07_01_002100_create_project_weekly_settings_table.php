<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_weekly_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->unique()->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('report_owner_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedTinyInteger('report_weekday');
            $table->decimal('monthly_budget', 15, 2)->default(0);
            $table->decimal('management_fee_rate', 5, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['report_owner_user_id', 'report_weekday', 'is_active', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_weekly_settings');
    }
};
