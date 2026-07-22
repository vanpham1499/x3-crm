<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_refunds', function (Blueprint $table): void {
            $table->foreignId('payment_allocation_id')
                ->nullable()
                ->after('payment_id')
                ->constrained('payment_allocations')
                ->nullOnDelete();
            $table->foreignId('quotation_id')
                ->nullable()
                ->after('payment_allocation_id')
                ->constrained('quotations')
                ->nullOnDelete();
            $table->foreignId('customer_id')
                ->nullable()
                ->after('quotation_id')
                ->constrained('customers')
                ->nullOnDelete();
            $table->foreignId('project_id')
                ->nullable()
                ->after('customer_id')
                ->constrained('projects')
                ->nullOnDelete();
            $table->string('refund_type', 30)->default('overpayment')->after('project_id');
            $table->string('status', 20)->default('completed')->after('refund_type');
            $table->timestamp('scheduled_at')->nullable()->after('amount');
            $table->timestamp('completed_at')->nullable()->after('refunded_at');
            $table->string('recipient_bank', 255)->nullable()->after('recipient_account');
            $table->string('reason', 500)->nullable()->after('recipient_bank');

            $table->index(['status', 'scheduled_at', 'deleted_at'], 'payment_refunds_status_date_idx');
            $table->index(['quotation_id', 'status', 'deleted_at'], 'payment_refunds_quotation_idx');
            $table->index(['customer_id', 'status', 'deleted_at'], 'payment_refunds_customer_idx');
        });

        DB::table('payment_refunds')
            ->whereNull('deleted_at')
            ->update([
                'refund_type' => 'overpayment',
                'status' => 'completed',
                'scheduled_at' => DB::raw('refunded_at'),
                'completed_at' => DB::raw('refunded_at'),
            ]);

        DB::statement(<<<'SQL'
            UPDATE payment_refunds AS refunds
            SET customer_id = payments.customer_id,
                project_id = payments.project_id
            FROM payments
            WHERE refunds.payment_id = payments.id
              AND refunds.deleted_at IS NULL
            SQL);
    }

    public function down(): void
    {
        Schema::table('payment_refunds', function (Blueprint $table): void {
            $table->dropIndex('payment_refunds_status_date_idx');
            $table->dropIndex('payment_refunds_quotation_idx');
            $table->dropIndex('payment_refunds_customer_idx');
            $table->dropConstrainedForeignId('payment_allocation_id');
            $table->dropConstrainedForeignId('quotation_id');
            $table->dropConstrainedForeignId('customer_id');
            $table->dropConstrainedForeignId('project_id');
            $table->dropColumn([
                'refund_type',
                'status',
                'scheduled_at',
                'completed_at',
                'recipient_bank',
                'reason',
            ]);
        });
    }
};
