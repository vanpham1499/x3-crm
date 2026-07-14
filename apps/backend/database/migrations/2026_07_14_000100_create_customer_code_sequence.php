<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $maxCode = DB::table('customers')
            ->whereNotNull('customer_code')
            ->whereRaw("customer_code ~ '^[0-9]+$'")
            ->selectRaw('MAX(CAST(customer_code AS INTEGER)) as max_code')
            ->value('max_code');

        DB::statement('CREATE SEQUENCE IF NOT EXISTS customer_code_sequence');

        $state = DB::selectOne('SELECT last_value, is_called FROM customer_code_sequence');
        $sequenceNext = $state->is_called ? ((int) $state->last_value) + 1 : (int) $state->last_value;
        $nextCode = max(((int) ($maxCode ?: 0)) + 1, $sequenceNext);

        DB::selectOne("SELECT setval('customer_code_sequence', ?, false) AS value", [$nextCode]);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP SEQUENCE IF EXISTS customer_code_sequence');
        }
    }
};
