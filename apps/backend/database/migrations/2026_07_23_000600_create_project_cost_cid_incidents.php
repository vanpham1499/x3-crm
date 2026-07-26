<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_cost_cid_incidents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_cost_id')->constrained('project_costs')->cascadeOnDelete();
            $table->date('stopped_at');
            $table->decimal('spent_amount', 15, 2)->default(0);
            $table->decimal('unrecoverable_amount', 15, 2)->default(0);
            $table->decimal('released_amount', 15, 2)->default(0);
            $table->string('status', 20)->default('pending');
            $table->text('note')->nullable();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reported_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_cost_id', 'status']);
            $table->index(['status', 'stopped_at']);
        });

        DB::statement(
            "CREATE UNIQUE INDEX project_cost_cid_incidents_active_unique
             ON project_cost_cid_incidents (project_cost_id)
             WHERE deleted_at IS NULL AND status IN ('pending', 'confirmed')",
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('project_cost_cid_incidents');
    }
};
