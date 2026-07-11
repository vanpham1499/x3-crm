<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_weekly_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->unique()->constrained('projects')->cascadeOnDelete();
            $table->foreignId('report_owner_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedTinyInteger('report_weekday');
            $table->decimal('monthly_budget', 15, 2)->default(0);
            $table->decimal('management_fee_rate', 5, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['report_owner_user_id', 'report_weekday', 'is_active', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_weekly_settings');
    }
};
