<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->foreignId('lead_id')->nullable()->change();
        });

        DB::statement(<<<'SQL'
            UPDATE quotations
            SET
                project_id = projects.id,
                customer_id = projects.customer_id,
                service_id = projects.service_id,
                updated_at = CURRENT_TIMESTAMP
            FROM projects
            WHERE projects.quotation_id = quotations.id
              AND projects.deleted_at IS NULL
              AND quotations.project_id IS NULL
        SQL);
    }

    public function down(): void
    {
        DB::table('quotations')
            ->whereNull('lead_id')
            ->whereNotNull('customer_id')
            ->orderBy('id')
            ->chunkById(100, function ($quotations): void {
                foreach ($quotations as $quotation) {
                    $leadId = DB::table('customers')
                        ->where('id', $quotation->customer_id)
                        ->value('lead_id');

                    if ($leadId) {
                        DB::table('quotations')
                            ->where('id', $quotation->id)
                            ->update(['lead_id' => $leadId]);
                    }
                }
            });

        if (! DB::table('quotations')->whereNull('lead_id')->exists()) {
            Schema::table('quotations', function (Blueprint $table): void {
                $table->foreignId('lead_id')->nullable(false)->change();
            });
        }
    }
};
