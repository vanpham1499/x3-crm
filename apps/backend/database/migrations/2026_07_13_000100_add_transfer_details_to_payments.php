<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'transaction_at')) {
                $table->dateTime('transaction_at')->nullable()->after('transaction_date');
                $table->index(['transaction_at', 'deleted_at'], 'payments_transaction_at_idx');
            }

            if (! Schema::hasColumn('payments', 'sender_name')) {
                $table->string('sender_name', 255)->nullable()->after('bank_account');
            }
        });

        DB::table('payments')
            ->orderBy('id')
            ->chunkById(100, function ($payments): void {
                foreach ($payments as $payment) {
                    $payload = $this->decodePayload($payment->webhook_payload ?? null);
                    $transactionAt = $payload['transactionDate']
                        ?? $payload['transaction_at']
                        ?? $payload['transactionAt']
                        ?? null;
                    $senderName = $payload['senderName']
                        ?? $payload['sender_name']
                        ?? null;
                    $description = trim((string) ($payload['description'] ?? ''));
                    $content = trim((string) ($payload['content'] ?? $payment->transaction_content ?? ''));

                    if (! $senderName && $description !== '' && $this->compact($description) !== $this->compact($content)) {
                        $senderName = $description;
                    }
                    $update = [];

                    if ($transactionAt) {
                        try {
                            $update['transaction_at'] = Carbon::parse($transactionAt)->format('Y-m-d H:i:s');
                        } catch (Throwable) {
                            // Keep the old transaction date when the provider value is invalid.
                        }
                    } elseif ($payment->transaction_date) {
                        $update['transaction_at'] = Carbon::parse($payment->transaction_date)
                            ->startOfDay()
                            ->format('Y-m-d H:i:s');
                    }

                    if (is_string($senderName) && trim($senderName) !== '') {
                        $update['sender_name'] = mb_substr(trim($senderName), 0, 255);
                    }

                    if ($update !== []) {
                        DB::table('payments')->where('id', $payment->id)->update($update);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (Schema::hasColumn('payments', 'transaction_at')) {
                $table->dropIndex('payments_transaction_at_idx');
                $table->dropColumn('transaction_at');
            }

            if (Schema::hasColumn('payments', 'sender_name')) {
                $table->dropColumn('sender_name');
            }
        });
    }

    private function decodePayload(mixed $payload): array
    {
        if (is_array($payload)) {
            return $payload;
        }

        if (! is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function compact(string $value): string
    {
        return preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($value)) ?: '';
    }
};
