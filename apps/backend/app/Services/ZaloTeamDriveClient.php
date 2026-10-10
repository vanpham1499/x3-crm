<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/** Narrow Drive transport: create, read and resume only. No sharing, overwrite or delete API. */
class ZaloTeamDriveClient
{
    private string $token = '';
    private int $expires = 0;
    private array $allocatedIds = [];
    private ?array $checkedDestination = null;
    private int $destinationExpires = 0;
    private const API = 'https://www.googleapis.com/drive/v3/';

    protected function http(): PendingRequest
    {
        if ($this->expires < time() + 60) {
            $path = config('zalo_team.drive.credentials_file');
            $key = $path && is_file($path) ? json_decode(file_get_contents($path), true) : null;
            if (! is_array($key) || ($key['type'] ?? '') !== 'service_account') {
                throw new \RuntimeException('drive_credentials_missing');
            }
            $encode = fn ($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
            $header = $encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claim = $encode(json_encode(['iss' => $key['client_email'], 'scope' => 'https://www.googleapis.com/auth/drive',
                'aud' => 'https://oauth2.googleapis.com/token', 'iat' => time(), 'exp' => time() + 3600]));
            if (! openssl_sign($header.'.'.$claim, $signature, $key['private_key'], OPENSSL_ALGO_SHA256)) {
                throw new \RuntimeException('drive_credentials_invalid');
            }
            $response = Http::asForm()->timeout(20)->connectTimeout(8)->withOptions(['allow_redirects' => false])->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $header.'.'.$claim.'.'.$encode($signature),
            ]);
            $this->check($response);
            $this->token = (string) $response->json('access_token');
            if ($this->token === '') {
                throw new \RuntimeException('drive_credentials_invalid');
            }
            $this->expires = time() + min(3600, (int) $response->json('expires_in', 3600));
        }

