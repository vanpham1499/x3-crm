<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->string('project_code', 100)->unique();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->string('project_name');
            $table->foreignId('status_id')->constrained('statuses')->restrictOnDelete();
            $table->foreignId('manager_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('sales_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('zalo_group')->nullable();
            $table->text('plan_link')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['customer_id', 'service_id', 'status_id', 'manager_user_id', 'deleted_at']);
            $table->index(['manager_user_id', 'sales_user_id']);
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
