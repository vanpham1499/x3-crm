<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/** Content addressed remote storage with a verified, bounded local read cache. */
class ZaloTeamDriveStore
{
    private const TABLE = 'zt_archive_drive_objects';

    public function __construct(private ZaloTeamDriveClient $client) {}

    public static function enabled(): bool
    {
        return (bool) config('zalo_team.drive.enabled');
    }

    public function path(string $owner, string $kind, string $key): string
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $owner) || ! in_array($kind, ['archive', 'backup-blob', 'backup-manifest'], true)
            || ! preg_match($kind === 'backup-manifest' ? '/^[a-f0-9-]{36}$/D' : '/^[a-f0-9]{64}$/D', $key)) {
            throw new \InvalidArgumentException('Invalid Drive object');
        }

        return match ($kind) {
            'archive' => config('zalo_team.archive_path').'/blobs/'.$owner.'/'.substr($key, 0, 2).'/'.$key,
            'backup-blob' => config('zalo_team.backup_path').'/'.$owner.'/blobs/'.$key.'.zip',
            'backup-manifest' => config('zalo_team.backup_path').'/'.$owner.'/'.$key.'.zip',
        };
    }

    private function id(string $owner, string $kind, string $key): string
    {
        $this->path($owner, $kind, $key);
        return hash('sha256', $owner.'|'.$kind.'|'.$key);
    }

    private function lock(string $id, callable $work, bool $wait = true): mixed
    {
        $dir = config('zalo_team.archive_path').'/drive-locks';
        if (! is_dir($dir) && ! @mkdir($dir, 0700, true) && ! is_dir($dir)) {
            throw new \RuntimeException('drive_cache_unwritable');
        }
        $h = fopen($dir.'/'.$id.'.lock', 'c');
        if (! $h) {
            throw new \RuntimeException('drive_cache_lock_failed');
        }
        try {
            $start = microtime(true);
            while (! flock($h, LOCK_EX | LOCK_NB)) {
                if (! $wait) {
                    return null;
                }
                if (microtime(true) - $start > 25) {
                    throw new \RuntimeException('drive_file_busy');
                }
                usleep(100000);
            }
            return $work();
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }

    private function row(string $owner, string $kind, string $key): ?object
    {
        return DB::table(self::TABLE)->where('id', $this->id($owner, $kind, $key))->first();
    }

    private function update(string $id, array $values): void
    {
        DB::table(self::TABLE)->where('id', $id)->update($values + ['updated_at' => now()]);
    }

    public function available(string $owner, string $hash, int $size): bool
    {
        $path = $this->path($owner, 'archive', $hash);
        clearstatcache(true, $path);
        if (is_file($path) && filesize($path) === $size) {
            return true;
        }
        if (! self::enabled()) {
            return false;
        }
        $r = $this->row($owner, 'archive', $hash);
        return $r && $r->state === 'verified' && $r->checksum === $hash && (int) $r->bytes === $size;
    }

    /** Request-scoped metadata only: never hydrate or share availability across users. */
    public function availableAssets(iterable $assets): array
    {
        $result = []; $pending = [];
        foreach ($assets as $a) {
            $result[$a->id] = false;
            if ($a->state !== 'ready' || ! $a->hash) continue;
            $path = $this->path($a->owner, 'archive', $a->hash);
            clearstatcache(true, $path);
            if (is_file($path) && filesize($path) === (int) $a->bytes) {
                $result[$a->id] = true;
            } elseif (self::enabled()) {
                $pending[$this->id($a->owner, 'archive', $a->hash)][] = $a;
            }
        }
        foreach (array_chunk(array_keys($pending), 500) as $ids) {
            foreach (DB::table(self::TABLE)->whereIn('id', $ids)->where('state', 'verified')->get(['id','checksum','bytes']) as $r) {
                foreach ($pending[$r->id] as $a) $result[$a->id] = $r->checksum === $a->hash && (int) $r->bytes === (int) $a->bytes;
            }
        }
        return $result;
    }

    public function read(string $owner, string $kind, string $key): string
    {
        $path = $this->path($owner, $kind, $key);
        if (! self::enabled()) {
            return $path;
        }
        $id = $this->id($owner, $kind, $key);
        return $this->lock($id, function () use ($path, $id) {
            $o = DB::table(self::TABLE)->where('id', $id)->first();
            if (! $o) {
                return $path; // An incoming local file has not been queued yet.
            }
            // Pin before returning: BinaryFileResponse and ZipArchive may open it later.
            $this->update($id, ['accessed_at' => now()]);
            clearstatcache(true, $path);
            if (is_file($path) && filesize($path) === (int) $o->bytes) {
                return $path;
            }
            if ($o->state !== 'verified') {
                throw new \RuntimeException('drive_file_not_verified');
            }
            $this->hydrate($o, $path);
            $this->update($id, ['cached_at' => now(), 'error' => null]);
            return $path;
        });
    }

    private function hydrate(object $o, string $path): void
    {
        if (! is_dir(dirname($path)) && ! @mkdir(dirname($path), 0700, true) && ! is_dir(dirname($path))) {
            throw new \RuntimeException('drive_cache_unwritable');
        }
        $free = disk_free_space(dirname($path));
        if ($free !== false && $free < (int) $o->bytes + 268435456) {
            throw new \RuntimeException('drive_cache_disk_full');
        }
        $tmp = tempnam(dirname($path), '.drive-');
        try {
            chmod($tmp, 0600);
            $this->client->download($o->drive_id, $tmp, (int) $o->bytes);
            clearstatcache(true, $tmp);
            if (filesize($tmp) !== (int) $o->bytes || hash_file('sha256', $tmp) !== $o->checksum) {
                throw new \RuntimeException('drive_checksum_mismatch');
            }
            $h = fopen($tmp, 'rb');
            try { fsync($h); } finally { fclose($h); }
            if (! rename($tmp, $path)) {
                throw new \RuntimeException('drive_cache_commit_failed');
            }
        } finally {
            if (is_file($tmp)) { unlink($tmp); }
        }
    }

    public function queue(string $owner, string $kind, string $key): bool
    {
        $path = $this->path($owner, $kind, $key);
        $id = $this->id($owner, $kind, $key);
        $existing = DB::table(self::TABLE)->where('id', $id)->first();
        if (($existing && $existing->state !== 'deferred') || ! is_file($path)) {
            return false;
        }
        $checksum = hash_file('sha256', $path);
        if ($kind === 'archive' && $checksum !== $key) {
            throw new \RuntimeException('drive_local_checksum_mismatch');
        }
        if ($existing) {
            if ($existing->checksum !== $checksum || (int) $existing->bytes !== filesize($path)) { throw new \RuntimeException('drive_local_checksum_mismatch'); }
            $this->update($id, ['state' => 'pending', 'retry_at' => null, 'error' => null]);
            return true;
        }
        return DB::table(self::TABLE)->insertOrIgnore(['id' => $id, 'owner' => $owner, 'kind' => $kind, 'object_key' => $key,
            'checksum' => $checksum, 'bytes' => filesize($path), 'folder_id' => config('zalo_team.drive.folder_id'),
            'shared_drive_id' => config('zalo_team.drive.shared_drive_id'), 'cached_at' => now(), 'created_at' => now(), 'updated_at' => now()]) > 0;
    }

    /** Bounded scanning, no materialization of all assets or file contents in RAM. */
    public function scan(int $limit = 100): int
    {
        $queued = 0;
        $rows = $this->unqueuedAssets()
            ->select('a.owner', 'a.hash')->distinct()->limit($limit)->get();
        foreach ($rows as $a) {
            $queued += (int) $this->queue($a->owner, 'archive', $a->hash);
        }
        // Only complete encrypted snapshots may publish their blob set and manifest.
        foreach (DB::table('zt_archive_backups')->where('state', 'ready')
            ->when(config('zalo_team.drive.backups_after'), fn ($q, $at) => $q->where('created_at', '>=', $at))
            ->orderByDesc('created_at')->limit(100)->get() as $b) {
            if ($queued >= $limit) { break; }
            // The manifest is enqueued only after its complete immutable blob directory.
            if ($this->row($b->owner, 'backup-manifest', $b->id)) { continue; }
            $dir = dirname($this->path($b->owner, 'backup-manifest', $b->id)).'/blobs';
            if (is_dir($dir)) {
                foreach (new \DirectoryIterator($dir) as $f) {
                    if ($queued >= $limit) { break; }
                    if ($f->isFile() && preg_match('/^([a-f0-9]{64})\.zip$/D', $f->getFilename(), $m)) {
                        $queued += (int) $this->queue($b->owner, 'backup-blob', $m[1]);
                    }
                }
            }
            if ($queued < $limit) { $queued += (int) $this->queue($b->owner, 'backup-manifest', $b->id); }
        }
        return $queued;
    }

    private function matches(object $o, ?array $m): bool
    {
        return $m && ! ($m['trashed'] ?? false) && ($m['driveId'] ?? '') === $o->shared_drive_id
            && in_array($o->folder_id, $m['parents'] ?? [], true) && (string) ($m['size'] ?? '') === (string) $o->bytes
            && ($m['capabilities']['canDelete'] ?? true) === false && ($m['capabilities']['canTrash'] ?? true) === false
            && ($m['sha256Checksum'] ?? '') === $o->checksum;
    }

    private function unqueuedAssets(): \Illuminate\Database\Query\Builder
    {
        return DB::table('zt_archive_assets as a')->where('a.state', 'ready')->whereNotNull('a.hash')
            ->when(config('zalo_team.drive.excluded_accounts'), fn ($q, $excluded) => $q->whereExists(fn ($s) => $s->selectRaw('1')
                ->from('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
                ->whereColumn('o.message_id', 'a.message_id')->whereColumn('s.owner', 'a.owner')->whereNotIn('s.external_id', $excluded)))
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from(self::TABLE.' as d')->whereColumn('d.owner', 'a.owner')
                ->where('d.kind', 'archive')->whereColumn('d.object_key', 'a.hash')->where('d.state', '!=', 'deferred'));
    }

    public function transfer(string $id, int $seconds = 45): bool
    {
        // Upload serialization must not hold the read/cache lock during network I/O.
        // Pending objects cannot be evicted; verified objects leave this path immediately.
        return (bool) $this->lock(hash('sha256', 'upload|'.$id), function () use ($id, $seconds) {
            $o = DB::table(self::TABLE)->where('id', $id)->first();
            if (! $o || $o->state === 'verified') { return true; }
            $path = $this->path($o->owner, $o->kind, $o->object_key);
            $started = microtime(true);
            try {
                if (! is_file($path) || filesize($path) !== (int) $o->bytes || hash_file('sha256', $path) !== $o->checksum) {
                    throw new \RuntimeException('drive_local_checksum_mismatch');
                }
                if ($o->folder_id !== config('zalo_team.drive.folder_id') || $o->shared_drive_id !== config('zalo_team.drive.shared_drive_id')) {
                    throw new \RuntimeException('drive_destination_changed');
                }
                $this->client->destination();
                $newId = ! $o->drive_id;
                if (! $o->drive_id) {
                    $o->drive_id = $this->client->allocate();
                    $this->update($id, ['drive_id' => $o->drive_id]); // Durable before the external write.
                }
                $meta = $newId ? null : $this->client->metadata($o->drive_id);
                if ($meta && ! $this->matches($o, $meta)) {
                    throw new \RuntimeException('drive_remote_conflict');
                }
                if (! $meta && (int) $o->bytes <= 8388608 && ! $o->upload_session) {
                    $this->update($id, ['state' => 'uploading']);
                    $meta = $this->client->small($o, file_get_contents($path));
                    if (! $this->matches($o, $meta)) { throw new \RuntimeException('drive_checksum_mismatch'); }
                }
                if (! $meta) {
                    $uri = $o->upload_session ? Crypt::decryptString($o->upload_session) : null;
                    $probe = $uri ? $this->client->probe($uri, (int) $o->bytes) : ['expired' => true, 'offset' => 0];
                    if ($probe['expired']) {
                        $uri = $this->client->start($o);
                        $this->update($id, ['upload_session' => Crypt::encryptString($uri), 'state' => 'uploading', 'uploaded' => 0]);
                    }
                    $offset = $probe['offset'];
                    $h = fopen($path, 'rb');
                    try {
                        while ($offset < (int) $o->bytes && microtime(true) - $started < $seconds) {
                            if (fseek($h, $offset) !== 0) { throw new \RuntimeException('drive_local_read_failed'); }
                            $chunk = fread($h, min(8388608, (int) $o->bytes - $offset));
                            if ($chunk === false || $chunk === '') { throw new \RuntimeException('drive_local_read_failed'); }
                            $next = $this->client->chunk($uri, $chunk, $offset, (int) $o->bytes);
                            if ($next['expired'] || $next['offset'] <= $offset || $next['offset'] > $offset + strlen($chunk)) {
                                throw new \RuntimeException('drive_upload_interrupted');
                            }
                            $offset = $next['offset'];
                            $this->update($id, ['uploaded' => $offset, 'state' => 'uploading', 'error' => null, 'retry_at' => null]);
                        }
                    } finally { fclose($h); }
                    if ($offset < (int) $o->bytes) { return false; }
                    $meta = $this->client->metadata($o->drive_id);
                    if (! $this->matches($o, $meta)) { throw new \RuntimeException('drive_checksum_mismatch'); }
                }
                $this->update($id, ['state' => 'verified', 'verified_at' => now(), 'upload_session' => null,
                    'uploaded' => $o->bytes, 'error' => null, 'retry_at' => null, 'attempts' => 0]);
                return true;
            } catch (\Throwable $e) {
                $code = preg_match('/^drive_[a-z0-9_]+$/D', $e->getMessage()) ? $e->getMessage() : 'drive_connection_failed';
                $this->update($id, ['state' => 'error', 'error' => $code, 'attempts' => $o->attempts + 1,
                    'retry_at' => now()->addSeconds(min(3600, 15 * (2 ** min(8, (int) $o->attempts))))]);
                return false;
            }
        }, false);
    }

    public function run(int $seconds = 45): array
    {
        $this->client->destination();
        $start = microtime(true);
        $queued = $this->scan();
        $done = 0;
        $q = DB::table(self::TABLE)->whereIn('state', ['pending', 'uploading', 'error'])->where(fn ($q) => $q->whereNull('retry_at')->orWhere('retry_at', '<=', now()));
        foreach ($q->orderBy('updated_at')->limit(100)->get(['id']) as $r) {
            if (microtime(true) - $start >= $seconds) { break; }
            $done += (int) $this->transfer($r->id, max(1, (int) ($seconds - (microtime(true) - $start))));
        }
        return ['queued' => $queued, 'verified' => $done, 'evictedBytes' => $this->evict()];
    }

    public function evict(): int
    {
        if (! config('zalo_team.drive.evict')) { return 0; }
        return (int) $this->lock(hash('sha256', 'drive-cache-eviction'), fn () => $this->evictUnlocked(), false);
    }

    private function evictUnlocked(): int
    {
        $over = (int) DB::table(self::TABLE)->whereNotNull('cached_at')->sum('bytes') - max(1048576, (int) config('zalo_team.drive.cache_bytes'));
        if ($over <= 0) { return 0; }
        $this->client->destination();
        $freed = 0;
        $rows = DB::table(self::TABLE)->where('state', 'verified')->whereNotNull('cached_at')->where('kind', '!=', 'backup-manifest')
            ->where(fn ($q) => $q->where('kind', '!=', 'archive')->orWhereNotExists(fn ($p) => $p->selectRaw('1')->from('zt_archive_assets as a')
                ->whereColumn('a.owner', self::TABLE.'.owner')->whereColumn('a.hash', self::TABLE.'.object_key')->where('a.slot', 'like', '%.preview')))
            ->where('cached_at', '<', now()->subHour())->where(fn ($q) => $q->whereNull('accessed_at')->orWhere('accessed_at', '<', now()->subHour()))
            ->orderBy('accessed_at')->orderBy('cached_at')->limit(25)->get();
        foreach ($rows as $candidate) {
            if ($freed >= $over) { break; }
            $freed += (int) $this->lock($candidate->id, function () use ($candidate) {
                $o = DB::table(self::TABLE)->where('id', $candidate->id)->first();
                if (! $o || $o->state !== 'verified' || ($o->accessed_at && strtotime($o->accessed_at) >= time() - 3600)) { return 0; }
                // Preview images stay on SSD; even an original used as a preview is retained.
                if ($o->kind === 'archive' && DB::table('zt_archive_assets')->where('owner', $o->owner)->where('hash', $o->object_key)->where('slot', 'like', '%.preview')->exists()) { return 0; }
                $path = $this->path($o->owner, $o->kind, $o->object_key);
                if (! is_file($path)) { $this->update($o->id, ['cached_at' => null]); return 0; }
                if (filemtime($path) >= time() - 3600 || ! $this->matches($o, $this->client->metadata($o->drive_id))) { return 0; }
                // Exact validated path only. No recursive deletion and no remote deletion.
                if (! unlink($path)) { return 0; }
                $this->update($o->id, ['cached_at' => null]);
                return (int) $o->bytes;
            }, false);
        }
        return $freed;
    }

    public function recoverCatalog(string $owner): int
    {
        $this->id($owner, 'archive', str_repeat('0', 64));
        $this->client->destination();
        $count = 0;
        $cursor = null;
        do {
            $page = $this->client->catalog($cursor);
            foreach ($page['files'] ?? [] as $m) {
                $p = $m['appProperties'] ?? [];
                if (($p['owner'] ?? '') !== $owner) { continue; }
                $id = $this->id($owner, $p['kind'] ?? '', $p['key'] ?? '');
                if (! preg_match('/^[a-f0-9]{64}$/D', $p['sha256'] ?? '') || ($m['sha256Checksum'] ?? '') !== $p['sha256']) { continue; }
                if (($m['driveId'] ?? '') !== config('zalo_team.drive.shared_drive_id') || ! in_array(config('zalo_team.drive.folder_id'), $m['parents'] ?? [], true)) { continue; }
                if ($p['kind'] === 'archive' && $p['key'] !== $p['sha256']) { continue; }
                $count += DB::table(self::TABLE)->insertOrIgnore(['id' => $id, 'owner' => $owner, 'kind' => $p['kind'], 'object_key' => $p['key'],
                    'checksum' => $p['sha256'], 'bytes' => (int) $m['size'], 'drive_id' => $m['id'], 'folder_id' => config('zalo_team.drive.folder_id'),
                    'shared_drive_id' => config('zalo_team.drive.shared_drive_id'), 'state' => 'verified', 'verified_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            }
            $cursor = $page['nextPageToken'] ?? null;
        } while ($cursor);
        return $count;
    }

    public function status(string $owner): array
    {
        if (! self::enabled()) { return ['enabled' => false]; }
        $q = DB::table(self::TABLE)->where('owner', $owner);
        $snapshot = config('zalo_team.archive_path').'/drive-worker.json';
        $worker = is_file($snapshot) ? json_decode(file_get_contents($snapshot, false, null, 0, 4096), true) : null;
        $unqueued = $this->unqueuedAssets()->where('a.owner', $owner)->distinct()->count('a.hash');
        return ['enabled' => true, 'worker' => $worker, 'evictionEnabled' => (bool) config('zalo_team.drive.evict'), 'cacheLimit' => config('zalo_team.drive.cache_bytes'),
            'excludedTestAccounts' => count(config('zalo_team.drive.excluded_accounts', [])),
            'objects' => (clone $q)->count(), 'verified' => (clone $q)->where('state', 'verified')->count(),
            'verifiedBytes' => (int) (clone $q)->where('state', 'verified')->sum('bytes'),
            'pending' => (clone $q)->whereIn('state', ['pending', 'uploading'])->count() + $unqueued, 'failed' => (clone $q)->where('state', 'error')->count(),
            'lastVerified' => (clone $q)->max('verified_at')];
    }

    public function retry(string $owner): void
    {
        DB::table(self::TABLE)->where('owner', $owner)->where('state', 'error')->update(['retry_at' => null, 'updated_at' => now()]);
    }

    public function heartbeat(?string $error = null): void
    {
        $dir = config('zalo_team.archive_path');
        if (! is_dir($dir)) { mkdir($dir, 0700, true); }
        $tmp = tempnam($dir, '.drive-worker-');
        try {
            chmod($tmp, 0600);
            file_put_contents($tmp, json_encode(['at' => time(), 'error' => $error]));
            if (! rename($tmp, $dir.'/drive-worker.json')) { throw new \RuntimeException('drive_heartbeat_failed'); }
        } finally { if (is_file($tmp)) { unlink($tmp); } }
    }
}
