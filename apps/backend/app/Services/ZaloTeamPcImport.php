<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Local administrative import of a bounded, credential-free PC export.
 * This is deliberately not an HTTP filesystem-reading endpoint.
 */
class ZaloTeamPcImport
{
    public function __construct(private ZaloTeamArchive $archive, private ZaloTeamArchiveFiles $files) {}

    private function require(bool $condition, string $reason): void
    {
        if (! $condition) {
            throw new \RuntimeException($reason);
        }
    }

    private function child(string $root, string $relative): string
    {
        $path = realpath($root.'/'.$relative);
        $this->require($path !== false && is_file($path) && str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $root).'/'), 'PC_BUNDLE_PATH_INVALID');

        return $path;
    }

    private function rows(string $path): \Generator
    {
        $f = fopen($path, 'rb');
        $this->require($f !== false, 'PC_MESSAGES_UNREADABLE');
        try {
            while (($line = fgets($f, 1048577)) !== false) {
                $this->require(strlen($line) <= 1048576 && str_ends_with($line, "\n"), 'PC_MESSAGE_LINE_INVALID');
                $m = json_decode($line, true, 64, JSON_THROW_ON_ERROR);
                $this->require(is_array($m) && preg_match('/^[a-zA-Z0-9_.:-]{1,200}$/', (string) ($m['id'] ?? '')) === 1
                    && is_string($m['clientId'] ?? null) && strlen($m['clientId']) <= 200
                    && is_int($m['time'] ?? null) && $m['time'] >= 1000000000000 && $m['time'] <= now()->getTimestampMs() + 300000
                    && is_string($m['text'] ?? null) && is_bool($m['mine'] ?? null)
                    && is_array($m['attachments'] ?? null) && count($m['attachments']) <= 100
                    && is_array($m['sender'] ?? null), 'PC_MESSAGE_INVALID');
                foreach ($m['attachments'] as $a) {
                    $this->require(is_array($a) && in_array($a['kind'] ?? '', ['image', 'video', 'audio', 'file', 'sticker', 'link'], true), 'PC_ATTACHMENT_INVALID');
                    foreach (['url', 'preview'] as $field) {
                        if (! empty($a[$field])) {
                            $url = parse_url($a[$field]);
                            $this->require(($url['scheme'] ?? '') === 'https' && ! isset($url['user']) && ! isset($url['pass'])
                                && ! preg_match('/[?&#]e2ee?session(?:=|&|#|$)/i', urldecode($a[$field])), 'PC_ATTACHMENT_URL_INVALID');
                        }
                    }
                }
                yield $m;
            }
        } finally {
            fclose($f);
        }
    }

    public function run(User $user, string $sourceId, string $directory, bool $apply = false, ?callable $progress = null): array
    {
        $source = $this->archive->source($user, $sourceId);
        $root = realpath($directory);
        $this->require($root !== false && is_dir($root), 'PC_BUNDLE_NOT_FOUND');
        $manifestFile = $this->child($root, 'manifest.json');
        $this->require(filesize($manifestFile) <= 16 * 1024 * 1024, 'PC_MANIFEST_TOO_LARGE');
        $manifest = json_decode(file_get_contents($manifestFile), true, 64, JSON_THROW_ON_ERROR);
        $this->require(($manifest['format'] ?? '') === 'zalo-team-pc/1'
            && ($manifest['accountId'] ?? '') === $source->external_id
            && ($manifest['conversationId'] ?? '') === $source->conversation_id, 'PC_SOURCE_IDENTITY_MISMATCH');
        $this->require(is_array($manifest['assets'] ?? null) && count($manifest['assets']) <= 100000, 'PC_ASSET_LIMIT');
        $path = $this->child($root, 'messages.jsonl');
        $this->require(filesize($path) <= 256 * 1024 * 1024 && hash_file('sha256', $path) === ($manifest['messages']['sha256'] ?? ''), 'PC_MESSAGES_CHECKSUM_MISMATCH');
        $ids = [];
        $identities = [];
        $count = 0;
        foreach ($this->rows($path) as $m) {
            $this->require(! isset($ids[$m['id']]), 'PC_DUPLICATE_EXPORT_ID');
            $ids[$m['id']] = array_map(fn ($a) => $a['kind'], $m['attachments']);
            $identities[$m['id']] = [$m['time'], $m['clientId'], $m['archiveProjection'] ?? 1, ZaloTeamPcIndex::mediaFingerprint(json_decode(ZaloTeamArchive::json($m)))];
            $count++;
            $this->require($count <= 100000, 'PC_MESSAGE_COUNT_LIMIT');
        }
        $this->require($count === ($manifest['messages']['count'] ?? -1), 'PC_MESSAGE_COUNT_MISMATCH');
        $blobs = [];
        foreach ($manifest['assets'] as $asset) {
            $this->require(preg_match('/^[a-f0-9]{64}$/', $asset['hash'] ?? '') === 1
                && preg_match('/^attachments\.(\d+)\.(url|preview)$/', $asset['slot'] ?? '', $slot) === 1
                && isset($ids[$asset['messageId']][(int) $slot[1]]) && $ids[$asset['messageId']][(int) $slot[1]] !== 'link', 'PC_ASSET_INVALID');
            $file = $this->child($root, 'blobs/'.$asset['hash']);
            $this->require(filesize($file) === $asset['bytes'] && $asset['bytes'] > 0 && $asset['bytes'] <= config('zalo_team.archive_max_file_bytes')
                && hash_file('sha256', $file) === $asset['hash'], 'PC_ASSET_CHECKSUM_MISMATCH');
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file);
            // Older libmagic builds miss some native JPEG XL codestreams.
            if ($mime === 'application/octet-stream') {
                $head = file_get_contents($file, false, null, 0, 12);
                if (str_starts_with($head, "\xff\x0a") || $head === "\x00\x00\x00\x0cJXL \x0d\x0a\x87\x0a") {
                    $mime = 'image/jxl';
                }
            }
            $this->require(! in_array($mime, ['text/html', 'application/xhtml+xml'])
                && (! in_array($ids[$asset['messageId']][(int) $slot[1]], ['image', 'sticker']) || str_starts_with($mime, 'image/')), 'PC_ASSET_FORMAT_INVALID');
            $blobs[] = $asset + ['path' => $file, 'mime' => $mime];
        }
        $previewErrors = [];
        $generatedPreviews = 0;
        if (($manifest['previewMode'] ?? '') === 'server-jxl/1') {
            $slots = array_fill_keys(array_map(fn ($b) => $b['messageId'].':'.$b['slot'], $blobs), true);
            foreach ($blobs as $blob) {
                if ($blob['mime'] !== 'image/jxl' || ! str_ends_with($blob['slot'], '.url') || isset($slots[$blob['messageId'].':'.str_replace('.url', '.preview', $blob['slot'])])) {
                    continue;
                }
                try {
                    $blobs[] = app(ZaloTeamNativePreview::class)->create($blob, $root);
                    $generatedPreviews++;
                } catch (\Throwable $e) {
                    if ($e->getMessage() === 'FILE_PREVIEW_BUSY') {
                        abort(409, 'Đang xử lý ảnh cho lượt nhập khác.');
                    }
                    $previewErrors[] = ['messageId' => $blob['messageId'], 'time' => $identities[$blob['messageId']][0], 'name' => 'Ảnh xem trước', 'reason' => 'FILE_PREVIEW_FAILED'];
                }
            }
        }
        $id = hash('sha256', $source->id.':pc:'.hash_file('sha256', $manifestFile));
        $report = ['total' => $count, 'processed' => 0, 'added' => 0, 'existing' => 0, 'conflicts' => 0, 'files' => 0,
            'name' => $source->name, 'accountName' => $source->account_name, 'oldest' => $manifest['messages']['oldest'] ?? null,
            'newest' => $manifest['messages']['newest'] ?? null, 'coverage' => $manifest['coverage'] ?? null,
            'generatedPreviews' => $generatedPreviews, 'previewErrors' => $previewErrors];
        if (! $apply) {
            return ['id' => $id, 'state' => 'validated', 'summary' => $report];
        }

        return $this->archive->withLock($source->owner, function () use ($source, $path, $id, $blobs, $identities, $report, $progress) {
            $prior = DB::table('zt_archive_imports')->where('id', $id)->first();
            $filesIntact = true;
            if (in_array($prior?->state, ['ready', 'conflicts'], true)) {
                foreach ($blobs as $blob) {
                    if (! $this->files->intact($source->owner, $blob['hash'], (int) $blob['bytes'])) {
                        $filesIntact = false;
                        break;
                    }
                }
            }
            if (in_array($prior?->state, ['ready', 'conflicts'], true) && $filesIntact) {
                return ['id' => $id, 'state' => $prior->state, 'replayed' => true, 'summary' => json_decode($prior->summary, true)];
            }
            if ($prior) {
                $report = json_decode($prior->summary, true);
            }
            DB::table('zt_archive_imports')->updateOrInsert(['id' => $id], ['owner' => $source->owner, 'source_id' => $source->id, 'kind' => 'pc',
                'state' => 'running', 'summary' => ZaloTeamArchive::json($report), 'created_at' => $prior?->created_at ?? now(), 'updated_at' => now()]);
            $line = 0;
            try {
                foreach ($this->batches($path) as $batch) {
                    DB::transaction(function () use ($source, $id, $batch, &$line, &$report) {
                        $known = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
                            ->where('o.source_id', $source->id)->whereIn('o.native_id', array_column($batch, 'id'))->get(['o.native_id', 'o.message_id', 'o.view', 'o.deleted', 'm.content', 'm.time'])->keyBy('native_id');
                        $contents = $observations = $assets = $replaced = $versions = [];
                        foreach ($batch as $m) {
                            if ($line++ < $report['processed']) {
                                continue;
                            }
                            $old = $known->get($m['id']);
                            $repair = false;
                            $disposition = 'applied';
                            if ($old) {
                                $body = json_decode($old->content, true);
                                $oldView = json_decode($old->view, true);
                                $versions[] = ['message' => array_merge($body, $oldView), 'origin' => 'stored', 'disposition' => 'retained'];
                                if ((int) $old->time !== $m['time'] || ($body['clientId'] ?? '') !== $m['clientId']) {
                                    $report['conflicts']++;
                                    $disposition = 'conflict';
                                } elseif (! $old->deleted && ($oldView['archiveOrigin'] ?? '') === 'pc' && ($oldView['archiveProjection'] ?? 1) < ($m['archiveProjection'] ?? 1)) {
                                    $repair = true;
                                    $replaced[] = $old->message_id;
                                    $report['repaired'] = ($report['repaired'] ?? 0) + 1;
                                } elseif (! $old->deleted && ($oldView['archiveOrigin'] ?? '') === 'pc'
                                    && ZaloTeamPcIndex::fingerprint((object) array_merge((array) json_decode($old->content), (array) json_decode($old->view))) !== ZaloTeamPcIndex::fingerprint(json_decode(ZaloTeamArchive::json($m)))) {
                                    $report['conflicts']++;
                                    $disposition = 'conflict';
                                } else {
                                    $report['existing']++;
                                    $disposition = 'retained';
                                }
                                // Live edits, reactions, recall and deletion always win.
                            }
                            $versions[] = ['message' => $m, 'origin' => 'pc', 'disposition' => $disposition];
                            $sameMedia = $old && ZaloTeamPcIndex::mediaFingerprint((object) array_merge((array) json_decode($old->content), (array) json_decode($old->view)))
                                === ZaloTeamPcIndex::mediaFingerprint(json_decode(ZaloTeamArchive::json($m)));
                            if ($old && ! $old->deleted && ($disposition === 'retained' || $sameMedia) && ($oldView['archiveOrigin'] ?? '') === 'pc') {
                                ['urls' => $refreshedUrls] = $this->archive->prepareMessage($source, $m);
                                foreach ($refreshedUrls as $slot => $url) {
                                    DB::table('zt_archive_assets')->where('message_id', $old->message_id)->where('slot', $slot)->whereNull('hash')->where('url', '!=', $url)
                                        ->update(['url' => $url, 'state' => 'pending', 'attempts' => 0, 'retry_at' => null, 'error' => null]);
                                }
                            }
                            if (! $old || $repair) {
                                $m['archiveOrigin'] = 'pc';
                                $m['canRecall'] = false;
                                ['id' => $mid, 'body' => $body, 'urls' => $urls] = $this->archive->prepareMessage($source, $m);
                                $contents[] = ['id' => $mid, 'owner' => $source->owner, 'canonical' => $source->canonical, 'native_id' => $m['id'], 'time' => $m['time'], 'content' => ZaloTeamArchive::json($body)];
                                $observations[] = ['id' => hash('sha256', $source->id.':'.$m['id']), 'source_id' => $source->id, 'message_id' => $mid,
                                    'native_id' => $m['id'], 'view' => ZaloTeamArchive::json(array_diff_key($m, $body)), 'deleted' => false, 'observed_at' => now()];
                                foreach ($urls as $slot => $url) {
                                    $assets[] = ['id' => hash('sha256', $mid.':'.$slot), 'owner' => $source->owner, 'message_id' => $mid,
                                        'slot' => $slot, 'url' => $url, 'state' => 'pending', 'attempts' => 0, 'error' => null];
                                }
                                foreach ($m['attachments'] as $index => $attachment) {
                                    if (($attachment['kind'] ?? '') !== 'link' && empty($attachment['url'])) {
                                        $slot = 'attachments.'.$index.'.url';
                                        $assets[] = ['id' => hash('sha256', $mid.':'.$slot),
                                            'owner' => $source->owner, 'message_id' => $mid, 'slot' => $slot, 'url' => '', 'state' => 'error', 'attempts' => 5,
                                            'error' => ! empty($m['archiveFileImport']) ? 'Tệp này không có bản gốc đọc được trong file xuất Zalo.' : 'Chưa có tệp gốc đọc được từ Zalo PC hoặc liên kết tải.'];
                                    }
                                }
                                if (! $repair) {
                                    $report['added']++;
                                }
                            }
                            $report['processed']++;
                        }
                        ZaloTeamArchiveVersions::recordMany($source, $versions);
                        foreach (['messages' => $contents, 'observations' => $observations, 'assets' => $assets] as $table => $rows) {
                            foreach (array_chunk($rows, 100) as $chunk) {
                                if ($table === 'observations') {
                                    // Never reset deletion state during a projection repair.
                                    DB::table('zt_archive_observations')->upsert($chunk, ['id'], ['message_id', 'view', 'observed_at']);
                                } else {
                                    DB::table('zt_archive_'.$table)->insertOrIgnore($chunk);
                                }
                            }
                        }
                        // Keep retired content and asset references for recovery.
                        // Current observations alone determine chat rows, so this
                        // preserves older versions without duplicating messages.
                        $this->archive->refreshRange($source);
                        DB::table('zt_archive_imports')->where('id', $id)->update(['summary' => ZaloTeamArchive::json($report), 'updated_at' => now()]);
                    });
                    if ($report['processed'] % 100 === 0 && $progress) {
                        $progress($report);
                    }
                }
                // Files supplement imported PC observations only; never overwrite a
                // newer Web attachment or resurrect a deleted/withdrawn message.
                $storedFiles = 0;
                $report['filesAdded'] = 0;
                $report['filesReused'] = 0;
                $report['availableFiles'] = count($blobs);
                $report['phase'] = 'files';
                DB::table('zt_archive_imports')->where('id', $id)->update(['summary' => ZaloTeamArchive::json($report), 'updated_at' => now()]);
                foreach ($blobs as $blob) {
                    $o = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
                        ->where('o.source_id', $source->id)->where('o.native_id', $blob['messageId'])->where('o.deleted', false)->first(['o.message_id', 'o.view', 'm.content', 'm.time']);
                    $view = $o ? json_decode($o->view, true) : [];
                    $body = $o ? json_decode($o->content, true) : [];
                    if (! $o || ($view['archiveOrigin'] ?? null) !== 'pc'
                        || [(int) $o->time, $body['clientId'] ?? '', $view['archiveProjection'] ?? 1,
                            ZaloTeamPcIndex::mediaFingerprint((object) array_merge((array) json_decode($o->content), (array) json_decode($o->view)))] !== $identities[$blob['messageId']]) {
                        continue;
                    }
                    $assetId = hash('sha256', $o->message_id.':'.$blob['slot']);
                    $existing = DB::table('zt_archive_assets')->where('id', $assetId)->first();
                    if ($existing && $existing->state === 'ready' && $existing->hash) {
                        if ($this->files->intact($source->owner, $existing->hash, (int) $existing->bytes)) {
                            if ($existing->hash !== $blob['hash']) {
                                $report['conflicts']++;

                                continue;
                            }
                            $report['filesReused']++;
                            $storedFiles++;

                            continue;
                        }
                    }
                    $dest = $this->files->path($source->owner, $blob['hash']);
                    if (! is_dir(dirname($dest))) {
                        mkdir(dirname($dest), 0700, true);
                    }
                    if (! is_file($dest) || hash_file('sha256', $dest) !== $blob['hash']) {
                        $tmp = $dest.'.pc-'.bin2hex(random_bytes(6));
                        try {
                            $this->require(copy($blob['path'], $tmp) && hash_file('sha256', $tmp) === $blob['hash'], 'PC_BLOB_COPY_FAILED');
                            $this->require(rename($tmp, $dest), 'PC_BLOB_COMMIT_FAILED');
                        } finally {
                            if (is_file($tmp)) {
                                unlink($tmp);
                            }
                        }
                    }
                    DB::table('zt_archive_assets')->updateOrInsert(['id' => $assetId], [
                        'owner' => $source->owner, 'message_id' => $o->message_id, 'slot' => $blob['slot'], 'url' => '',
                        'hash' => $blob['hash'], 'bytes' => $blob['bytes'], 'mime' => $blob['mime'], 'state' => 'ready', 'error' => null, 'retry_at' => null,
                    ]);
                    $storedFiles++;
                    $report['filesAdded']++;
                    if ($storedFiles % 50 === 0) {
                        $report['files'] = $storedFiles;
                        DB::table('zt_archive_imports')->where('id', $id)->update(['summary' => ZaloTeamArchive::json($report), 'updated_at' => now()]);
                        if ($progress) {
                            $progress($report);
                        }
                    }
                }
                $report['files'] = $storedFiles;
                $report['availableFiles'] = count($blobs);
                $report['phase'] = 'complete';
                $state = $report['conflicts'] ? 'conflicts' : 'ready';
                DB::table('zt_archive_imports')->where('id', $id)->update(['state' => $state, 'summary' => ZaloTeamArchive::json($report), 'updated_at' => now()]);

                return ['id' => $id, 'state' => $state, 'summary' => $report];
            } catch (\Throwable $e) {
                DB::table('zt_archive_imports')->where('id', $id)->update(['state' => 'interrupted', 'updated_at' => now()]);
                throw $e;
            }
        });
    }

    private function batches(string $path): \Generator
    {
        $batch = [];
        foreach ($this->rows($path) as $row) {
            $batch[] = $row;
            if (count($batch) === 100) {
                yield $batch;
                $batch = [];
            }
        }
        if ($batch) {
            yield $batch;
        }
    }
}
