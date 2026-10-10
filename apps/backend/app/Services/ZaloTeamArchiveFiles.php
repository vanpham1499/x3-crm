<?php

namespace App\Services;

use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZaloTeamArchiveFiles
{
    public function readPath(string $owner, string $hash): string
    {
        return ZaloTeamDriveStore::enabled()
            ? app(ZaloTeamDriveStore::class)->read($owner, 'archive', $hash)
            : $this->path($owner, $hash);
    }

    public function available(string $owner, string $hash, int $bytes): bool
    {
        return app(ZaloTeamDriveStore::class)->available($owner, $hash, $bytes);
    }

    public function intact(string $owner, string $hash, int $bytes): bool
    {
        $path = $this->path($owner, $hash);
        clearstatcache(true, $path);
        // Inventory checks must not download the entire cold archive just to list it.
        return is_file($path) ? filesize($path) === $bytes && hash_file('sha256', $path) === $hash
            : $this->available($owner, $hash, $bytes);
    }

    public function path(string $owner, string $hash): string
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $owner) || ! preg_match('/^[a-f0-9]{64}$/', $hash)) {
            throw new \InvalidArgumentException('Invalid blob');
        }

        return config('zalo_team.archive_path').'/blobs/'.$owner.'/'.substr($hash, 0, 2).'/'.$hash;
    }

    public function pending(string $owner, int $seconds, ?callable $progress = null): void
    {
        $started = microtime(true);
        $outcomes = [];
        $rows = DB::table('zt_archive_assets as a')->join('zt_archive_messages as m', 'm.id', '=', 'a.message_id')->where('a.owner', $owner)->whereIn('a.state', ['pending', 'error'])->where('a.attempts', '<', 5)
            ->where(fn ($q) => $q->whereNull('a.retry_at')->orWhere('a.retry_at', '<=', now()))
            ->orderByRaw('CASE WHEN m.time >= ? THEN 0 ELSE 1 END', [now()->subDays(30)->getTimestampMs()])
            ->orderBy('a.attempts')->orderBy('m.time')->orderBy('a.id')->limit(200)->get(['a.*', 'm.time', 'm.content']);
        foreach ($rows as $a) {
            if (microtime(true) - $started > $seconds) {
                break;
            }
            if ($a->url !== '' && isset($outcomes[$a->url])) {
                DB::table('zt_archive_assets')->where('id', $a->id)->update($outcomes[$a->url]);

                continue;
            }
            if ($progress) {
                $body = json_decode($a->content, true);
                $index = (int) explode('.', $a->slot)[1];
                $progress(['file' => $body['attachments'][$index]['name'] ?? 'Tệp đính kèm', 'time' => (int) $a->time]);
            }
            $this->download($a);
            $result = DB::table('zt_archive_assets')->where('id', $a->id)->first(['state', 'hash', 'bytes', 'mime', 'attempts', 'retry_at', 'error']);
            if ($a->url !== '' && $result && in_array($result->state, ['ready', 'error'], true)) {
                $outcomes[$a->url] = (array) $result;
            }
        }
    }

    public function download(object $a): void
    {
        $tmp = null;
        try {
            if ($this->reuseOriginalPreview($a)) {
                return;
            }
            // Local PC blobs have no URL. An empty locator is never a shared file identity.
            if (trim($a->url) === '') {
                throw new \RuntimeException('PC source missing');
            }
            $existing = DB::table('zt_archive_assets')->where('owner', $a->owner)->where('url', $a->url)->where('state', 'ready')->first();
            if ($existing && $this->available($a->owner, $existing->hash, (int) $existing->bytes)
                && hash_file('sha256', $this->readPath($a->owner, $existing->hash)) === $existing->hash) {
                DB::table('zt_archive_assets')->where('id', $a->id)->update(['hash' => $existing->hash, 'bytes' => $existing->bytes, 'mime' => $existing->mime, 'state' => 'ready', 'error' => null, 'retry_at' => null]);

                return;
            }
            $dir = config('zalo_team.archive_path').'/tmp';
            if (! is_dir($dir)) {
                mkdir($dir, 0700, true);
            }
            $tmp = tempnam($dir, 'asset-');
            chmod($tmp, 0600);
            $url = $a->url;
            $limit = config('zalo_team.archive_max_file_bytes');
            $free = disk_free_space($dir);
            if ($free !== false && $free < $limit + 268435456) {
                throw new \RuntimeException('Not enough free disk space');
            }
            for ($redirect = 0; $redirect < 4; $redirect++) {
                [$host,$ip] = $this->resolve($url, (int) $a->attempts);
                $response = Http::timeout(40)->connectTimeout(8)->withOptions([
                    'sink' => $tmp, 'allow_redirects' => false, 'proxy' => '',
                    'curl' => [CURLOPT_RESOLVE => ["$host:443:$ip"]],
                    'progress' => function ($total, $downloaded) use ($limit) {
                        if ($total > $limit || $downloaded > $limit) {
                            throw new \RuntimeException('File exceeds limit');
                        }
                    },
                ])->get($url);
                if ($response->redirect()) {
                    $url = (string) UriResolver::resolve(new Uri($url), new Uri($response->header('Location')));

                    continue;
                }
                break;
            }
            if (! $response->successful()) {
                throw new \RuntimeException('HTTP '.$response->status());
            }
            $size = filesize($tmp);
            if (! $size || $size > $limit) {
                throw new \RuntimeException('Invalid file size');
            }
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);
            if (in_array($mime, ['text/html', 'application/xhtml+xml'])) {
                throw new \RuntimeException('Source returned HTML');
            }
            $content = json_decode(DB::table('zt_archive_messages')->where('id', $a->message_id)->value('content'), true);
            $index = (int) explode('.', $a->slot)[1];
            $kind = $content['attachments'][$index]['kind'] ?? '';
            if (in_array($kind, ['image', 'sticker']) && ! str_starts_with($mime, 'image/')) {
                throw new \RuntimeException('Image is encrypted or unsupported');
            }
            $hash = hash_file('sha256', $tmp);
            $path = $this->path($a->owner, $hash);
            if (! is_dir(dirname($path))) {
                mkdir(dirname($path), 0700, true);
            }
            if (! is_file($path) || hash_file('sha256', $path) !== $hash) {
                $handle = fopen($tmp, 'r+b');
                if (! $handle) {
                    throw new \RuntimeException('Cannot commit blob');
                }
                try {
                    if (function_exists('fsync') && ! fsync($handle)) {
                        throw new \RuntimeException('Cannot commit blob');
                    }
                } finally {
                    fclose($handle);
                }
                if (! rename($tmp, $path)) {
                    throw new \RuntimeException('Cannot commit blob');
                }$tmp = null;
            }
            DB::table('zt_archive_assets')->where('id', $a->id)->update(['hash' => $hash, 'bytes' => $size, 'mime' => $mime, 'state' => 'ready', 'error' => null, 'retry_at' => null]);
        } catch (\Throwable $e) {
            $this->downloadFailure($a, $e);
            $attempts = self::retryable($e) ? $a->attempts + 1 : 5;
            DB::table('zt_archive_assets')->where('id', $a->id)->update(['state' => 'error', 'attempts' => $attempts, 'retry_at' => $attempts < 5 ? now()->addMinutes(5 * $attempts) : null,
                'error' => self::failureMessage($e)]);
        } finally {
            if ($tmp && is_file($tmp)) {
                unlink($tmp);
            }
        }
    }

    public function reuseOriginalPreview(object $asset): bool
    {
        if (! preg_match('/^attachments\.(\d+)\.preview$/', $asset->slot, $match)) {
            return false;
        }
        $content = json_decode(DB::table('zt_archive_messages')->where('owner', $asset->owner)->where('id', $asset->message_id)->value('content') ?? '{}', true);
        if (($content['attachments'][(int) $match[1]]['kind'] ?? '') !== 'image') {
            return false;
        }
        // A thumbnail may use the verified original of this exact image. Never promote a thumbnail to an original.
        $original = DB::table('zt_archive_assets')->where('owner', $asset->owner)->where('message_id', $asset->message_id)
            ->where('slot', 'attachments.'.$match[1].'.url')->where('state', 'ready')->first();
        if (! $original || ! str_starts_with($original->mime ?? '', 'image/')) {
            return false;
        }
        $path = $this->readPath($asset->owner, $original->hash);
        if (! is_file($path) || filesize($path) !== (int) $original->bytes || hash_file('sha256', $path) !== $original->hash) {
            return false;
        }
        DB::table('zt_archive_assets')->where('owner', $asset->owner)->where('id', $asset->id)->whereIn('state', ['pending', 'error'])
            ->update(['hash' => $original->hash, 'bytes' => $original->bytes, 'mime' => $original->mime, 'state' => 'ready', 'error' => null, 'retry_at' => null]);

        return true;
    }

    protected function downloadFailure(object $asset, \Throwable $error): void
    {
        // Log machine-readable diagnostics only; exception text may contain signed URLs.
        $chain = [];
        $current = $error;
        for ($i = 0; $current && $i < 6; $i++, $current = $current->getPrevious()) {
            preg_match('/cURL error (\d+)/', $current->getMessage(), $curl);
            $chain[] = ['class' => get_class($current), 'code' => $current->getCode(), 'curl' => isset($curl[1]) ? (int) $curl[1] : null];
        }
        Log::warning('Archive media download failed', ['asset' => $asset->id, 'errors' => $chain]);
    }

    public function resolve(string $url, int $attempt = 0): array
    {
        $p = parse_url($url);
        $host = strtolower($p['host'] ?? '');
        if (($p['scheme'] ?? '') !== 'https' || isset($p['user']) || isset($p['pass']) || isset($p['port']) && $p['port'] !== 443
            || ! (preg_match('/(?:^|\.)(?:zdn\.vn|zalo\.me|zaloapp\.com|zadn\.vn|zimg\.vn|zing\.vn)$/', $host)
                || preg_match('/^(?:b?fg\d+|do\d+|f\d+-zvc|(?:file|video)-stal-[a-z0-9-]+)\.(?:dlfl\.vn|dlmd\.me|flchat\.vn|mdchat\.me)$/', $host)
                || in_array($host, ['fmc301.cscfdl.com', 'fmc300.cscfdl.com', 'f102-pmc.cscpdl.com'], true))) {
            throw new \RuntimeException('Unsupported media origin');
        }
        $ips = gethostbynamel($host);
        if (! $ips) {
            throw new \RuntimeException('DNS unavailable');
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new \RuntimeException('Private media origin');
            }
        }

        return [$host, $ips[max(0, $attempt) % count($ips)]];
    }

    public static function retryable(\Throwable $e): bool
    {
        return ! in_array($e->getMessage(), ['PC source missing', 'HTTP 401', 'HTTP 403', 'HTTP 404', 'HTTP 410', 'File exceeds limit', 'Invalid file size', 'Unsupported media origin', 'Private media origin', 'Image is encrypted or unsupported', 'Source returned HTML']);
    }

    public static function failureMessage(\Throwable $e): string
    {
        $reason = $e->getMessage();
        if (preg_match('/^HTTP (\d{3})$/', $reason, $match)) {
            return match ((int) $match[1]) {
                401, 403 => 'Nguồn từ chối tải (HTTP '.$match[1].'). Cần làm mới liên kết từ Zalo.',
                404, 410 => 'Liên kết tải cũ trả HTTP '.$match[1].'. Có thể kiểm tra bản tệp trên Zalo PC.',
                429 => 'Nguồn giới hạn lượt tải (HTTP 429).',
                default => 'Nguồn trả lỗi HTTP '.$match[1].'.',
            };
        }

        return match ($reason) {
            'PC source missing' => 'Chưa có tệp gốc đọc được từ Zalo PC hoặc liên kết tải.',
            'Unsupported media origin', 'Private media origin' => 'Nguồn tệp chưa được hỗ trợ hoặc không an toàn.',
            'Not enough free disk space' => 'Ổ lưu trữ không đủ dung lượng trống.',
            'File exceeds limit', 'Invalid file size' => 'Tệp rỗng hoặc vượt giới hạn dung lượng đã cấu hình.',
            'DNS unavailable' => 'Chưa phân giải được máy chủ lưu tệp.',
            'Source returned HTML' => 'Nguồn trả trang web thay vì nội dung tệp.',
            'Image is encrypted or unsupported' => 'Nguồn ảnh chưa giải mã được hoặc sai định dạng.',
            'Cannot commit blob' => 'Không ghi được tệp vào ổ lưu trữ.',
            default => $e instanceof ConnectionException
                ? 'Kết nối tải tệp bị gián đoạn hoặc quá thời gian.'
                : 'Chưa lưu được tệp do lỗi xử lý. Có thể thử tải lại.',
        };
    }
}
