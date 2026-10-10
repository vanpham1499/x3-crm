<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** One durable PC check per attachment/source, renewed only by an explicit retry. */
class ZaloTeamPcRecovery
{
    public function seed(string $owner, $assets = null, bool $retry = false, ?int $account = null): int
    {
        $assets ??= DB::table('zt_archive_assets')->where('owner', $owner)->whereIn('state', ['pending', 'error'])->select('id');
        $rows = DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
            ->join('zt_archive_assets as a', 'a.message_id', '=', 'o.message_id')
            ->where('s.owner', $owner)->where('a.owner', $owner)->where('o.deleted', false)
            ->when($account !== null, fn ($q) => $q->where('s.account_id', $account))
            ->whereIn('a.id', $assets)->whereIn('a.state', ['pending', 'error'])
            ->distinct()->get(['a.id as asset', 's.id as source']);
        $requested = now();
        foreach ($rows->chunk(100) as $chunk) {
            $receipts = $chunk->map(fn ($r) => ['id' => hash('sha256', $r->source.':'.$r->asset), 'owner' => $owner, 'asset_id' => $r->asset, 'source_id' => $r->source, 'requested_at' => $requested]);
            DB::table('zt_archive_pc_recoveries')->insertOrIgnore($receipts->all());
            if ($retry) {
                DB::table('zt_archive_pc_recoveries')->where('owner', $owner)->whereIn('id', $receipts->pluck('id'))->whereNotNull('checked_at')->update(['checked_at' => null, 'source_state' => null, 'requested_at' => $requested]);
            }
        }

        return $rows->pluck('source')->unique()->count();
    }

    private function records(string $owner)
    {
        return DB::table('zt_archive_pc_recoveries as r')->join('zt_archive_sources as s', 's.id', '=', 'r.source_id')
            ->join('zt_archive_assets as a', 'a.id', '=', 'r.asset_id')
            ->where('r.owner', $owner)->where('s.owner', $owner)->where('a.owner', $owner)
            ->whereIn('a.state', ['pending', 'error'])
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('zt_archive_observations as o')->whereColumn('o.source_id', 's.id')->whereColumn('o.message_id', 'a.message_id')->where('o.deleted', false));
    }

    private function pending(string $owner)
    {
        return $this->records($owner)->whereNull('r.checked_at');
    }

    public function conversations(array $session): array
    {
        return $this->pending($session['owner'])->where('s.account_id', $session['accountId'])->where('s.external_id', $session['externalId'])
            ->whereIn('s.conversation_id', array_column($session['conversations'] ?? [], 'conversationId'))
            ->distinct()->orderBy('s.conversation_id')->pluck('s.conversation_id')->all();
    }

    public function receipts(string $owner, string $source): array
    {
        return $this->pending($owner)->where('s.id', $source)->pluck('r.id')->all();
    }

    public function messageIds(string $owner, string $source): array
    {
        return $this->pending($owner)->join('zt_archive_observations as target', fn ($q) => $q->on('target.source_id', '=', 's.id')->on('target.message_id', '=', 'a.message_id'))
            ->where('s.id', $source)->where('target.deleted', false)->distinct()->pluck('target.native_id')->all();
    }

    public function checked(string $owner, array $receipts, array $checks = []): void
    {
        $evidence = [];
        foreach ($checks as $check) {
            if (in_array($check['sourceState'] ?? '', ['found', 'missing'], true)) {
                $evidence[($check['messageId'] ?? '').':'.($check['slot'] ?? '')] = $check['sourceState'];
            }
        }
        foreach (array_chunk($receipts, 500) as $ids) {
            $rows = $this->pending($owner)->join('zt_archive_observations as o', fn ($q) => $q->on('o.source_id', '=', 's.id')->on('o.message_id', '=', 'a.message_id'))
                ->whereIn('r.id', $ids)->where('o.deleted', false)->get(['r.id', 'o.native_id', 'a.slot']);
            foreach ($rows as $row) {
                DB::table('zt_archive_pc_recoveries')->where('owner', $owner)->where('id', $row->id)->whereNull('checked_at')
                    ->update(['checked_at' => now(), 'source_state' => $evidence[$row->native_id.':'.$row->slot] ?? null]);
            }
        }
    }

    public function summary(string $owner): array
    {
        $rows = $this->records($owner)->get(['r.asset_id', 'r.checked_at', 's.account_id', 's.account_name']);
        $pending = $rows->whereNull('checked_at')->pluck('asset_id')->unique();

        return ['queued' => $pending->count(), 'checked' => $rows->whereNotNull('checked_at')->pluck('asset_id')->unique()->diff($pending)->count(),
            'accounts' => $rows->whereNull('checked_at')->groupBy('account_id')->map(fn ($group) => ['name' => $group->first()->account_name, 'queued' => $group->pluck('asset_id')->unique()->count()])->values()->all()];
    }
}
