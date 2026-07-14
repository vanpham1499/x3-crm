<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->foreignId('quotation_id')->constrained('quotations')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamp('allocated_at')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['payment_id', 'deleted_at'], 'payment_allocations_payment_idx');
            $table->index(['quotation_id', 'deleted_at'], 'payment_allocations_quotation_idx');
            $table->index(['project_id', 'deleted_at'], 'payment_allocations_project_idx');
        });

        Schema::create('payment_refunds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamp('refunded_at');
            $table->string('recipient_name')->nullable();
            $table->string('recipient_account', 100)->nullable();
            $table->string('reference', 255)->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['payment_id', 'deleted_at'], 'payment_refunds_payment_idx');
            $table->index(['refunded_at', 'deleted_at'], 'payment_refunds_date_idx');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->decimal('refunded_amount', 15, 2)->default(0)->after('allocated_amount');
            $table->string('receipt_type', 30)->default('customer')->after('status');
            $table->index(['receipt_type', 'deleted_at'], 'payments_receipt_type_idx');
        });

        DB::table('payments')
            ->whereNotNull('quotation_id')
            ->whereNull('deleted_at')
            ->where('allocated_amount', '>', 0)
            ->orderBy('id')
            ->chunkById(100, function ($payments): void {
                $quotationIds = $payments->pluck('quotation_id')->filter()->unique()->values();
                $quotations = DB::table('quotations')
                    ->whereIn('id', $quotationIds)
                    ->get(['id', 'customer_id', 'project_id'])
                    ->keyBy('id');

                foreach ($payments as $payment) {
                    $quotation = $quotations->get($payment->quotation_id);

                    if (! $quotation) {
                        continue;
                    }

                    DB::table('payment_allocations')->insert([
                        'payment_id' => $payment->id,
                        'quotation_id' => $payment->quotation_id,
                        'customer_id' => $quotation->customer_id,
                        'project_id' => $quotation->project_id,
                        'amount' => $payment->allocated_amount,
                        'allocated_at' => $payment->matched_at
                            ?? $payment->transaction_at
                            ?? $payment->created_at,
                        'note' => 'Dữ liệu phân bổ được chuyển từ luồng thanh toán cũ',
                        'created_by' => $payment->created_by,
                        'created_at' => $payment->created_at ?? now(),
                        'updated_by' => $payment->updated_by,
                        'updated_at' => $payment->updated_at ?? now(),
                    ]);
                }
            });

        DB::table('payments')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->chunkById(100, function ($payments): void {
                $paymentIds = $payments->pluck('id');
                $allocationTotals = DB::table('payment_allocations')
                    ->whereIn('payment_id', $paymentIds)
                    ->whereNull('deleted_at')
                    ->selectRaw('payment_id, COALESCE(SUM(amount), 0) AS allocated_amount')
                    ->groupBy('payment_id')
                    ->pluck('allocated_amount', 'payment_id');

                foreach ($payments as $payment) {
                    $allocatedAmount = round((float) ($allocationTotals[$payment->id] ?? 0), 2);
                    $availableAmount = round(max(0, (float) $payment->amount - $allocatedAmount), 2);
                    $status = match (true) {
                        $allocatedAmount > 0 && $availableAmount > 0 => 'partially_allocated',
                        $allocatedAmount > 0 => 'allocated',
                        (bool) $payment->quotation_id => 'matched_quotation',
                        (bool) $payment->project_id => 'matched_project',
                        (bool) $payment->customer_id => 'matched_customer',
                        default => 'unmatched',
                    };

                    DB::table('payments')->where('id', $payment->id)->update([
                        'allocated_amount' => $allocatedAmount,
                        'refunded_amount' => 0,
                        'excess_amount' => $availableAmount,
                        'receipt_type' => 'customer',
                        'status' => $status,
                        'reconciled_status' => $allocatedAmount > 0 ? 'allocated' : $status,
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropIndex('payments_receipt_type_idx');
            $table->dropColumn(['refunded_amount', 'receipt_type']);
        });

        Schema::dropIfExists('payment_refunds');
        Schema::dropIfExists('payment_allocations');
    }
};
