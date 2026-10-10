<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Reversible queue cleanup. Never deletes messages, source files or saved blobs. */
class ZaloTeamArchiveCleanup
{
    public function candidates(string $owner, bool $dismissed = false)
    {
        $q = DB::table('zt_archive_assets as a')->where('a.owner', $owner)->whereNull('a.hash');
        if ($dismissed) {
            return $q->where('a.state', 'dismissed');
        }

        return $q->where('a.state', 'error')->where('a.attempts', '>=', 5)->whereNull('a.retry_at')
            ->where(fn ($q) => $q->where('a.error', 'like', '%HTTP 404%')->orWhere('a.error', 'like', '%HTTP 410%')
                ->orWhere(fn ($q) => $q->where('a.url', '')->where('a.error', 'like', 'Chưa có tệp gốc đọc được từ Zalo PC%')))
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
                ->whereColumn('o.message_id', 'a.message_id')->where('s.owner', $owner)->where('o.deleted', false))
            // Every visible account must have finished checking this asset. An absent
            // receipt or another pending account is not evidence of a missing file.
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
                ->whereColumn('o.message_id', 'a.message_id')->where('s.owner', $owner)->where('o.deleted', false)
                ->whereNotExists(fn ($r) => $r->selectRaw('1')->from('zt_archive_pc_recoveries as r')
                    ->where('r.owner', $owner)->whereColumn('r.asset_id', 'a.id')->whereColumn('r.source_id', 's.id')
                    ->whereNotNull('r.checked_at')->where('r.source_state', 'missing')->whereColumn('r.checked_at', '>=', 'r.requested_at')));
    }

    public function preview(string $owner, string $mode): array
    {
        $q = $this->candidates($owner, $mode === 'restore');
        $total = (clone $q)->count();
        $rows = $q->join('zt_archive_messages as m', 'm.id', '=', 'a.message_id')->where('m.owner', $owner)
            ->orderByDesc('m.time')->orderBy('a.id')->limit(500)->get(['a.id', 'a.message_id', 'a.slot', 'm.content', 'm.time']);
        $items = $rows->map(function ($r) use ($owner) {
            $m = json_decode($r->content, true);
            $origins = DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
                ->where('s.owner', $owner)->where('o.message_id', $r->message_id)->where('o.deleted', false)
                ->get(['s.name', 's.account_name']);

            return ['id' => $r->id, 'name' => $m['attachments'][(int) explode('.', $r->slot)[1]]['name'] ?? 'Tệp đính kèm',
                'role' => str_ends_with($r->slot, '.preview') ? 'Ảnh xem trước' : 'Tệp gốc', 'time' => (int) $r->time,
                'source' => $origins->map(fn ($s) => $s->name.' · '.$s->account_name)->unique()->implode(' / ')];
        })->all();

        return ['items' => $items, 'total' => $total, 'mode' => $mode,
            'token' => Crypt::encryptString(json_encode(['owner' => $owner, 'mode' => $mode, 'ids' => $rows->pluck('id')->all(), 'expires' => time() + 600]))];
    }

    public function apply(string $owner, array $v): array
    {
        abort_unless($v['confirm'] ?? false, 422, 'Xác nhận danh sách trước khi dọn.');
        try {
            $preview = json_decode(Crypt::decryptString($v['token']), true, 32, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            abort(422, 'Danh sách không hợp lệ. Mở lại để kiểm tra.');
        }
        abort_unless($preview['owner'] === $owner, 403);
        abort_unless($preview['expires'] >= time(), 409, 'Danh sách đã hết hạn. Mở lại để kiểm tra.');
        $ids = array_values(array_unique($v['assetIds']));
        abort_if(array_diff($ids, $preview['ids']), 422, 'Có mục nằm ngoài danh sách đã kiểm tra.');

        return app(ZaloTeamArchive::class)->withLock($owner, fn () => DB::transaction(function () use ($owner, $preview, $ids) {
            $restore = $preview['mode'] === 'restore';
            // Recheck eligibility under the same lock as download/import/backup.
            $eligible = $this->candidates($owner, $restore)->whereIn('a.id', $ids)->pluck('a.id');
            $count = DB::table('zt_archive_assets')->where('owner', $owner)->whereIn('id', $eligible)
                ->update(['state' => $restore ? 'error' : 'dismissed', 'attempts' => 5, 'retry_at' => null]);
            if ($restore) {
                app(ZaloTeamPcRecovery::class)->seed($owner, $eligible->all(), true);
            }
            Log::info('Archive queue cleanup', ['owner' => $owner, 'mode' => $preview['mode'], 'assets' => $eligible->all()]);

            return ['changed' => $count, 'skipped' => count($ids) - $count];
        }));
    }
}
