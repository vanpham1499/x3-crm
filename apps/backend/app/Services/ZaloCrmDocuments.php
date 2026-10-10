<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Policies\CustomerPolicy;
use App\Policies\ProjectPolicy;
use App\Policies\QuotationPolicy;
use App\Policies\WeeklyReportPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** CRM owns document routing and delivery intent. No Zalo writes happen on reads. */
class ZaloCrmDocuments
{
    public function __construct(private ZaloTeamCatalog $catalog) {}

    public function entity(User $u, string $kind, int $id, string $ability = 'view')
    {
        abort_unless($u->is_active && ! $u->deleted_at, 403);
        [$model, $policy] = match ($kind) {
            'project' => [Project::class, ProjectPolicy::class],
            'customer' => [Customer::class, CustomerPolicy::class],
            'quotation' => [Quotation::class, QuotationPolicy::class],
            'report' => [WeeklyReport::class, WeeklyReportPolicy::class],
            default => abort(422),
        };
        $entity = $model::findOrFail($id);
        abort_unless(app($policy)->$ability($u, $entity), 403, 'Bạn không có quyền với hồ sơ này.');

        return $entity;
    }

    public function routes()
    {
        return DB::table('zt_crm_delivery_routes')->where('owner', ZaloTeamAccess::storageOwner());
    }

    public function deliveries()
    {
        return DB::table('zt_crm_deliveries')->where('owner', ZaloTeamAccess::storageOwner());
    }

    public function binding(User $u, string $kind, int $id): array
    {
        $e = $this->entity($u, $kind, $id);
        abort_unless(in_array($kind, ['project', 'customer']), 422);
        $r = $this->routes()->where('kind', $kind)->where('entity_id', $id)->first();
        $policy = $kind === 'project' ? ProjectPolicy::class : CustomerPolicy::class;

        return ['mode' => $r?->mode ?? 'disabled', 'revision' => (int) ($r?->revision ?? 0),
            'destination' => $r?->destination ? $this->visibleDestination($u, json_decode($r->destination, true)) : null,
            'canEdit' => app($policy)->update($u, $e), 'canInherit' => $kind === 'project' && (bool) $e->customer_id];
    }

    private function visibleDestination(User $u, array $d): ?array
    {
        if (! DB::table('zt_access_accounts')->where('account_id', $d['accountId'])->where('external_id', $d['externalId'])->exists()) {
            return null;
        }
        $ids = ZaloTeamAccess::ids($u, 'write');

        return $ids === null || in_array($d['accountId'], $ids, true) ? $d : null;
    }

    public function groups(User $u, int $account): array
    {
        ZaloTeamAccess::allow($u, $account, 'write');
        $data = $this->catalog->command($u, ['action' => 'conversations', 'accountId' => $account]);

        return collect($data['conversations'] ?? [])->filter(fn ($r) => (int) $r['accountId'] === $account
            && preg_match('/^g\d{1,30}$/D', (string) $r['conversationId'])
            && $this->validGlobal((string) ($r['globalGroupId'] ?? '')))
            ->map(fn ($r) => ['peer' => $r['conversationId'], 'name' => $r['name'], 'avatar' => $r['avatarSrc'] ?? null])->values()->all();
    }

    public function accounts(User $u): array
    {
        $ids = ZaloTeamAccess::ids($u, 'write');

        return DB::table('zt_access_accounts')->when($ids !== null, fn ($q) => $q->whereIn('account_id', $ids))
            ->orderBy('name')->get(['account_id as id', 'name'])->all();
    }

