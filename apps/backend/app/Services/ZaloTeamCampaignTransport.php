<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;

class ZaloTeamCampaignTransport
{
    public function actor(int $id): User
    {
        return app(ZaloTeamIdentity::class)->campaignActor($id);
    }

    protected function http()
    {
        $key = trim((string) @file_get_contents(config('zalo_team.connector_token_file')));
        if (! preg_match('/^[a-f0-9]{64}$/', $key)) {
            throw new \RuntimeException('WEB_CONNECTOR_UNAVAILABLE');
        }

        return Http::withToken($key)->acceptJson()->connectTimeout(5)->timeout(120)->withOptions(['allow_redirects' => false]);
    }

    public function command(array $body): array
    {
        $response = $this->http()->post(rtrim(config('zalo_team.connector_url'), '/').'/command', $body + ['owner' => ZaloTeamAccess::storageOwner()]);
        $data = $response->json();
        if (! $response->successful() || ! is_array($data) || isset($data['error'])) {
            throw new \RuntimeException($data['error'] ?? 'WEB_CONNECTOR_UNAVAILABLE');
        }

        return $data;
    }

    public function upload($asset, int $account, string $peer): string
    {
        $path = rtrim(config('zalo_team.campaign_path'), '/\\').DIRECTORY_SEPARATOR.$asset->id;

        return $this->uploadFile($path, $asset, $account, $peer);
    }

    public function uploadFile(string $path, object $asset, int $account, string $peer): string
    {
        if (! is_file($path) || ! hash_equals($asset->sha256, hash_file('sha256', $path))) {
            throw new \RuntimeException('CAMPAIGN_ASSET_MISSING');
        }
        $stream = fopen($path, 'rb');
        try {
            $meta = ['owner' => ZaloTeamAccess::storageOwner(), 'accountId' => $account, 'conversationId' => $peer,
                'name' => $asset->name, 'mime' => $asset->mime, 'size' => (int) $asset->bytes, 'kind' => $asset->kind];
            $r = $this->http()->withHeaders(['X-Zalo-Upload' => rawurlencode(json_encode($meta))])->withBody($stream, 'application/octet-stream')
                ->post(rtrim(config('zalo_team.connector_url'), '/').'/upload');
            if (! $r->successful() || ! $r->json('uploadId')) {
                throw new \RuntimeException('WEB_UPLOAD_FAILED');
            }

            return $r->json('uploadId');
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }
}