        return Http::withToken($this->token)->timeout(120)->connectTimeout(10)->withOptions(['allow_redirects' => false]);
    }

    private function check(Response $response, array $extra = []): void
    {
        if ($response->status() === 401) { $this->expires = 0; }
        if (! $response->successful() && ! in_array($response->status(), $extra, true)) {
            throw new \RuntimeException('drive_http_'.$response->status());
        }
    }

    private function id(string $id): string
    {
        if (! preg_match('/^[A-Za-z0-9_-]{5,128}$/D', $id)) {
            throw new \RuntimeException('drive_invalid_id');
        }

        return $id;
    }

    public function metadata(string $id): ?array
    {
        $r = $this->http()->get(self::API.'files/'.$this->id($id), ['supportsAllDrives' => 'true',
            'fields' => 'id,name,size,sha256Checksum,md5Checksum,trashed,driveId,parents,mimeType,appProperties,capabilities(canAddChildren,canDelete,canTrash)']);
        if ($r->status() === 404) {
            return null;
        }
        $this->check($r);

        return $r->json();
    }

    public function destination(): array
    {
        if ($this->checkedDestination && $this->destinationExpires > time()) { return $this->checkedDestination; }
        $m = $this->metadata((string) config('zalo_team.drive.folder_id'));
        if (! $m || ($m['trashed'] ?? false) || ($m['mimeType'] ?? '') !== 'application/vnd.google-apps.folder'
            || ($m['driveId'] ?? '') !== config('zalo_team.drive.shared_drive_id')
            || ($m['id'] ?? '') === ($m['driveId'] ?? '')) {
            throw new \RuntimeException('drive_destination_invalid');
        }
        if (($m['capabilities']['canAddChildren'] ?? false) !== true) {
            throw new \RuntimeException('drive_destination_read_only');
        }
        // Fail closed if the service account has been granted a deletion-capable role.
        if (($m['capabilities']['canDelete'] ?? true) || ($m['capabilities']['canTrash'] ?? true)) {
            throw new \RuntimeException('drive_delete_permission_present');
        }

        $this->destinationExpires = time() + 60;
        return $this->checkedDestination = $m;
    }

    public function allocate(): string
    {
        if (! $this->allocatedIds) {
            $r = $this->http()->get(self::API.'files/generateIds', ['count' => 100, 'space' => 'drive', 'type' => 'files']);
            $this->check($r);
            $this->allocatedIds = array_map(fn ($id) => $this->id((string) $id), $r->json('ids', []));
        }
        return $this->id((string) array_pop($this->allocatedIds));
    }

    /** Small files use one bounded request. A persisted ID makes an uncertain response recoverable. */
    public function small(object $o, string $bytes): array
    {
        if (strlen($bytes) !== (int) $o->bytes || strlen($bytes) > 8388608) { throw new \RuntimeException('drive_local_read_failed'); }
        $boundary = 'zt_'.bin2hex(random_bytes(20));
        $metadata = json_encode(['id' => $this->id($o->drive_id), 'name' => $o->kind.'-'.$o->object_key,
            'parents' => [$this->id($o->folder_id)], 'appProperties' => ['app' => 'x3-zalo-team', 'owner' => $o->owner,
                'kind' => $o->kind, 'key' => $o->object_key, 'sha256' => $o->checksum]], JSON_THROW_ON_ERROR);
        $body = "--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$metadata\r\n--$boundary\r\nContent-Type: application/octet-stream\r\n\r\n".$bytes."\r\n--$boundary--\r\n";
        $r = $this->http()->withBody($body, 'multipart/related; boundary='.$boundary)->post(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size,sha256Checksum,parents,driveId,trashed,capabilities(canDelete,canTrash)');
        $this->check($r);
        return $r->json();
    }

    public function start(object $o): string
    {
        $r = $this->http()->withHeaders(['X-Upload-Content-Type' => 'application/octet-stream', 'X-Upload-Content-Length' => (string) $o->bytes])
            ->post('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', [
                'id' => $this->id($o->drive_id), 'name' => $o->kind.'-'.$o->object_key, 'parents' => [$this->id($o->folder_id)],
                'appProperties' => ['app' => 'x3-zalo-team', 'owner' => $o->owner, 'kind' => $o->kind, 'key' => $o->object_key, 'sha256' => $o->checksum],
            ]);
        $this->check($r);
        $uri = $r->header('Location');
        $this->session($uri);

        return $uri;
    }

    private function session(string $uri): void
    {
        $p = parse_url($uri);
        if (! $p || ($p['scheme'] ?? '') !== 'https' || ($p['host'] ?? '') !== 'www.googleapis.com'
            || ! preg_match('#^/upload/drive/v3/files(?:/[A-Za-z0-9_-]+)?$#D', $p['path'] ?? '')
            || isset($p['user']) || isset($p['pass']) || isset($p['fragment']) || isset($p['port'])) {
            throw new \RuntimeException('drive_invalid_session');
        }
    }

    public function probe(string $uri, int $size): array
    {
        $this->session($uri);
        return $this->uploadResult($this->http()->withHeaders(['Content-Range' => 'bytes */'.$size])->withBody('', 'application/octet-stream')->put($uri), $size);
    }

    public function chunk(string $uri, string $bytes, int $offset, int $size): array
    {
        $this->session($uri);
        $r = $this->http()->withHeaders(['Content-Range' => 'bytes '.$offset.'-'.($offset + strlen($bytes) - 1).'/'.$size])
            ->withBody($bytes, 'application/octet-stream')->put($uri);

        return $this->uploadResult($r, $size);
    }

    private function uploadResult(Response $r, int $size): array
    {
        if (in_array($r->status(), [404, 410], true)) {
            return ['expired' => true, 'offset' => 0];
        }
        $this->check($r, [308]);
        $offset = 0;
        if ($r->status() === 308 && preg_match('/^bytes=0-(\d+)$/D', $r->header('Range'), $match)) {
            $offset = (int) $match[1] + 1;
        } elseif ($r->successful()) {
            $offset = $size;
        }
        if ($offset > $size) {
            throw new \RuntimeException('drive_invalid_offset');
        }

        return ['expired' => false, 'offset' => $offset];
    }

    public function download(string $id, string $path, int $size): void
    {
        $r = $this->http()->withOptions(['sink' => $path, 'progress' => function ($total, $downloaded) use ($size) {
            if ($total > $size || $downloaded > $size) {
                throw new \RuntimeException('drive_download_size_mismatch');
            }
        }])->get(self::API.'files/'.$this->id($id), ['alt' => 'media', 'supportsAllDrives' => 'true']);
        $this->check($r);
    }

    public function catalog(?string $cursor = null): array
    {
        $folder = $this->id((string) config('zalo_team.drive.folder_id'));
        $query = ['q' => "'$folder' in parents and trashed = false and appProperties has { key='app' and value='x3-zalo-team' }",
            'corpora' => 'drive', 'driveId' => $this->id((string) config('zalo_team.drive.shared_drive_id')),
            'includeItemsFromAllDrives' => 'true', 'supportsAllDrives' => 'true', 'pageSize' => 100,
            'fields' => 'nextPageToken,files(id,size,sha256Checksum,appProperties,parents,driveId,capabilities(canDelete,canTrash))'];
        if ($cursor) {
            $query['pageToken'] = $cursor;
        }
        $r = $this->http()->get(self::API.'files', $query);
        $this->check($r);

        return $r->json();
    }
}
