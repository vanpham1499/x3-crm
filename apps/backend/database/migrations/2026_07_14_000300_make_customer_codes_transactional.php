<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            if (DB::getDriverName() === 'pgsql') {
                DB::selectOne("SELECT pg_advisory_xact_lock(hashtext('x3crm.customer_code'))");
            }

            $nextNumber = 1;
            $customers = DB::table('customers')
                ->whereNull('deleted_at')
                ->whereRaw("customer_code ~ '^[0-9]+$'")
                ->orderBy('id')
                ->get(['id', 'customer_code']);

            foreach ($customers as $customer) {
                $currentNumber = (int) $customer->customer_code;
                $candidate = $this->formatCode($nextNumber);

                while (DB::table('customers')
                    ->where('customer_code', $candidate)
                    ->where('id', '<>', $customer->id)
                    ->exists()
                ) {
                    $nextNumber++;
                    $candidate = $this->formatCode($nextNumber);
                }

                if ($currentNumber === $nextNumber) {
                    $nextNumber++;

                    continue;
                }

                if ($currentNumber < $nextNumber || $this->hasBusinessReferences((int) $customer->id)) {
                    $nextNumber = max($nextNumber, $currentNumber + 1);

                    continue;
                }

                $oldCode = (string) $customer->customer_code;

                DB::table('customers')
                    ->where('id', $customer->id)
                    ->update([
                        'customer_code' => $candidate,
                        'updated_at' => now(),
                    ]);

                $this->updateTimelineSnapshots((int) $customer->id, $oldCode, $candidate);
                $nextNumber++;
            }

            if (DB::getDriverName() === 'pgsql') {
                DB::statement('DROP SEQUENCE IF EXISTS customer_code_sequence');
            }
        });
    }

    public function down(): void
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
        DB::selectOne("SELECT setval('customer_code_sequence', ?, false) AS value", [
            ((int) ($maxCode ?: 0)) + 1,
        ]);
    }

    private function hasBusinessReferences(int $customerId): bool
    {
        foreach (['projects', 'quotations', 'payments', 'contracts'] as $table) {
            if (DB::table($table)->where('customer_id', $customerId)->exists()) {
                return true;
            }
        }

        return false;
    }

    private function updateTimelineSnapshots(int $customerId, string $oldCode, string $newCode): void
    {
        $timelines = DB::table('customer_timelines')
            ->where('customer_id', $customerId)
            ->get(['id', 'content']);

        foreach ($timelines as $timeline) {
            $content = json_decode((string) $timeline->content, true);

            if (! is_array($content)) {
                continue;
            }

            $updatedContent = $this->replaceCustomerCode(
                $content,
                $customerId,
                $oldCode,
                $newCode,
            );

            if ($updatedContent === $content) {
                continue;
            }

            DB::table('customer_timelines')
                ->where('id', $timeline->id)
                ->update([
                    'content' => json_encode(
                        $updatedContent,
                        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                    ),
                    'updated_at' => now(),
                ]);
        }
    }

    private function replaceCustomerCode(
        array $content,
        int $customerId,
        string $oldCode,
        string $newCode,
    ): array {
        if (isset($content['customer']) && is_array($content['customer'])) {
            $customer = $content['customer'];

            if (
                (string) ($customer['id'] ?? '') === (string) $customerId
                && (string) ($customer['code'] ?? '') === $oldCode
            ) {
                $content['customer']['code'] = $newCode;
            }
        }

        foreach ($content as $key => $value) {
            if (is_array($value)) {
                $content[$key] = $this->replaceCustomerCode($value, $customerId, $oldCode, $newCode);
            }
        }

        return $content;
    }

    private function formatCode(int $number): string
    {
        return str_pad((string) $number, 3, '0', STR_PAD_LEFT);
    }
};
