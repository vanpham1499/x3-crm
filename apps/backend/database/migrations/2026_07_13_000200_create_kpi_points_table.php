<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kpi_points', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('entry_date');
            $table->string('category', 60);
            $table->string('type', 10)->default('penalty');
            $table->decimal('score', 6, 2);
            $table->string('customer_ref', 255)->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['user_id', 'entry_date', 'deleted_at']);
            $table->index(['category', 'deleted_at']);
            $table->index(['is_approved', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kpi_points');
    }
};
