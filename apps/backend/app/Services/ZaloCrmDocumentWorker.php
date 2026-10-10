<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/** Explicit manual requests only. A lost send result is reconciled, never resent. */
class ZaloCrmDocumentWorker
{
    public function __construct(private ZaloCrmDocuments $documents, private ZaloTeamCampaignTransport $transport) {}

    public function recover(): void
    {
        $this->documents->deliveries()->where('state', 'working')->where('updated_at', '<', now()->subMinutes(6))
            ->update(['state' => 'unknown', 'lease' => null, 'issue' => 'Lượt gửi bị gián đoạn. Kiểm tra kết quả trước khi tiếp tục.', 'updated_at' => now()]);
    }

    private function body(object $d, array $part): array
    {
        $s = json_decode($d->snapshot, true);
        $to = $s['destination'];

        return ['action' => $part['kind'] === 'text' ? 'send-text' : 'send-media', 'accountId' => $to['accountId'],
            'conversationId' => $to['peer'], 'expectedExternalId' => $to['externalId'], 'requestId' => $part['id'],
            'crmSender' => ['userId' => (int) $d->actor_id, 'name' => $s['actorName']],
            ...($part['kind'] === 'text' ? ['text' => $part['text']] : ['media' => ['uploadId' => $part['uploadId']]])];
    }

    public function tick(): bool
    {
        // A scheduler and --watch may coexist; one CRM document is dispatched at a time.
        return (bool) Cache::lock('zalo-crm-documents:'.ZaloTeamAccess::storageOwner(), 900)->get(fn () => $this->process());
    }

    private function process(): bool
    {
        $this->recover();
        $d = DB::transaction(function () {
            $d = $this->documents->deliveries()->where('state', 'queued')->orderBy('created_at')->lockForUpdate()->first();
            if (! $d) {
                return null;
            }
            $d->lease = (string) Str::uuid();
            $this->documents->deliveries()->where('id', $d->id)->update(['state' => 'working', 'lease' => $d->lease, 'issue' => null, 'updated_at' => now()]);

            return $d;
        });
        if (! $d) {
            return false;
        }
        $parts = json_decode($d->parts, true);
        $s = json_decode($d->snapshot, true);
        $to = $s['destination'];
        $dispatched = false;
        try {
            foreach ($parts as $i => &$part) {
                if ($part['state'] === 'sent') {
                    continue;
                }
                // Reload the actor and CRM state, not a stored session or permission projection.
                $u = User::where('is_active', true)->findOrFail($d->actor_id);
                $this->documents->delivery($u, $d->id);
                $source = $this->documents->source($u, $d->kind, $d->entity_id);
                abort_unless($source['eligible'] && hash_equals($d->version, $source['version']), 409, 'Tài liệu đã thay đổi hoặc chưa được duyệt.');
                $current = $this->documents->destination($u, $source['parentKind'], $source['parentId']);
                abort_unless($current && $current['globalId'] === $to['globalId'] && $current['accountId'] === $to['accountId']
                    && $current['externalId'] === $to['externalId'] && $current['peer'] === $to['peer'], 409, 'Nơi nhận đã thay đổi.');
                $verified = $this->documents->verify($u, $to['accountId'], $to['peer']);
                abort_unless($verified['globalId'] === $to['globalId'] && $verified['externalId'] === $to['externalId'], 409, 'Danh tính nhóm nhận đã thay đổi.');
                if ($part['kind'] === 'media') {
                    $part['uploadId'] = $this->transport->uploadFile(ZaloCrmDocuments::path($d->id), (object) $s['asset'], $to['accountId'], $to['peer']);
                }
                $fresh = User::where('is_active', true)->findOrFail($d->actor_id);
                $this->documents->delivery($fresh, $d->id);
                $latest = $this->documents->source($fresh, $d->kind, $d->entity_id);
                abort_unless($latest['eligible'] && hash_equals($d->version, $latest['version']), 409, 'Tài liệu đã thay đổi trong lúc chuẩn bị.');
                $latestDestination = $this->documents->destination($fresh, $latest['parentKind'], $latest['parentId']);
                abort_unless($latestDestination && $latestDestination['accountId'] === $to['accountId'] && $latestDestination['peer'] === $to['peer']
                    && $latestDestination['externalId'] === $to['externalId'] && $latestDestination['globalId'] === $to['globalId'], 409, 'Nơi nhận đã thay đổi trong lúc chuẩn bị.');
                // Persist the native request and upload IDs before dispatch; checkOnly reuses this exact body.
                $part['state'] = 'sending';
                $changed = $this->documents->deliveries()->where('id', $d->id)->where('state', 'working')->where('lease', $d->lease)
                    ->update(['parts' => json_encode($parts), 'updated_at' => now()]);
                if (! $changed) {
                    return true;
                }
                $dispatched = true;
                $result = $this->transport->command($this->body($d, $part));
                $part['state'] = ($result['status'] ?? '') === 'sent' ? 'sent' : 'unknown';
                $part['receipt'] = array_intersect_key($result, array_flip(['status', 'clientId', 'requestId']));
                $this->documents->deliveries()->where('id', $d->id)->where('lease', $d->lease)->update(['parts' => json_encode($parts), 'updated_at' => now()]);
                if ($part['state'] !== 'sent') {
                    throw new \RuntimeException('DELIVERY_UNKNOWN');
                }
                $dispatched = false;
            }
            unset($part);
            $this->documents->deliveries()->where('id', $d->id)->where('lease', $d->lease)->update(['state' => 'sent', 'lease' => null, 'issue' => null, 'updated_at' => now()]);
        } catch (\Throwable $e) {
            if (isset($part) && $part['state'] !== 'sent') {
                $part['state'] = $dispatched ? 'unknown' : 'queued';
            }
            unset($part);
            $safe = $e instanceof HttpExceptionInterface && in_array($e->getStatusCode(), [403, 409])
                ? $e->getMessage() : 'Chưa gửi được. Kiểm tra tài khoản Zalo và kết nối rồi thử lại.';
            $this->documents->deliveries()->where('id', $d->id)->where('lease', $d->lease)->update(['parts' => json_encode($parts),
                'state' => $dispatched ? 'unknown' : 'failed', 'lease' => null,
                'issue' => $dispatched ? 'Chưa xác nhận kết quả. Kiểm tra kết quả; hệ thống không tự gửi lại.' : mb_substr($safe, 0, 250), 'updated_at' => now()]);
        }

        return true;
    }

