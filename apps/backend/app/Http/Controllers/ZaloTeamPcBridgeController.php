<?php

namespace App\Http\Controllers;

use App\Services\ZaloTeamArchive;
use App\Services\ZaloTeamArchiveFiles;
use App\Services\ZaloTeamCatalog;
use App\Services\ZaloTeamFileImportLease;
use App\Services\ZaloTeamFilePack;
use App\Services\ZaloTeamIdentity;
use App\Services\ZaloTeamNativePreview;
use App\Services\ZaloTeamPcImport;
use App\Services\ZaloTeamPcIndex;
use App\Services\ZaloTeamPcRecovery;
use App\Services\ZaloTeamRuntime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/** Private service-to-service bridge. No cookie/session secrets or caller paths accepted. */
class ZaloTeamPcBridgeController
{
    private function user(Request $r, int $id)
    {
        ZaloTeamRuntime::authenticateService($r);

        return app(ZaloTeamIdentity::class)->bridgeActor($id);
    }

    private function directory($u, array $v): string
    {
        app(ZaloTeamArchive::class)->source($u, $v['source']);

        return config('zalo_team.archive_path').'/pc-incoming/'.ZaloTeamArchive::owner($u).'/'.$v['batch'];
    }

    public function command(Request $r, int $id)
    {
        $u = $this->user($r, $id);
        $owner = ZaloTeamArchive::owner($u);
        $v = $r->validate(['action' => 'required|in:prepare,recoveries,checked,file-status,file-plan,commit',
            'files' => 'sometimes|array|min:1|max:1024', 'files.*' => 'array', 'fileImport' => 'sometimes|boolean',
            'source' => 'sometimes|regex:/^[a-f0-9]{64}$/D', 'batch' => 'sometimes|regex:/^[a-f0-9]{64}$/D',
            'file' => ['sometimes', 'regex:#^(manifest\.json|messages\.jsonl|blobs/[a-f0-9]{64})$#D'],
            'sha256' => 'sometimes|regex:/^[a-f0-9]{64}$/D', 'bytes' => 'sometimes|integer|min:0|max:268435456',
            'accountId' => 'sometimes|integer|min:1', 'externalId' => 'sometimes|regex:/^\d{1,30}$/D',
            'conversationId' => 'sometimes|regex:/^g?\d{1,30}$/D', 'name' => 'sometimes|string|max:500',
            'conversations' => 'sometimes|array|max:20000', 'conversations.*.conversationId' => 'required|regex:/^g?\d{1,30}$/D',
            'receipts' => 'sometimes|array|max:100000', 'receipts.*' => 'regex:/^[a-f0-9]{64}$/D',
            'checks' => 'sometimes|array|max:100000', 'recoveryOnly' => 'sometimes|boolean']);
        $recovery = app(ZaloTeamPcRecovery::class);
        if (in_array($v['action'], ['prepare', 'recoveries'], true)) {
            abort_unless(isset($v['accountId'],$v['externalId']), 422);
            $accounts = app(ZaloTeamCatalog::class)->command($u, ['action' => 'status'])['accounts'] ?? [];
            $a = collect($accounts)->first(fn ($a) => $a['id'] === $v['accountId'] && ($a['externalId'] ?? '') === $v['externalId']);
            abort_unless($a, 403, 'Tài khoản PC không thuộc chủ kho.');
            if ($v['action'] === 'recoveries') {
                $recovery->seed($owner);

                return ['conversations' => $recovery->conversations($v + ['owner' => $owner])];
            }
            abort_unless(isset($v['conversationId'],$v['name']), 422);
            $source = hash('sha256', $owner.':'.$v['externalId'].':'.$v['conversationId']);
            DB::table('zt_archive_sources')->insertOrIgnore(['id' => $source, 'owner' => $owner, 'account_id' => $a['id'], 'external_id' => $a['externalId'],
                'conversation_id' => $v['conversationId'], 'canonical' => 'source:'.$source, 'name' => $v['name'], 'account_name' => $a['name'], 'accessible' => false]);
            if ($v['fileImport'] ?? false) {
                ZaloTeamFileImportLease::touch($owner);

                return ['source' => $source, 'serverPreview' => app(ZaloTeamNativePreview::class)->available()];
            }
            $index = app(ZaloTeamPcIndex::class)->build(app(ZaloTeamArchive::class)->source($u, $source));
            if ($v['recoveryOnly'] ?? false) {
                $index['recoveryIds'] = $recovery->messageIds($owner, $source);
            }

            return ['source' => $source, 'index' => $index, 'receipts' => $recovery->receipts($owner, $source)];
        }
        if ($v['action'] === 'checked') {
            $recovery->checked($owner, $v['receipts'] ?? [], $v['checks'] ?? []);
            if (isset($v['source'],$v['batch'])) {
                $dir = $this->directory($u, $v);
                // Only remove a transfer after its idempotent import has committed.
                $importId = hash('sha256', $v['source'].':pc:'.$v['batch']);
                if (DB::table('zt_archive_imports')->where('owner', $owner)->where('id', $importId)->whereIn('state', ['ready', 'conflicts'])->exists()
                    && is_dir($dir) && ! is_link($dir)) {
                    File::deleteDirectory($dir);
                }
            }

            return ['ok' => true];
        }
        abort_unless(isset($v['source'],$v['batch']), 422);
        $dir = $this->directory($u, $v);
        if (in_array($v['action'], ['file-plan', 'commit'], true)) {
            ZaloTeamFileImportLease::touch($owner);
        }
        if ($v['action'] === 'file-plan') {
            abort_unless(isset($v['files']), 422);
            $ready = [];
            foreach ($v['files'] as $file) {
                $file = ZaloTeamFilePack::descriptor($file);
                if ($this->ready($owner, $dir, $file)) {
                    $ready[] = $file['file'];
                }
            }

            return ['ready' => $ready];
        }
        if ($v['action'] === 'file-status') {
            abort_unless(isset($v['file'],$v['sha256'],$v['bytes']), 422);

            return ['ready' => $this->ready($owner, $dir, $v)];
        }
        abort_unless(is_file($dir.'/manifest.json') && hash_file('sha256', $dir.'/manifest.json') === $v['batch'], 422);

        try {
            return app(ZaloTeamPcImport::class)->run($u, $v['source'], $dir, true);
        } catch (\RuntimeException $e) {
            if (preg_match('/^(PC_|FILE_)[A-Z_]+$/D', $e->getMessage())) {
                return response()->json(['code' => $e->getMessage()], 422);
            }
            throw $e;
        }
    }

