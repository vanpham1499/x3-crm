<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Durable commands; only the archive worker applies them under its owner lock. */
class ZaloTeamArchiveRetry
{
    private function files(string $owner, array $v)
    {
        $files = DB::table('zt_archive_assets')->where('owner', $owner)->whereIn('state', ['pending', 'error']);
        if (($v['retryMode'] ?? 'all') === 'scheduled') {
            $files->where('state', 'error')->where('attempts', '<', 5);
        }
        if (! empty($v['assetId'])) {
            $files->where('id', $v['assetId']);
        }
        if (! empty($v['date']) || ! empty($v['accountId']) || isset($v['allowedAccountIds'])) {
            $messages = DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')->where('s.owner', $owner)->where('o.deleted', false);
            if (isset($v['allowedAccountIds'])) $messages->whereIn('s.account_id', $v['allowedAccountIds']);
            if (! empty($v['accountId'])) {
                $messages->where('s.account_id', $v['accountId']);
            }
            if (! empty($v['date'])) {
                $start = CarbonImmutable::parse($v['date'], 'Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
                $messages->where('m.time', '>=', $start)->where('m.time', '<', $start + 86400000);
            }
            $files->whereIn('message_id', $messages->select('m.id'));
        }

        return $files;
    }

    public function request(string $owner, array $v): array
    {
        $selection = array_intersect_key($v, array_flip(['retryMode', 'assetId', 'accountId', 'date', 'allowedAccountIds']));
        ksort($selection);
        $json = ZaloTeamArchive::json($selection);
        $id = $v['requestId'] ?? (string) Str::uuid();
        DB::transaction(function () use ($id, $owner, $selection, $json) {
            $created = DB::table('zt_archive_file_retries')->insertOrIgnore(['id' => $id, 'owner' => $owner, 'selection' => $json, 'matched' => $this->files($owner, $selection)->count(), 'created_at' => now()]);
            if ($created) {
                app(ZaloTeamPcRecovery::class)->seed($owner, $this->files($owner, $selection)->select('id'), true, isset($selection['accountId']) ? (int) $selection['accountId'] : null);
            }
        });
        $r = DB::table('zt_archive_file_retries')->where('id', $id)->first();
        abort_unless($r->owner === $owner && json_decode($r->selection, true) === $selection, 409, 'Yêu cầu thử lại đã tồn tại với phạm vi khác.');

        return ['retryQueued' => (int) $r->matched, 'retryRequestId' => $id];
    }

    public function apply(string $owner): void
    {
        foreach (DB::table('zt_archive_file_retries')->where('owner', $owner)->whereNull('applied_at')->orderBy('created_at')->limit(30)->get() as $r) {
            DB::transaction(function () use ($owner, $r) {
                // No success is reset, including a file completed after the click.
                // Expired/absent locators need a new PC source, not the same HTTP request.
                // Keep their evidence visible while the durable PC check runs. Importing
                // a fresh URL or verified local blob already reactivates/satisfies them.
                $count = $this->files($owner, json_decode($r->selection, true))->where('state', 'error')
                    ->where('url', '!=', '')
                    ->where(fn ($q) => $q->whereNull('error')->orWhere(fn ($q) => $q->where('error', 'not like', '%HTTP 404%')->where('error', 'not like', '%HTTP 410%')))
                    ->update(['state' => 'pending', 'attempts' => 0, 'retry_at' => null, 'error' => null]);
                DB::table('zt_archive_file_retries')->where('id', $r->id)->update(['queued' => $count, 'applied_at' => now()]);
            });
        }
    }
}
