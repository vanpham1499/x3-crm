<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->string('reconciliation_result', 40)->nullable()->after('invoice_number');
            $table->string('invoice_status', 30)->nullable()->after('reconciliation_result');
            $table->string('invoice_recipient_type', 30)->nullable()->after('invoice_status');
            $table->string('invoice_recipient_name')->nullable()->after('invoice_recipient_type');
            $table->text('reconciliation_note')->nullable()->after('invoice_recipient_name');
            $table->index(['reconciliation_result', 'deleted_at']);
            $table->index(['invoice_status', 'deleted_at']);
        });

        Schema::create('project_cost_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_cost_id')->constrained('project_costs')->cascadeOnDelete();
            $table->string('adjustment_type', 50);
            $table->string('status', 20)->default('completed');
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_cost_id', 'status']);
            $table->index(['adjustment_type', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_cost_adjustments');

        Schema::table('project_costs', function (Blueprint $table): void {
            $table->dropIndex(['reconciliation_result', 'deleted_at']);
            $table->dropIndex(['invoice_status', 'deleted_at']);
            $table->dropColumn([
                'reconciliation_result',
                'invoice_status',
                'invoice_recipient_type',
                'invoice_recipient_name',
                'reconciliation_note',
            ]);
        });
    }
};
