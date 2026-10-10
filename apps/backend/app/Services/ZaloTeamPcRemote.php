<?php

namespace App\Services;

use App\Models\User;
use GuzzleHttp\Psr7\AppendStream;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/** Windows reads the PC; the dedicated service owns all archive writes. */
class ZaloTeamPcRemote
{
    public function enabled(): bool
    {
        return (bool) config('zalo_team.remote_api_url');
    }

    public function call(User $user, string $action, array $data = [], ?callable $pulse = null): array
    {
        try {
            $r = Http::acceptJson()->withHeaders(['X-Zalo-Service-Key' => ZaloTeamRuntime::key()])
                ->connectTimeout(5)->timeout(900)->withOptions(['allow_redirects' => false,
                    'progress' => function () use ($pulse) {
                        if ($pulse) {
                            $pulse();
                        }
                    }])
                ->post(rtrim(config('zalo_team.remote_api_url'), '/').'/internal/zalo-team/pc/'.$user->id,
                    ['action' => $action] + $data);
        } catch (ConnectionException) {
            throw new ZaloTeamImportTransportException('PC_REMOTE_NETWORK', true, 0, $action);
        }
        $this->checkResponse($r, $action);
        $body = $r->json();
        if (! is_array($body)) {
            throw new \RuntimeException('PC_REMOTE_RESPONSE_INVALID');
        }

        return $body;
    }

    private function checkResponse($r, string $stage): void
    {
        if ($r->successful()) {
            return;
        }
        $status = $r->status();
        $code = $r->json('code');
        $reason = match ($status) {
            409, 423 => 'PC_ARCHIVE_BUSY',
            401, 403 => 'PC_REMOTE_UNAUTHORIZED',
            507 => 'FILE_DISK_FULL',
            default => is_string($code) && preg_match('/^(PC_|FILE_)[A-Z_]+$/D', $code) ? $code : 'PC_REMOTE_HTTP_'.$status,
        };
        throw new ZaloTeamImportTransportException($reason, in_array($status, [408, 409, 423, 429, 500, 502, 503, 504]), $status, $stage);
    }

    public function upload(User $user, string $source, string $directory, callable $pulse, ?callable $beforeUpload = null, ?callable $transferred = null): array
    {
        $lastPulse = 0.0;
        $notify = $pulse;
        $pulse = function () use (&$lastPulse, $notify) {
            if (microtime(true) - $lastPulse >= 1) {
                $lastPulse = microtime(true);
                $notify();
            }
        };
        $manifest = $directory.'/manifest.json';
        $batch = hash_file('sha256', $manifest);
        $files = ['manifest.json', 'messages.jsonl'];
        foreach (glob($directory.'/blobs/*') ?: [] as $file) {
            if (! preg_match('/^[a-f0-9]{64}$/D', basename($file))) {
                throw new \RuntimeException('PC_UPLOAD_PATH_INVALID');
            }
            $files[] = 'blobs/'.basename($file);
        }
        $descriptors = [];
        foreach ($files as $relative) {
            $pulse();
            $file = $directory.'/'.$relative;
            $hash = hash_file('sha256', $file);
            $size = filesize($file);
            $descriptors[] = ZaloTeamFilePack::descriptor(['file' => $relative, 'sha256' => $hash, 'bytes' => $size]);
        }
        $missing = [];
        foreach (array_chunk($descriptors, 1024) as $part) {
            $exists = $this->call($user, 'file-plan', ['source' => $source, 'batch' => $batch, 'files' => $part], $pulse);
            foreach ($part as $file) {
                if (! in_array($file['file'], $exists['ready'] ?? [], true)) {
                    $missing[] = $file;
                }
            }
        }
        $pack = [];
        $size = strlen(ZaloTeamFilePack::MAGIC);
        foreach ($missing as $file) {
            $next = strlen(ZaloTeamArchive::json($file)) + 1 + $file['bytes'];
            if ($pack && (count($pack) >= 128 || $size + $next > 134217728)) {
                $this->sendPack($user, $source, $batch, $directory, $pack, $pulse, $beforeUpload, $transferred);
                $pack = [];
                $size = strlen(ZaloTeamFilePack::MAGIC);
            }
            $pack[] = $file;
            $size += $next;
        }
        if ($pack) {
            $this->sendPack($user, $source, $batch, $directory, $pack, $pulse, $beforeUpload, $transferred);
        }

        return $this->call($user, 'commit', ['source' => $source, 'batch' => $batch], $pulse);
    }

    private function sendPack(User $user, string $source, string $batch, string $directory, array $files, callable $pulse, ?callable $beforeUpload, ?callable $transferred): void
    {
        $stream = new AppendStream;
        $uploaded = 0;
        try {
            $stream->addStream(Utils::streamFor(ZaloTeamFilePack::MAGIC));
            foreach ($files as $file) {
                $stream->addStream(Utils::streamFor(ZaloTeamArchive::json($file)."\n"));
                $stream->addStream(Utils::streamFor(fopen($directory.'/'.$file['file'], 'rb')));
            }
            $size = $stream->getSize();
            if ($size === null || $size > ZaloTeamFilePack::LIMIT) {
                throw new \RuntimeException('PC_UPLOAD_SIZE_INVALID');
            }
            if ($beforeUpload) {
                $beforeUpload($size);
            }
            try {
                $r = Http::acceptJson()->connectTimeout(5)->timeout(900)
                    ->withOptions(['allow_redirects' => false, 'expect' => false, 'progress' => function ($dlTotal, $dl, $upTotal, $up) use ($pulse, &$uploaded) {
                        $uploaded = max($uploaded, (int) $up);
                        $pulse();
                    }])
                    ->withHeaders(['X-Zalo-Service-Key' => ZaloTeamRuntime::key(), 'Content-Length' => (string) $size])
                    ->withBody($stream, 'application/x-zalo-team-file-pack')
                    ->put(rtrim(config('zalo_team.remote_api_url'), '/').'/internal/zalo-team/pc/'.$user->id.'/upload-pack?'.http_build_query(['source' => $source, 'batch' => $batch]));
            } catch (ConnectionException) {
                throw new ZaloTeamImportTransportException('PC_REMOTE_NETWORK', true, 0, 'upload');
            }
            $this->checkResponse($r, 'upload');
        } finally {
            $stream->close();
            if ($transferred && $uploaded > 0) {
                $transferred($uploaded);
            }
        }
    }
}
