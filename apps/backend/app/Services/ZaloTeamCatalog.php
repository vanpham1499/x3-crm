<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ZaloTeamCatalog
{
    public function command(User $user, array $body): array
    {
        if (isset($body['accountId'])) ZaloTeamAccess::allow($user, (int) $body['accountId']);
        // This service is a read catalog. Login mutations use the explicitly guarded raw method.
        abort_unless(in_array($body['action'] ?? '', ['status', 'conversations', 'messages', 'directory', 'history-sync']), 403);
        if (($body['action'] ?? '') === 'directory') abort_unless(in_array($body['directory']['kind'] ?? '', ['friends', 'groups']), 403);
        if (($body['action'] ?? '') === 'history-sync') ZaloTeamAccess::allow($user, (int) $body['accountId'], 'sync');
        $data = $this->rawCommand($user, $body);
        $ids = ZaloTeamAccess::ids($user);
        if ($ids !== null) {
            foreach (['accounts' => 'id', 'conversations' => 'accountId'] as $key => $field) {
                if (isset($data[$key])) $data[$key] = array_values(array_filter($data[$key], fn ($a) => in_array((int) $a[$field], $ids, true)));
            }
            if (isset($data['groups'])) $data['groups'] = array_values(array_filter($data['groups'], fn ($g) => collect($g['sources'])->every(fn ($s) => in_array((int) explode(':', $s)[0], $ids, true))));
        }
        unset($data['login']);
        return $data;
    }

    /** Internal connector access: callers must authorize the specific operation first. */
    public function rawCommand(User $user, array $body): array
    {
        $path = config('zalo_team.connector_token_file');
        abort_unless(is_readable($path), 503, 'Chưa kết nối được nguồn Zalo.');
        $token = trim(file_get_contents($path));
        abort_unless(preg_match('/^[a-f0-9]{64}$/', $token), 503, 'Cấu hình kết nối chưa sẵn sàng.');
        $owner = ZaloTeamArchive::owner($user);
        try {
            $r = Http::withToken($token)->timeout(45)->post(config('zalo_team.connector_url').'/command', array_merge($body, ['owner' => $owner]));
        } catch (\Throwable $e) {
            abort(503, 'Chưa đọc được nguồn Zalo. Vui lòng tải lại.');
        }
        abort_unless($r->successful() && ! $r->json('error'), 503, 'Nguồn Zalo chưa sẵn sàng. Vui lòng tải lại.');

        return $r->json();
    }

    public function load(User $user): array
    {
        $status = $this->command($user, ['action' => 'status']);
        $out = ['sources' => [], 'groups' => [], 'labels' => [], 'accounts' => [], 'unavailable' => [], 'blockedSources' => []];
        if (empty($status['accounts'])) {
            return $out;
        }
        $inbox = $this->command($user, ['action' => 'conversations']);
        foreach ($status['accounts'] ?? [] as $a) {
            $aid = $a['id'];
            $external = $a['externalId'] ?? '';
            if (($a['status'] ?? '') !== 'connected' || ! preg_match('/^\d+$/', (string) $external)) {
                $out['unavailable'][] = $a['name'];

                continue;
            }
            try {
                $friends = $this->command($user, ['action' => 'directory', 'accountId' => $aid, 'directory' => ['kind' => 'friends']]);
                $groups = $this->command($user, ['action' => 'directory', 'accountId' => $aid, 'directory' => ['kind' => 'groups']]);
            } catch (HttpException $e) {
                $out['unavailable'][] = $a['name'];

                continue;
            }
            $out['accounts'][] = ['id' => $aid, 'name' => $a['name']];
            foreach (array_merge($friends['items'] ?? [], $groups['items'] ?? [], array_values(array_filter($inbox['conversations'] ?? [], fn ($c) => $c['accountId'] === $aid))) as $p) {
                $peer = $p['conversationId'] ?? $p['id'];
                if (! preg_match('/^g?\d{1,30}$/', (string) $peer)) {
                    continue;
                }
                $runtime = $aid.':'.$peer;
                $out['sources'][$runtime] = ['key' => $external.':'.$peer, 'name' => $p['name'], 'accountName' => $a['name']];
            }
            foreach ($friends['labels'] ?? [] as $l) {
                $members = [];
                $pendingMembers = [];
                foreach ($l['members'] as $peer) {
                    $runtime = $aid.':'.$peer;
                    if (isset($out['sources'][$runtime])) {
                        $members[] = $out['sources'][$runtime]['key'];
                    } else {
                        $pendingMembers[] = $external.':'.$peer;
                    }
                }
                $out['labels'][] = ['key' => $external.':label:'.$l['id'], 'accountName' => $a['name'], 'name' => $l['name'], 'color' => $l['color'] ?? '#0068ff', 'members' => array_values(array_unique($members)), 'pending' => count($pendingMembers), 'pendingMembers' => $pendingMembers];
            }
        }
        foreach ($inbox['groups'] ?? [] as $g) {
            $sources = array_values(array_filter($g['sources'], fn ($s) => isset($out['sources'][$s])));
            if (! ($g['complete'] ?? false) || count($sources) !== count($g['sources'])) {
                $out['blockedSources'] = array_merge($out['blockedSources'], $sources);
            }
            if (count($sources) > 1) {
                $out['groups'][] = ['id' => $g['id'], 'sources' => $sources];
            }
        }

        return $out;
    }
}
