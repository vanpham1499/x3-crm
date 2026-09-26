<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Serialize the short financial write transactions on PostgreSQL. Acquired before
 * any row locks, also in webhook/refund/funding paths, to prevent void-vs-receipt
 * phantoms and opposite lock orders. Transaction-scoped; never a persistent lock.
 */
final class FinancialMutation
{
    public static function run(callable $callback): mixed
    {
        return DB::transaction(function () use ($callback) {
            if (DB::connection()->getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(88124019)');
            }

            return $callback();
        }, 3);
    }
}
