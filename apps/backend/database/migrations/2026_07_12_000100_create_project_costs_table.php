<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_costs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('quotation_id')->nullable()->constrained('quotations')->nullOnDelete();
            $table->string('entry_type', 30);
            $table->date('transaction_date')->nullable();
            $table->string('status', 30)->default('pending');
            $table->string('cid', 100)->nullable();
            $table->string('ad_account')->nullable();
            $table->foreignId('bank_account_option_id')->nullable()->constrained('options')->nullOnDelete();
            $table->foreignId('partner_option_id')->nullable()->constrained('options')->nullOnDelete();
            $table->decimal('amount_before_vat', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->string('acceptance_status', 30)->nullable();
            $table->string('input_invoice_status', 30)->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('legacy_google_ad_account_id')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['project_id', 'entry_type', 'transaction_date']);
            $table->index(['project_id', 'status', 'deleted_at']);
            $table->index(['quotation_id', 'deleted_at']);
        });

        if (! Schema::hasTable('google_ad_accounts')) {
            return;
        }

        DB::table('google_ad_accounts')
            ->orderBy('id')
            ->chunkById(100, function ($accounts): void {
                foreach ($accounts as $account) {
                    DB::table('project_costs')->insert([
                        'project_id' => $account->project_id,
                        'entry_type' => 'ad_spend',
                        'transaction_date' => $account->topup_date,
                        'status' => 'completed',
                        'cid' => $account->cid,
                        'ad_account' => $account->ad_account,
                        'amount_before_vat' => $account->topup_amount ?? 0,
                        'vat_rate' => 0,
                        'vat_amount' => 0,
                        'discount_amount' => 0,
                        'total_amount' => $account->topup_amount ?? 0,
                        'note' => $account->note,
                        'legacy_google_ad_account_id' => $account->id,
                        'created_by' => $account->created_by,
                        'created_at' => $account->created_at,
                        'updated_at' => $account->updated_at,
                        'updated_by' => $account->updated_by,
                        'deleted_by' => $account->deleted_by,
                        'deleted_at' => $account->deleted_at,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_costs');
    }
};