    private function ready(string $owner, string $dir, array $v): bool
    {
        $path = $dir.'/'.$v['file'];

        // Reuse only an owned, verified blob. Hard links avoid another upload and disk copy.
        if (! is_file($path) && $v['file'] === 'blobs/'.$v['sha256']
            && DB::table('zt_archive_assets')->where('owner', $owner)->where('hash', $v['sha256'])->where('state', 'ready')->exists()) {
            $stored = app(ZaloTeamArchiveFiles::class)->readPath($owner, $v['sha256']);
            if (is_file($stored) && ! is_link($stored) && filesize($stored) === $v['bytes'] && hash_file('sha256', $stored) === $v['sha256']) {
                if (! is_dir($dir.'/blobs')) {
                    mkdir($dir.'/blobs', 0700, true);
                }
                if (! @link($stored, $path)) {
                    copy($stored, $path);
                }
            }
        }

        return is_file($path) && ! is_link($path) && filesize($path) === $v['bytes'] && hash_file('sha256', $path) === $v['sha256'];
    }

    public function uploadPack(Request $r, int $id)
    {
        $u = $this->user($r, $id);
        $v = $r->validate(['source' => 'required|regex:/^[a-f0-9]{64}$/D', 'batch' => 'required|regex:/^[a-f0-9]{64}$/D']);
        $length = filter_var($r->header('Content-Length'), FILTER_VALIDATE_INT);
        abort_unless($length !== false, 411);
        $dir = $this->directory($u, $v);
        ZaloTeamFileImportLease::touch(ZaloTeamArchive::owner($u));
        $in = $r->getContent(true);
        try {
            return app(ZaloTeamFilePack::class)->receive($in, $dir, $length);
        } finally {
            fclose($in);
        }
    }

    public function upload(Request $r, int $id)
    {
        $u = $this->user($r, $id);
        $v = $r->validate(['source' => 'required|regex:/^[a-f0-9]{64}$/D', 'batch' => 'required|regex:/^[a-f0-9]{64}$/D',
            'file' => ['required', 'regex:#^(manifest\.json|messages\.jsonl|blobs/[a-f0-9]{64})$#D']]);
        $hash = $r->header('X-Content-SHA256', '');
        abort_unless(preg_match('/^[a-f0-9]{64}$/D', $hash), 422);
        $limit = $v['file'] === 'manifest.json' ? 16777216 : 268435456;
        $expected = filter_var($r->header('Content-Length'), FILTER_VALIDATE_INT);
        abort_unless($expected !== false && $expected >= 0 && $expected <= $limit, 413);
        $dir = $this->directory($u, $v);
        if (! is_dir($dir.'/blobs')) {
            mkdir($dir.'/blobs', 0700, true);
        }
        abort_unless(disk_free_space($dir) > $expected + 536870912, 507);
        $tmp = tempnam($dir, 'upload-');
        $out = fopen($tmp, 'wb');
        $in = $r->getContent(true);
        $ctx = hash_init('sha256');
        $size = 0;
        try {
            while (! feof($in)) {
                $chunk = fread($in, 1048576);
                if ($chunk === false) {
                    throw new \RuntimeException('Upload read failed');
                }$size += strlen($chunk);
                abort_if($size > $limit, 413);
                hash_update($ctx, $chunk);
                if (fwrite($out, $chunk) !== strlen($chunk)) {
                    throw new \RuntimeException('Upload write failed');
                }
            }
            abort_unless($size === $expected && hash_final($ctx) === $hash, 422, 'Upload checksum mismatch');
            fflush($out);
            fsync($out);
            fclose($out);
            $out = null;
            abort_unless(rename($tmp, $dir.'/'.$v['file']), 500);

            return ['ok' => true, 'bytes' => $size];
        } finally {
            if (is_resource($out)) {
                fclose($out);
            }fclose($in);
            if (is_file($tmp)) {
                unlink($tmp);
            }
        }
    }
}
