<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table): void {
            $table->id();
            $table->string('lead_code', 50)->unique();
            $table->string('customer_name');
            $table->foreignId('status_id')->constrained('statuses')->restrictOnDelete();
            $table->date('occurred_date')->nullable();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('source_id')->nullable()->constrained('customer_sources')->nullOnDelete();
            $table->string('interested_service_text')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('website')->nullable();
            $table->string('industry')->nullable();
            $table->text('plan_link')->nullable();
            $table->text('zalo_group')->nullable();
            $table->text('note')->nullable();
            $table->date('closed_date')->nullable();
            $table->unsignedBigInteger('converted_customer_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['status_id', 'assigned_user_id', 'source_id', 'deleted_at']);
            $table->index(['occurred_date', 'closed_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
