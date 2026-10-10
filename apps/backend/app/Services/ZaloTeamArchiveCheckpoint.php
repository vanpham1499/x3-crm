<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Immutable baseline: verification uses only our database and physical files, never Zalo.
class ZaloTeamArchiveCheckpoint
{
    public function __construct(private ZaloTeamArchive $archive, private ZaloTeamArchiveFiles $files) {}

    public function create(User $u, string $day): string
    {
        $owner = ZaloTeamArchive::owner($u);

        return $this->archive->withLock($owner, function () use ($owner, $day) {
            $from = CarbonImmutable::parse($day, 'Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
            $sources = DB::table('zt_archive_sources')->where('owner', $owner)->get()->keyBy('id');
            $rows = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
                ->whereIn('o.source_id', $sources->keys())->where('o.deleted', false)->where('m.time', '>=', $from)->where('m.time', '<', $from + 86400000)
                ->orderBy('o.id')->get(['o.id', 'o.source_id', 'o.native_id', 'm.content']);
            abort_if($rows->isEmpty(), 422, 'Chưa có tin nhắn trong ngày này để tạo mốc.');
            $entries = $rows->map(fn ($r) => ['source' => $r->source_id, 'nativeId' => $r->native_id, 'hash' => hash('sha256', $r->content)])->all();
            $messageIds = DB::table('zt_archive_observations')->whereIn('id', $rows->pluck('id'))->pluck('message_id');
            $assets = DB::table('zt_archive_assets')->whereIn('message_id', $messageIds)->get();
            $blobs = [];
            foreach ($assets->where('state', 'ready')->unique('hash') as $a) {
                $path = $this->files->readPath($owner, $a->hash);
                if (is_file($path) && hash_file('sha256', $path) === $a->hash) {
                    $blobs[] = ['hash' => $a->hash, 'bytes' => (int) $a->bytes];
                }
            }
            $list = $rows->groupBy('source_id')->map(function ($rows, $id) use ($sources) {
                $s = $sources[$id];

                return ['id' => $id, 'name' => $s->name, 'account_name' => $s->account_name, 'messages' => count($rows)];
            })->values()->all();
            $summary = ['messages' => count($entries), 'contents' => $messageIds->unique()->count(), 'files' => count($blobs), 'bytes' => array_sum(array_column($blobs, 'bytes')),
                'pendingFiles' => $assets->where('state', '!=', 'ready')->count(), 'sources' => $list,
                'unscannedSources' => $sources->filter(fn ($s) => ! $s->history_done && (! $s->oldest || $s->oldest >= $from))->count()];
            $manifest = ZaloTeamArchive::json(['date' => $day, 'timezone' => 'Asia/Ho_Chi_Minh', 'messages' => $entries, 'blobs' => $blobs]);
            $id = (string) Str::uuid();
            DB::table('zt_archive_checkpoints')->insert(['id' => $id, 'owner' => $owner, 'date' => $day, 'manifest' => $manifest, 'checksum' => hash('sha256', $manifest), 'summary' => ZaloTeamArchive::json($summary), 'created_at' => now()]);

            return $id;
        });
    }

    public function verify(User $u, string $id): array
    {
        $owner = ZaloTeamArchive::owner($u);

        // Blob commits are atomic and content-addressed; a read-only check need not stop ingestion.
        return DB::transaction(function () use ($owner, $id) {
            $row = DB::table('zt_archive_checkpoints')->where('owner', $owner)->where('id', $id)->first();
            abort_unless($row, 404, 'Không có mốc kiểm chứng.');
            abort_unless(hash_equals($row->checksum, hash('sha256', $row->manifest)), 409, 'Mốc kiểm chứng không còn nguyên vẹn.');
            $manifest = json_decode($row->manifest, true);
            $missing = 0;
            $changed = 0;
            $files = 0;
            $bytes = 0;
            foreach ($manifest['messages'] as $m) {
                $current = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')->where('o.source_id', $m['source'])->where('o.native_id', $m['nativeId'])->first(['m.content', 'o.deleted']);
                if (! $current || $current->deleted) {
                    $missing++;
                } elseif (hash('sha256', $current->content) !== $m['hash']) {
                    $changed++;
                }
            }
            foreach ($manifest['blobs'] as $b) {
                $path = $this->files->readPath($owner, $b['hash']);
                if (is_file($path) && filesize($path) === $b['bytes'] && hash_file('sha256', $path) === $b['hash']) {
                    $files++;
                    $bytes += $b['bytes'];
                }
            }
            $result = ['ok' => ! $missing && ! $changed && $files === count($manifest['blobs']), 'messages' => count($manifest['messages']), 'missingMessages' => $missing, 'changedMessages' => $changed, 'files' => $files, 'missingFiles' => count($manifest['blobs']) - $files, 'bytes' => $bytes];
            DB::table('zt_archive_checkpoints')->where('id', $id)->update(['verification' => ZaloTeamArchive::json($result), 'verified_at' => now()]);

            return $result;
        });
    }
}
