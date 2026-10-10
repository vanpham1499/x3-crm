<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ZaloTeamPhoneSync
{
    private const ACTIVE = ['queued', 'starting', 'running'];

    public function __construct(private ZaloTeamArchive $archive, private ZaloTeamCatalog $catalog) {}

    private function scope(User $u, int $accountId): array
    {
        $accounts = $this->catalog->command($u, ['action' => 'status'])['accounts'] ?? [];
        $account = collect($accounts)->firstWhere('id', $accountId);
        abort_unless($account && ($account['status'] ?? '') === 'connected', 409, 'Tài khoản chưa kết nối Zalo Web.');

        return $account;
    }

    public function command(User $u, array $v): array
    {
        $owner = ZaloTeamArchive::owner($u);
        $accountId = (int) $v['accountId'];
        $account = $v['kind'] === 'phone-cancel' ? null : $this->scope($u, $accountId);
        if ($v['kind'] === 'phone-status') {
            $capabilities = $this->catalog->command($u, ['action' => 'history-sync', 'accountId' => $accountId, 'sync' => ['operation' => 'status']]);

            return ['capabilities' => $capabilities, 'job' => $this->latest($owner, $accountId)];
        }

        return $this->archive->withLock(hash('sha256', $owner.':phone-sync'), function () use ($u, $v, $owner, $accountId, $account) {
            $q = DB::table('zt_phone_sync_jobs')->where('owner', $owner)->where('account_id', $accountId);
            if ($v['kind'] === 'phone-cancel') {
                abort_unless((clone $q)->where('id', $v['requestId'])->exists(), 404, 'Không tìm thấy lượt đồng bộ.');
                $q->where('id', $v['requestId'])->whereIn('state', self::ACTIVE)->update(['cancel_requested' => true]);
            } else {
                $existing = DB::table('zt_phone_sync_jobs')->where('id', $v['requestId'])->first();
                if ($existing) {
                    abort_unless($existing->owner === $owner && (int) $existing->account_id === $accountId && $existing->external_id === $account['externalId'], 409, 'Yêu cầu không còn thuộc phiên này.');
                } else {
                    abort_if((clone $q)->whereIn('state', self::ACTIVE)->exists(), 409, 'Tài khoản đang có một lượt đồng bộ.');
                    $settings = $this->archive->settings($u);
                    abort_unless($settings->enabled && in_array($accountId, json_decode($settings->accounts, true), true), 409, 'Bật đồng bộ nền và lưu lựa chọn tài khoản trong tab Zalo Web trước.');
                    abort_unless($settings->heartbeat && now()->diffInSeconds($settings->heartbeat, true) < 180, 409, 'Bộ lưu kho chưa hoạt động. Khởi động worker đồng bộ trước.');
                    $caps = $this->catalog->command($u, ['action' => 'history-sync', 'accountId' => $accountId, 'sync' => ['operation' => 'status']]);
                    abort_unless($caps['available'] ?? false, 409, 'Phiên Web chưa sẵn sàng nhận dữ liệu từ điện thoại.');
                    DB::table('zt_phone_sync_jobs')->insert(['id' => $v['requestId'], 'owner' => $owner, 'account_id' => $accountId,
                        'external_id' => $account['externalId'], 'state' => 'queued', 'result' => ZaloTeamArchive::json(['ranges' => $caps['ranges'] ?? null]),
                        'created_at' => now(), 'updated_at' => now()]);
                }
            }

            return ['job' => $this->latest($owner, $accountId)];
        });
    }

    private function latest(string $owner, int $accountId): ?array
    {
        $job = DB::table('zt_phone_sync_jobs')->where('owner', $owner)->where('account_id', $accountId)->orderByDesc('created_at')->orderByDesc('id')->first();
        if (! $job) {
            return null;
        }

        return ['id' => $job->id, 'state' => $job->state, 'cancelRequested' => (bool) $job->cancel_requested,
            'archiveRequested' => (bool) $job->archive_requested, 'result' => json_decode($job->result ?? '{}', true), 'updatedAt' => $job->updated_at];
    }

    // Called under the archive lock. Closing the Team tab does not stop collection.
    public function tick(User $u): void
    {
        if (! Schema::hasTable('zt_phone_sync_jobs')) {
            return;
        }
        try {
            $this->archive->withLock(hash('sha256', ZaloTeamArchive::owner($u).':phone-sync'), fn () => $this->processJobs($u));
        } catch (HttpException $e) {
            if ($e->getStatusCode() !== 409) {
                throw $e;
            }
        }
    }

    private function processJobs(User $u): void
    {
        $owner = ZaloTeamArchive::owner($u);
        $jobs = DB::table('zt_phone_sync_jobs')->where('owner', $owner)->whereIn('state', self::ACTIVE)->orderBy('created_at')->get();
        foreach ($jobs as $job) {
            $result = json_decode($job->result ?? '{}', true);
            try {
                if ($job->state === 'queued' && $job->cancel_requested) {
                    $state = 'cancelled';
                } else {
                    $accounts = $this->catalog->command($u, ['action' => 'status'])['accounts'] ?? [];
                    $account = collect($accounts)->firstWhere('id', (int) $job->account_id);
                    if (! $account || $account['externalId'] !== $job->external_id || ($account['status'] ?? '') !== 'connected') {
                        $this->saveResult($job, 'interrupted', $result);

                        continue;
                    }
                    $operation = $job->cancel_requested ? 'cancel' : ($job->state === 'queued' ? 'start' : 'status');
                    // Persist intent before calling the source. An uncertain start must never be resent automatically.
                    if ($operation === 'start') {
                        DB::table('zt_phone_sync_jobs')->where('id', $job->id)->update(['state' => 'starting', 'updated_at' => now()]);
                    }
                    $reply = $this->catalog->command($u, ['action' => 'history-sync', 'accountId' => (int) $job->account_id,
                        'sync' => ['operation' => $operation, 'id' => $job->id]]);
                    $native = $reply['job'] ?? null;
                    if (($native['id'] ?? null) !== $job->id) {
                        $native = null;
                    }
                    $state = $native['state'] ?? 'interrupted';
                    if (! in_array($state, ['running', 'received', 'no_changes', 'failed', 'cancelled', 'interrupted'], true)) {
                        $state = 'interrupted';
                    }
                    $result = ['ranges' => $result['ranges'] ?? $reply['ranges'] ?? null, 'transfer' => $native];
                }
                $this->saveResult($job, $state, $result);
            } catch (\Throwable) {
                // Retain intent and the last confirmed state through transient connector failures.
                // Never translate a timeout into success or start a second transfer.
                DB::table('zt_phone_sync_jobs')->where('id', $job->id)->update(['result' => ZaloTeamArchive::json($result + ['connectionWarning' => true])]);
            }
        }
    }

    private function saveResult(object $job, string $state, array $result): void
    {
        DB::transaction(function () use ($job, $state, $result) {
            $terminal = ! in_array($state, self::ACTIVE, true);
            $mayHaveReceived = $state !== 'no_changes' && ! ($job->state === 'queued' && $state === 'cancelled');
            if ($terminal && $mayHaveReceived && ! $job->archive_requested) {
                // Phone data can fill non-tail gaps. Replay metadata pages, preserving versions/blobs.
                DB::table('zt_archive_sources')->where('owner', $job->owner)->where('account_id', $job->account_id)->where('external_id', $job->external_id)
                    ->update(['history_done' => false, 'cursor' => null, 'last_attempt' => null]);
            }
            DB::table('zt_phone_sync_jobs')->where('id', $job->id)->update(['state' => $state, 'result' => ZaloTeamArchive::json($result),
                'archive_requested' => $terminal, 'updated_at' => now()]);
        });
    }
}