    private function validGlobal(string $id): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $id) && ! in_array($id, ['0', 'null', 'undefined']);
    }

    public function verify(User $u, int $account, string $peer): array
    {
        ZaloTeamAccess::allow($u, $account, 'write');
        $a = DB::table('zt_access_accounts')->where('account_id', $account)->firstOrFail();
        $status = $this->catalog->command($u, ['action' => 'status', 'accountId' => $account]);
        $native = collect($status['accounts'] ?? [])->firstWhere('id', $account);
        abort_unless($native && (string) ($native['externalId'] ?? '') === $a->external_id, 409, 'Danh tính tài khoản đã thay đổi. Chọn lại nơi nhận.');
        abort_unless(($native['status'] ?? '') === 'connected', 409, 'Tài khoản Zalo đang mất kết nối.');
        $rows = $this->catalog->command($u, ['action' => 'conversations', 'accountId' => $account])['conversations'] ?? [];
        $row = collect($rows)->first(fn ($r) => (int) $r['accountId'] === $account && $r['conversationId'] === $peer);
        $global = (string) ($row['globalGroupId'] ?? '');
        abort_unless($row && preg_match('/^g\d{1,30}$/D', $peer) && $this->validGlobal($global), 409, 'Chưa xác minh được nhóm nhận từ Zalo.');
        abort_unless(collect($rows)->filter(fn ($r) => (int) $r['accountId'] === $account && ($r['globalGroupId'] ?? '') === $global)->count() === 1, 409, 'Định danh nhóm chưa rõ ràng.');

        return ['accountId' => $account, 'accountName' => $a->name, 'externalId' => $a->external_id,
            'peer' => $peer, 'globalId' => $global, 'name' => mb_substr($row['name'], 0, 240), 'avatar' => $row['avatarSrc'] ?? null];
    }

    public function saveBinding(User $u, string $kind, int $id, array $v): array
    {
        abort_unless(in_array($kind, ['project', 'customer']), 422);
        $e = $this->entity($u, $kind, $id, 'update');
        abort_if($v['mode'] === 'inherit' && ($kind !== 'project' || ! $e->customer_id), 422, 'Dự án chưa có khách hàng để kế thừa.');
        if ($v['mode'] === 'inherit') {
            $this->entity($u, 'customer', $e->customer_id);
        }
        $destination = $v['mode'] === 'own' ? $this->verify($u, (int) $v['accountId'], $v['peer']) : null;
        DB::transaction(function () use ($u, $kind, $id, $v, $destination) {
            $this->entity($u, $kind, $id, 'update');
            if ($destination) {
                ZaloTeamAccess::allow($u, $destination['accountId'], 'write');
                abort_unless(DB::table('zt_access_accounts')->where('account_id', $destination['accountId'])->where('external_id', $destination['externalId'])->exists(), 409, 'Tài khoản vừa thay đổi.');
            }
            DB::table('zt_crm_delivery_routes')->insertOrIgnore(['owner' => ZaloTeamAccess::storageOwner(), 'kind' => $kind, 'entity_id' => $id,
                'mode' => 'disabled', 'revision' => 0, 'updated_by' => $u->id, 'created_at' => now(), 'updated_at' => now()]);
            $r = $this->routes()->where('kind', $kind)->where('entity_id', $id)->lockForUpdate()->first();
            abort_unless((int) $r->revision === $v['revision'], 409, 'Cấu hình vừa thay đổi. Tải lại trước khi lưu.');
            $this->routes()->where('id', $r->id)->update(['mode' => $v['mode'], 'destination' => $destination ? json_encode($destination) : null,
                'revision' => $r->revision + 1, 'updated_by' => $u->id, 'updated_at' => now()]);
            ZaloTeamAccess::audit($u, 'document.route', $destination['accountId'] ?? null, ['kind' => $kind, 'entityId' => $id, 'mode' => $v['mode']]);
        });

        return $this->binding($u, $kind, $id);
    }

    public function source(User $u, string $kind, int $id): array
    {
        abort_unless(in_array($kind, ['quotation', 'report']), 422);
        $e = $this->entity($u, $kind, $id);
        $e->load($kind === 'quotation' ? ['items', 'paymentAllocations', 'paymentRefunds'] : ['items', 'attachments']);
        // Children and payment changes invalidate a previously prepared customer document too.
        $children = $kind === 'quotation' ? ['items', 'paymentAllocations', 'paymentRefunds'] : ['items', 'attachments'];
        $snapshot = [$e->getAttributes()];
        foreach ($children as $relation) {
            $snapshot[] = $e->$relation->sortBy('id')->map(fn ($row) => $row->getAttributes())->values()->all();
        }
        $version = hash('sha256', json_encode($snapshot));
        $parentKind = $e->project_id ? 'project' : 'customer';
        $parentId = (int) ($e->project_id ?: $e->customer_id);

        return ['model' => $e, 'version' => $version, 'parentKind' => $parentKind, 'parentId' => $parentId,
            'title' => $kind === 'quotation' ? $e->quotation_code : 'Báo cáo tuần #'.$e->id,
            'eligible' => $kind === 'quotation' || $e->status === WeeklyReport::STATUS_APPROVED];
    }

    public function destination(User $u, string $kind, int $id): ?array
    {
        if (! $id) {
            return null;
        }
        $e = $this->entity($u, $kind, $id);
        $r = $this->routes()->where('kind', $kind)->where('entity_id', $id)->first();
        if ($r?->mode === 'inherit' && $kind === 'project') {
            return $this->destination($u, 'customer', (int) $e->customer_id);
        }
        if ($r?->mode !== 'own' || ! $r->destination) {
            return null;
        }

        return $this->visibleDestination($u, json_decode($r->destination, true));
    }

    public function context(User $u, string $kind, int $id): array
    {
        $s = $this->source($u, $kind, $id);
        unset($s['model']);
        $s['destination'] = $this->destination($u, $s['parentKind'], $s['parentId']);
        $s['destinationVersion'] = $s['destination'] ? hash('sha256', json_encode($s['destination'])) : null;
        $s['history'] = $this->deliveries()->where('kind', $kind)->where('entity_id', $id)->orderByDesc('created_at')->limit(15)->get()
            ->filter(fn ($d) => $this->visibleDestination($u, json_decode($d->snapshot, true)['destination']) !== null)
            ->map(fn ($d) => $this->projection($d, $u))->values()->all();

        return $s;
    }

    public function projection(object $d, ?User $u = null): array
    {
        $s = json_decode($d->snapshot, true);

        return ['id' => $d->id, 'state' => $d->state, 'issue' => $d->issue, 'at' => CarbonImmutable::parse($d->created_at, config('app.timezone'))->toIso8601String(),
            'canAct' => $u && ($u->isAdmin() || (int) $d->actor_id === (int) $u->id),
            'actor' => $s['actorName'], 'destination' => $s['destination'], 'filename' => $s['asset']['name'],
            'parts' => array_map(fn ($p) => ['kind' => $p['kind'], 'state' => $p['state']], json_decode($d->parts, true))];
    }

    public static function path(string $id): string
    {
        abort_unless(Str::isUuid($id), 422);

        return storage_path('app/private/zalo-crm-documents/'.$id);
    }

    public function enqueue(User $u, string $kind, int $id, array $v, UploadedFile $file): array
    {
        $s = $this->source($u, $kind, $id);
        abort_unless($s['eligible'], 409, 'Chỉ gửi báo cáo đã được duyệt.');
        abort_unless(hash_equals($s['version'], $v['version']), 409, 'Tài liệu đã thay đổi. Mở lại bản gửi khách.');
        $d = $this->destination($u, $s['parentKind'], $s['parentId']);
        abort_unless($d && hash_equals(hash('sha256', json_encode($d)), $v['destinationVersion']), 409, 'Nơi nhận đã thay đổi. Xem lại trước khi gửi.');
        $verified = $this->verify($u, $d['accountId'], $d['peer']);
        abort_unless($verified['externalId'] === $d['externalId'] && $verified['globalId'] === $d['globalId'], 409, 'Nhóm hoặc tài khoản gửi đã thay đổi.');
        $sha = hash_file('sha256', $file->getRealPath());
        $text = trim($v['text'] ?? '');
        $fingerprint = hash('sha256', json_encode([ZaloTeamAccess::storageOwner(), $kind, $id, $s['version'], $d['globalId'], $sha, $text]));
        $existing = $this->deliveries()->where('id', $v['requestId'])->first();
        abort_if($existing && $existing->dedupe !== $fingerprint, 409, 'Mã yêu cầu đã được dùng cho một nội dung khác.');
        $existing ??= $this->deliveries()->where('dedupe', $fingerprint)->first();
        if ($existing) {
            return $this->projection($this->delivery($u, $existing->id), $u);
        }
        $mime = $file->getMimeType();
        abort_unless(in_array($mime, ['application/pdf', 'image/png', 'image/jpeg']), 422, 'Chỉ hỗ trợ PDF, PNG hoặc JPG.');
        $ext = match ($mime) {
            'application/pdf' => 'pdf', 'image/png' => 'png', default => 'jpg'
        };
        $asset = ['name' => preg_replace('/[^\pL\pN _-]/u', '-', $s['title']).'.'.$ext,
            'mime' => $mime, 'kind' => $mime === 'application/pdf' ? 'file' : 'image', 'bytes' => $file->getSize(), 'sha256' => $sha];
        $parts = $text === '' ? [] : [['id' => (string) Str::uuid(), 'kind' => 'text', 'state' => 'queued', 'text' => $text]];
        $parts[] = ['id' => (string) Str::uuid(), 'kind' => 'media', 'state' => 'queued'];
        $path = self::path($v['requestId']);
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0700, true);
        }
        // Exclusive publication: another request must not overwrite an in-flight artifact.
        $out = @fopen($path, 'xb');
        abort_unless($out, 409, 'Yêu cầu đang được chuẩn bị. Kiểm tra lịch sử gửi.');
        try {
            $in = fopen($file->getRealPath(), 'rb');
            try {
                stream_copy_to_stream($in, $out);
            } finally {
                fclose($in);
                fclose($out);
            }
            @chmod($path, 0600);
            abort_unless(hash_equals($sha, hash_file('sha256', $path)), 422);
            $inserted = DB::table('zt_crm_deliveries')->insertOrIgnore(['id' => $v['requestId'], 'owner' => ZaloTeamAccess::storageOwner(),
                'kind' => $kind, 'entity_id' => $id, 'actor_id' => $u->id, 'version' => $s['version'], 'dedupe' => $fingerprint,
                'snapshot' => json_encode(['destination' => $d, 'actorName' => $u->name, 'asset' => $asset, 'title' => $s['title']]),
                'parts' => json_encode($parts), 'state' => 'queued', 'created_at' => now(), 'updated_at' => now()]);
            if (! $inserted) {
                @unlink($path);
            }
        } catch (\Throwable $e) {
            @unlink($path);
            throw $e;
        }

        return $this->projection($this->delivery($u, $this->deliveries()->where('dedupe', $fingerprint)->value('id')), $u);
    }

    public function delivery(User $u, string $id): object
    {
        $d = $this->deliveries()->where('id', $id)->firstOrFail();
        $this->entity($u, $d->kind, $d->entity_id);
        ZaloTeamAccess::allow($u, json_decode($d->snapshot, true)['destination']['accountId'], 'write');
        abort_unless($this->visibleDestination($u, json_decode($d->snapshot, true)['destination']), 403, 'Quyền truy cập tài khoản gửi đã thay đổi.');

        return $d;
    }

    public function prune(): int
    {
        $removed = 0;
        foreach ($this->deliveries()->whereIn('state', ['sent', 'cancelled'])->where('updated_at', '<', now()->subDays(30))->orderBy('created_at')->cursor() as $d) {
            $path = self::path($d->id);
            if (is_file($path) && unlink($path)) {
                $removed++;
            }
        }

        return $removed;
    }
}
