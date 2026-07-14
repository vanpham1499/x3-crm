<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('customers')
            ->whereNotNull('lead_id')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get(['id', 'lead_id'])
            ->each(function (object $customer): void {
                DB::table('leads')
                    ->where('id', $customer->lead_id)
                    ->whereNull('converted_customer_id')
                    ->update([
                        'converted_customer_id' => $customer->id,
                        'updated_at' => now(),
                    ]);

                $quotationIds = DB::table('quotations')
                    ->where('lead_id', $customer->lead_id)
                    ->whereNull('deleted_at')
                    ->pluck('id');

                DB::table('quotations')
                    ->whereIn('id', $quotationIds)
                    ->whereNull('customer_id')
                    ->update([
                        'customer_id' => $customer->id,
                        'updated_at' => now(),
                    ]);

                DB::table('payments')
                    ->whereIn('quotation_id', $quotationIds)
                    ->whereNull('customer_id')
                    ->whereNull('deleted_at')
                    ->update([
                        'customer_id' => $customer->id,
                        'updated_at' => now(),
                    ]);

                DB::table('contracts')
                    ->where('lead_id', $customer->lead_id)
                    ->whereNull('customer_id')
                    ->whereNull('deleted_at')
                    ->update([
                        'customer_id' => $customer->id,
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        // The backfilled links are valid CRM relationships and must not be removed on rollback.
    }
};
