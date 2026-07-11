<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            if (! Schema::hasColumn('projects', 'quotation_id')) {
                $table->foreignId('quotation_id')->nullable()->after('customer_id')->constrained('quotations')->nullOnDelete();
                $table->index(['quotation_id', 'deleted_at']);
            }
        });

        Schema::table('contracts', function (Blueprint $table): void {
            if (! Schema::hasColumn('contracts', 'quotation_id')) {
                $table->foreignId('quotation_id')->nullable()->after('project_id')->constrained('quotations')->nullOnDelete();
            }

            if (! Schema::hasColumn('contracts', 'lead_id')) {
                $table->foreignId('lead_id')->nullable()->after('quotation_id')->constrained('leads')->nullOnDelete();
            }

            if (! Schema::hasColumn('contracts', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('lead_id')->constrained('customers')->nullOnDelete();
            }

            $table->index(['quotation_id', 'lead_id', 'customer_id']);
        });

        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'quotation_id')) {
                $table->foreignId('quotation_id')->nullable()->after('id')->constrained('quotations')->nullOnDelete();
            }

            if (! Schema::hasColumn('payments', 'lead_id')) {
                $table->foreignId('lead_id')->nullable()->after('quotation_id')->constrained('leads')->nullOnDelete();
            }

            if (! Schema::hasColumn('payments', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('lead_id')->constrained('customers')->nullOnDelete();
            }

            if (! Schema::hasColumn('payments', 'contract_id')) {
                $table->foreignId('contract_id')->nullable()->after('project_id')->constrained('contracts')->nullOnDelete();
            }

            if (! Schema::hasColumn('payments', 'status')) {
                $table->string('status', 50)->default('unmatched')->after('reconciled_status');
            }

            if (! Schema::hasColumn('payments', 'matched_at')) {
                $table->timestamp('matched_at')->nullable()->after('status');
            }

            if (! Schema::hasColumn('payments', 'webhook_payload')) {
                $table->json('webhook_payload')->nullable()->after('note');
            }

            $table->index(['quotation_id', 'lead_id', 'customer_id']);
            $table->index(['contract_id', 'status', 'matched_at']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            foreach (['quotation_id', 'lead_id', 'customer_id', 'contract_id'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropForeign([$column]);
                }
            }

            foreach (['quotation_id', 'lead_id', 'customer_id', 'contract_id', 'status', 'matched_at', 'webhook_payload'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('contracts', function (Blueprint $table): void {
            foreach (['quotation_id', 'lead_id', 'customer_id'] as $column) {
                if (Schema::hasColumn('contracts', $column)) {
                    $table->dropForeign([$column]);
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('projects', function (Blueprint $table): void {
            if (Schema::hasColumn('projects', 'quotation_id')) {
                $table->dropForeign(['quotation_id']);
                $table->dropColumn('quotation_id');
            }
        });
    }
};