    public function action(User $u, string $id, string $action): array
    {
        $this->recover();
        $d = $this->documents->delivery($u, $id);
        // Preserve attribution: only the originating person or admin may continue this intent.
        abort_unless((int) $d->actor_id === (int) $u->id || $u->isAdmin(), 403);
        if ($action === 'retry') {
            abort_unless(in_array($d->state, ['failed', 'cancelled']), 409);
            abort_unless(is_file(ZaloCrmDocuments::path($id)), 409, 'Bản gửi đã hết hạn lưu. Mở lại tài liệu để tạo lượt mới.');
            $this->documents->deliveries()->where('id', $id)->where('state', $d->state)->update(['state' => 'queued', 'issue' => null, 'updated_at' => now()]);
        } elseif ($action === 'cancel') {
            abort_unless(in_array($d->state, ['queued', 'failed']), 409, 'Lượt gửi đang xử lý hoặc chưa xác nhận; cần kiểm tra kết quả.');
            $this->documents->deliveries()->where('id', $id)->where('state', $d->state)->update(['state' => 'cancelled', 'updated_at' => now()]);
        } else {
            abort_unless($d->state === 'unknown', 409);
            $parts = json_decode($d->parts, true);
            foreach ($parts as &$p) {
                if (! in_array($p['state'], ['sending', 'unknown'])) {
                    continue;
                }
                try {
                    $r = $this->transport->command($this->body($d, $p) + ['checkOnly' => true]);
                    if (($r['status'] ?? '') === 'sent') {
                        $p['state'] = 'sent';
                        $p['receipt'] = array_intersect_key($r, array_flip(['status', 'clientId', 'requestId']));
                    }
                } catch (\Throwable) { /* Keep uncertainty visible; a read failure never authorizes a write. */
                }
            }
            unset($p);
            $unknown = collect($parts)->contains(fn ($p) => in_array($p['state'], ['sending', 'unknown']));
            $state = $unknown ? 'unknown' : (collect($parts)->every(fn ($p) => $p['state'] === 'sent') ? 'sent' : 'failed');
            $this->documents->deliveries()->where('id', $id)->where('state', 'unknown')->update(['parts' => json_encode($parts), 'state' => $state,
                'issue' => $state === 'sent' ? null : ($unknown ? 'Vẫn chưa xác nhận được. Mở hội thoại để đối chiếu.' : 'Còn phần chưa gửi. Bấm Tiếp tục.'), 'updated_at' => now()]);
        }

        return $this->documents->projection($this->documents->delivery($u, $id), $u);
    }
}
