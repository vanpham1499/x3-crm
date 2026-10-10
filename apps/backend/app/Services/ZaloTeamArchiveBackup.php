<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ZaloTeamArchiveBackup
{
    public const TABLES = ['sources', 'messages', 'observations', 'assets', 'checkpoints', 'imports', 'versions'];

    public function __construct(private ZaloTeamArchive $archive, private ZaloTeamArchiveFiles $files) {}

    public function path(string $owner, string $id): string
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $owner) || ! Str::isUuid($id)) {
            throw new \InvalidArgumentException('Invalid backup');
        }

        return config('zalo_team.backup_path').'/'.$owner.'/'.$id.'.zip';
    }

    public function discover(User $u, string $id): void
    {
        $owner = ZaloTeamArchive::owner($u);
        $path = $this->readPath($owner, $id);
        if (! is_file($path)) {
            throw new \RuntimeException('Backup manifest not found');
        }
        $zip = new \ZipArchive;
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Invalid backup');
        }
        $zip->setPassword(config('zalo_team.backup_password'));
        try {
            $stream = $zip->getStream('archive.jsonl');
            if (! $stream) {
                throw new \RuntimeException('Cannot decrypt backup');
            }
            $header = json_decode(fgets($stream), true, 512, JSON_THROW_ON_ERROR);
            fclose($stream);
            if (($header['owner'] ?? null) !== $owner || ($header['format'] ?? null) !== 2) {
                throw new \RuntimeException('Wrong backup identity');
            }
        } finally {
            $zip->close();
        }
        $this->archive->settings($u);
        DB::table('zt_archive_backups')->insertOrIgnore(['id' => $id, 'owner' => $owner, 'state' => 'ready', 'bytes' => filesize($path), 'checksum' => hash_file('sha256', $path), 'created_at' => now()]);
        $this->verify($u, $id);
    }

    public function request(User $u): string
    {
        $owner = ZaloTeamArchive::owner($u);
        $this->archive->settings($u);

        return DB::transaction(function () use ($owner) {
            DB::table('zt_archive_settings')->where('owner', $owner)->lockForUpdate()->first();
            $pending = DB::table('zt_archive_backups')->where('owner', $owner)->whereIn('state', ['pending', 'running'])->value('id');
            if ($pending) {
                return $pending;
            }
            $id = (string) Str::uuid();
            DB::table('zt_archive_backups')->insert(['id' => $id, 'owner' => $owner, 'state' => 'pending', 'created_at' => now()]);

            return $id;
        });
    }

    public function create(User $u, string $id): void
    {
        $owner = ZaloTeamArchive::owner($u);
        $this->archive->withLock($owner, function () use ($u, $owner, $id) {
            $row = DB::table('zt_archive_backups')->where('owner', $owner)->where('id', $id)->first();
            abort_unless($row, 404);
            if ($row->state === 'ready') {
                return;
            }
            $path = $this->path($owner, $id);
            $tmp = $path.'.tmp';
            $data = $path.'.jsonl.tmp';
            $zip = null;
            try {
                if (! class_exists(\ZipArchive::class)) {
                    throw new \RuntimeException('ZIP extension unavailable');
                }
                $password = config('zalo_team.backup_password');
                if (! is_string($password) || strlen($password) < 24) {
                    throw new \RuntimeException('Backup key unavailable');
                }
                if (! is_dir(dirname($path))) {
                    mkdir(dirname($path), 0700, true);
                }
                DB::table('zt_archive_backups')->where('id', $id)->update(['state' => 'running', 'error' => null]);
                $out = fopen($data, 'wb');
                if (! $out) {
                    throw new \RuntimeException('Cannot write backup');
                } chmod($data, 0600);
                try {
                    $this->writeLine($out, ['format' => 2, 'owner' => $owner, 'createdAt' => now()->toISOString()]);
                    DB::transaction(function () use ($owner, $out) {
                        if (DB::connection()->getDriverName() === 'pgsql') {
                            DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                        }
                        foreach (self::TABLES as $name) {
                            if ($name === 'versions' && ! Schema::hasTable('zt_archive_versions')) {
                                continue;
                            }
                            $q = DB::table('zt_archive_'.$name);
                            if ($name === 'observations') {
                                $q->whereIn('source_id', DB::table('zt_archive_sources')->where('owner', $owner)->select('id'));
                            } else {
                                $q->where('owner', $owner);
                            }
                            foreach ($q->lazyById(100) as $r) {
                                $this->writeLine($out, ['table' => $name, 'row' => $r]);
                            }
                        }
                        // Snapshot tag names/assignments for this owner's observed sources only.
                        $keys = DB::table('zt_archive_sources')->where('owner', $owner)->get()->map(fn ($s) => $s->external_id.':'.$s->conversation_id);
                        $assignments = DB::table('zt_tag_assignments')->where('workspace', config('zalo_team.workspace'))->whereIn('source', $keys)->get();
                        $tags = DB::table('zt_tags')->whereIn('id', $assignments->pluck('tag_id'))->get();
                        $this->writeLine($out, ['tags' => $tags, 'assignments' => $assignments]);
                    });
                    if (! fflush($out) || (function_exists('fsync') && ! fsync($out))) {
                        throw new \RuntimeException('Cannot flush backup manifest');
                    }
                } finally {
                    fclose($out);
                }
                $zip = new \ZipArchive;
                if ($zip->open($tmp, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
                    throw new \RuntimeException('Cannot open backup');
                }
                $zip->setPassword($password);
                $zip->addFile($data, 'archive.jsonl');
                if (! $zip->setEncryptionName('archive.jsonl', \ZipArchive::EM_AES_256)) {
                    throw new \RuntimeException('ZIP encryption unavailable');
                }
                // Read the frozen manifest from disk, not a second full asset collection in RAM.
                $assetStream = fopen($data, 'rb');
                if (! $assetStream) {
                    throw new \RuntimeException('Cannot read backup manifest');
                }
                try {
                    while (($line = fgets($assetStream)) !== false) {
                        $entry = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                        if (($entry['table'] ?? '') !== 'assets' || $entry['row']['state'] !== 'ready') {
                            continue;
                        }
                        $a = (object) $entry['row'];
                        $file = $this->files->readPath($owner, $a->hash);
                        if (! is_file($file) || filesize($file) !== (int) $a->bytes || hash_file('sha256', $file) !== $a->hash) {
                            throw new \RuntimeException('Archive file missing or corrupt');
                        }
                        $this->saveBlob($owner, $a->hash, $file, $password);
                    }
                } finally {
                    fclose($assetStream);
                }
                if (! $zip->close()) {
                    throw new \RuntimeException('Cannot finish backup');
                } $zip = null;
                chmod($tmp, 0600);
                if (! rename($tmp, $path)) {
                    throw new \RuntimeException('Cannot commit backup');
                }
                DB::table('zt_archive_backups')->where('id', $id)->update(['state' => 'ready', 'bytes' => filesize($path), 'checksum' => hash_file('sha256', $path)]);
                $this->verify($u, $id);
            } catch (\Throwable $e) {
                // An unsuccessful open/close can leave libzip uninitialized.
                // Cleanup must not mask the original failure or skip recording it.
                if ($zip) {
                    try { $zip->close(); } catch (\Throwable) {}
                }
                DB::table('zt_archive_backups')->where('id', $id)->update(['state' => 'failed', 'error' => 'Sao lưu chưa hoàn tất. Kiểm tra dung lượng, khóa mã hóa và quyền ghi.']);
                throw $e;
            } finally {
                foreach ([$data, $tmp] as $file) {
                    if (is_file($file)) {
                        unlink($file);
                    }
                }
            }
        });
    }

    public function verify(User $u, string $id): array
    {
        $owner = ZaloTeamArchive::owner($u);
        $row = DB::table('zt_archive_backups')->where('owner', $owner)->where('id', $id)->where('state', 'ready')->first();
        abort_unless($row, 404, 'Bản sao lưu chưa sẵn sàng.');
        $path = $this->readPath($owner, $id);
        if (! is_file($path) || ! hash_equals($row->checksum, hash_file('sha256', $path))) {
            throw new \RuntimeException('Backup checksum mismatch');
        }
        $zip = new \ZipArchive;
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Invalid backup');
        }
        $zip->setPassword(config('zalo_team.backup_password'));
        try {
            $f = $zip->getStream('archive.jsonl');
            if (! $f) {
                throw new \RuntimeException('Cannot decrypt backup');
            }
            $header = json_decode(fgets($f), true, 512, JSON_THROW_ON_ERROR);
            if (($header['owner'] ?? null) !== $owner || ($header['format'] ?? null) !== 2) {
                throw new \RuntimeException('Wrong backup owner');
            }
            $rows = 0;
            $expected = [];
            while (($line = fgets($f)) !== false) {
                $v = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                $rows++;
                if (($v['table'] ?? '') === 'assets' && $v['row']['state'] === 'ready') {
                    $expected[$v['row']['hash']] = (int) $v['row']['bytes'];
                }
            }fclose($f);
            foreach ($expected as $hash => $bytes) {
                $blob = $this->openBlob($owner, $hash);
                $f = $blob->getStream('content');
                if (! $f) {
                    $blob->close();
                    throw new \RuntimeException('Missing backup blob');
                }
                $ctx = hash_init('sha256');
                $size = hash_update_stream($ctx, $f);
                fclose($f);
                $blob->close();
                if ($size !== $bytes || hash_final($ctx) !== $hash) {
                    throw new \RuntimeException('Corrupt backup blob');
                }
            }
            DB::table('zt_archive_backups')->where('id', $id)->update(['verified_at' => now()]);

            return ['rows' => $rows, 'files' => count($expected)];
        } finally {
            $zip->close();
        }
    }

    // Restore only missing rows. Existing views/deletion state win; never send anything back to Zalo.
    public function restore(User $u, string $id): array
    {
        $owner = ZaloTeamArchive::owner($u);

        return $this->archive->withLock($owner, function () use ($u, $owner, $id) {
            $result = $this->verify($u, $id);
            $zip = new \ZipArchive;
            $zip->open($this->readPath($owner, $id));
            $zip->setPassword(config('zalo_team.backup_password'));
            try {
                $manifest = $zip->getStream('archive.jsonl');
                fgets($manifest);
                while (($line = fgets($manifest)) !== false) {
                    $v = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                    if (($v['table'] ?? '') !== 'assets' || $v['row']['state'] !== 'ready') {
                        continue;
                    }
                    $hash = $v['row']['hash'];
                    $path = $this->files->path($owner, $hash);
                    if (is_file($path) && hash_file('sha256', $path) === $hash) {
                        continue;
                    }
                    if (! is_dir(dirname($path))) {
                        mkdir(dirname($path), 0700, true);
                    }
                    $blob = $this->openBlob($owner, $hash);
                    $in = $blob->getStream('content');
                    $out = fopen($path.'.restore', 'wb');
                    stream_copy_to_stream($in, $out);
                    fclose($in);
                    fflush($out);
                    if (function_exists('fsync')) {
                        fsync($out);
                    }
                    fclose($out);
                    $blob->close();
                    chmod($path.'.restore', 0600);
                    if (filesize($path.'.restore') !== (int) $v['row']['bytes'] || hash_file('sha256', $path.'.restore') !== $hash || ! rename($path.'.restore', $path)) {
                        throw new \RuntimeException('Restored blob failed verification');
                    }
                }
                fclose($manifest);
                $stream = $zip->getStream('archive.jsonl');
                fgets($stream);
                try {
                    DB::transaction(function () use ($stream) {
                        while (($line = fgets($stream)) !== false) {
                            $v = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                            if (in_array($v['table'] ?? '', self::TABLES, true)) {
                                DB::table('zt_archive_'.$v['table'])->insertOrIgnore($v['row']);
                            }
                        }
                    });
                } finally {
                    fclose($stream);
                }

                return $result;
            } finally {
                $zip->close();
            }
        });
    }

    private function writeLine($stream, mixed $value): void
    {
        $line = ZaloTeamArchive::json($value)."\n";
        if (fwrite($stream, $line) !== strlen($line)) {
            throw new \RuntimeException('Cannot write complete backup manifest');
        }
    }

    private function blobPath(string $owner, string $hash): string
    {
        // Validate both components with the same strict content-addressed path contract.
        $this->files->path($owner, $hash);

        return config('zalo_team.backup_path').'/'.$owner.'/blobs/'.$hash.'.zip';
    }

    private function saveBlob(string $owner, string $hash, string $file, string $password): void
    {
        $path = $this->blobPath($owner, $hash);
        if (ZaloTeamDriveStore::enabled()) {
            $path = app(ZaloTeamDriveStore::class)->read($owner, 'backup-blob', $hash);
        }
        if (is_file($path)) {
            return;
        } // Immutable encrypted blob reused across daily snapshots.
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0700, true);
        }
        $zip = new \ZipArchive;
        if ($zip->open($path.'.tmp', \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Cannot create backup blob');
        }
        $zip->setPassword($password);
        $zip->addFile($file, 'content');
        $zip->setCompressionName('content', \ZipArchive::CM_STORE);
        if (! $zip->setEncryptionName('content', \ZipArchive::EM_AES_256) || ! $zip->close()) {
            throw new \RuntimeException('Cannot encrypt blob');
        }
        chmod($path.'.tmp', 0600);
        if (! rename($path.'.tmp', $path)) {
            throw new \RuntimeException('Cannot commit backup blob');
        }
    }

    private function openBlob(string $owner, string $hash): \ZipArchive
    {
        $zip = new \ZipArchive;
        $path = ZaloTeamDriveStore::enabled() ? app(ZaloTeamDriveStore::class)->read($owner, 'backup-blob', $hash) : $this->blobPath($owner, $hash);
        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Backup blob missing');
        }
        $zip->setPassword(config('zalo_team.backup_password'));

        return $zip;
    }

    private function readPath(string $owner, string $id): string
    {
        $path = $this->path($owner, $id);
        return ZaloTeamDriveStore::enabled() ? app(ZaloTeamDriveStore::class)->read($owner, 'backup-manifest', $id) : $path;
    }
}
