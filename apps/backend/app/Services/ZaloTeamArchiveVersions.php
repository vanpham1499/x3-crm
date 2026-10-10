<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Immutable evidence alongside the existing source/native-ID logical identity. */
class ZaloTeamArchiveVersions
{
    private static array $available = [];

    public static function record(object $source, array $message, string $origin, string $disposition): void
    {
        self::recordMany($source, [['message' => $message, 'origin' => $origin, 'disposition' => $disposition]]);
    }

    public static function recordMany(object $source, array $records): void
    {
        // Compatible while the additive migration is being rehearsed/deployed.
        $connection = DB::connection()->getName().':'.DB::connection()->getDatabaseName();
        self::$available[$connection] ??= Schema::hasTable('zt_archive_versions');
        if (! self::$available[$connection]) {
            return;
        }
        $rows = [];
        foreach ($records as $r) {
            $row = self::row($source, $r['message'], $r['origin'], $r['disposition']);
            $rows[$row['id']] = $row;
        }
        foreach (array_chunk(array_values($rows), 100) as $chunk) {
            DB::table('zt_archive_versions')->insertOrIgnore($chunk);
        }
    }

    private static function row(object $source, array $message, string $origin, string $disposition): array
    {
        $sort = function ($v) use (&$sort) {
            if (! is_array($v)) {
                return $v;
            }
            if (! array_is_list($v)) {
                ksort($v, SORT_STRING);
            }

            return array_map($sort, $v);
        };
        // Expiring source URLs are kept in current asset metadata, not copied
        // repeatedly into version identity. Keep the renderable message payload.
        foreach ($message['attachments'] ?? [] as $i => $a) {
            if (($a['kind'] ?? '') !== 'link') {
                unset($message['attachments'][$i]['url'], $message['attachments'][$i]['preview']);
            }
        }
        $payload = ZaloTeamArchive::json($sort($message));
        $id = hash('sha256', $source->id.':'.$origin.':'.$payload);

        return ['id' => $id, 'owner' => $source->owner, 'source_id' => $source->id,
            'native_id' => $message['id'], 'origin' => $origin, 'disposition' => $disposition, 'payload' => $payload, 'recorded_at' => now()];
    }

    public static function backfill(string $owner): int
    {
        $added = 0;
        DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
            ->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')->where('s.owner', $owner)
            ->select(['o.id as observation_id', 'o.source_id', 'o.view', 'm.content'])->orderBy('o.id')
            ->chunk(100, function ($rows) use ($owner, &$added) {
                $versions = [];
                foreach ($rows as $r) {
                    $versions[] = self::row((object) ['id' => $r->source_id, 'owner' => $owner],
                        array_merge(json_decode($r->content, true), json_decode($r->view, true)), 'stored', 'baseline');
                }
                $added += DB::transaction(fn () => DB::table('zt_archive_versions')->insertOrIgnore($versions));
            });

        return $added;
    }
}
