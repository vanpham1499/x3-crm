<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $configuredAccounts = $this->configuredAccounts();

        if ($configuredAccounts === []) {
            return;
        }

        DB::table('payments')
            ->whereNotNull('webhook_payload')
            ->orderBy('id')
            ->chunkById(200, function ($payments) use ($configuredAccounts): void {
                foreach ($payments as $payment) {
                    $payload = $this->decodePayload($payment->webhook_payload);
                    $receivingAccount = $this->configuredAccountFromPayload($payload, $configuredAccounts);

                    if ($receivingAccount === null) {
                        continue;
                    }

                    $updates = [];

                    if ($receivingAccount !== trim((string) $payment->bank_account)) {
                        $updates['bank_account'] = $receivingAccount;
                    }

                    if (
                        $this->subAccountFromPayload($payload) === $receivingAccount
                        && trim((string) $payment->customer_code_text) === $receivingAccount
                    ) {
                        $updates['customer_code_text'] = null;
                    }

                    if ($updates !== []) {
                        DB::table('payments')->where('id', $payment->id)->update($updates);
                    }
                }
            });
    }

    public function down(): void
    {
        DB::table('payments')
            ->whereNotNull('webhook_payload')
            ->orderBy('id')
            ->chunkById(200, function ($payments): void {
                foreach ($payments as $payment) {
                    $payload = $this->decodePayload($payment->webhook_payload);
                    $legacyAccount = trim((string) ($payload['accountNumber'] ?? $payload['account_number'] ?? ''));
                    $subAccount = $this->subAccountFromPayload($payload);
                    $updates = [];

                    if ($legacyAccount !== '' && $legacyAccount !== trim((string) $payment->bank_account)) {
                        $updates['bank_account'] = $legacyAccount;
                    }

                    if ($subAccount !== '' && $payment->customer_code_text === null) {
                        $updates['customer_code_text'] = $subAccount;
                    }

                    if ($updates !== []) {
                        DB::table('payments')->where('id', $payment->id)->update($updates);
                    }
                }
            });
    }

    /** @return array<string, true> */
    private function configuredAccounts(): array
    {
        return DB::table('options')
            ->where('group', 'company_bank_account')
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->pluck('value')
            ->map(fn ($value): string => trim((string) $value))
            ->filter()
            ->mapWithKeys(fn (string $value): array => [$value => true])
            ->all();
    }

    /** @return array<string, mixed> */
    private function decodePayload(mixed $payload): array
    {
        if (is_array($payload)) {
            return $payload;
        }

        $decoded = json_decode((string) $payload, true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed> $payload @param array<string, true> $configuredAccounts */
    private function configuredAccountFromPayload(array $payload, array $configuredAccounts): ?string
    {
        foreach (['bank_account', 'bankAccount', 'subAccount', 'sub_account', 'accountNumber', 'account_number'] as $key) {
            $candidate = trim((string) ($payload[$key] ?? ''));

            if ($candidate !== '' && isset($configuredAccounts[$candidate])) {
                return $candidate;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $payload */
    private function subAccountFromPayload(array $payload): string
    {
        return trim((string) ($payload['subAccount'] ?? $payload['sub_account'] ?? ''));
    }
};
