<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_costs', function (Blueprint $table): void {
            $table->boolean('uses_payment_ledger')->default(false);
            $table->date('work_period')->nullable();
        });
        Schema::create('partner_finance_recognitions', function (Blueprint $table): void {
            $table->id();
            $table->string('entity_type', 20);
            $table->unsignedBigInteger('entity_id');
            $table->foreignId('project_id')->constrained('projects');
            $table->json('allocations');
            $table->decimal('amount', 18, 2);
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedBigInteger('confirmed_by');
            $table->timestamps();
            $table->unique(['entity_type', 'entity_id'], 'partner_recognition_entity_unique');
        });
        Schema::create('partner_cost_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_cost_id')->constrained('project_costs');
            $table->uuid('request_id')->unique();
            $table->date('paid_on');
            $table->decimal('amount', 18, 2);
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_legacy')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->unsignedBigInteger('voided_by')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestamps();
            $table->index(['project_cost_id', 'voided_at']);
        });
        Schema::create('partner_finance_periods', function (Blueprint $table): void {
            $table->string('period', 7)->primary();
            $table->timestamp('locked_at')->nullable();
            $table->unsignedBigInteger('locked_by')->nullable();
            $table->timestamps();
        });
        Schema::create('partner_finance_audits', function (Blueprint $table): void {
            $table->id();
            $table->string('entity_type', 20);
            $table->string('entity_id', 30);
            $table->string('action', 30);
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->text('reason');
            $table->unsignedBigInteger('actor_id');
            $table->timestamp('created_at');
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_finance_audits');
        Schema::dropIfExists('partner_finance_periods');
        Schema::dropIfExists('partner_cost_payments');
        Schema::dropIfExists('partner_finance_recognitions');
        Schema::table('project_costs', fn (Blueprint $table) => $table->dropColumn(['uses_payment_ledger', 'work_period']));
    }
};
