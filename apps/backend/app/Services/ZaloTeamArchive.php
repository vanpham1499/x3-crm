<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ZaloTeamArchive
{
    public static function owner(User $u): string
    {
        $owner = ZaloTeamAccess::storageOwner();
        if ($u instanceof \App\Models\ZaloTeamIdentityUser) abort_unless((ZaloTeamAccess::scope($u)['owner'] ?? '') === $owner, 403, 'Phạm vi kho không khớp CRM.');
        return $owner;
    }

    public static function json($value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public function settings(User $u): object
    {
        $owner = self::owner($u);
        DB::table('zt_archive_settings')->insertOrIgnore(['owner' => $owner, 'user_id' => $u->id, 'accounts' => '[]', 'created_at' => now(), 'updated_at' => now()]);

        return DB::table('zt_archive_settings')->where('owner', $owner)->first();
    }

    public function configure(User $u, array $v, array $accounts): void
    {
        $this->settings($u);
        $valid = array_column($accounts, 'id');
        abort_if(array_diff($v['accounts'], $valid), 403, 'Tài khoản không thuộc phiên của bạn.');
        abort_if($v['enabled'] && ! $v['accounts'], 422, 'Chọn ít nhất một tài khoản để đồng bộ.');
        foreach ($v['accounts'] as $id) ZaloTeamAccess::allow($u, (int) $id, 'sync');
        DB::transaction(function () use ($u, $v) {
        $current = DB::table('zt_archive_settings')->where('owner', self::owner($u))->lockForUpdate()->first();
        $ids = ZaloTeamAccess::ids($u, 'sync');
        if ($ids !== null) {
            $selected = $v['enabled'] ? $v['accounts'] : [];
            $v['accounts'] = array_values(array_unique(array_merge(array_diff(json_decode($current->accounts, true), $ids), $selected)));
            $v['enabled'] = count($v['accounts']) > 0;
            $v['media'] = $current->media;
            $v['daily_backup'] = $current->daily_backup;
        }
        DB::table('zt_archive_settings')->where('owner', self::owner($u))->update([
            'enabled' => $v['enabled'], 'media' => $v['media'], 'daily_backup' => $v['daily_backup'],
            'accounts' => self::json(array_values(array_unique($v['accounts']))), 'updated_at' => now(),
        ]);
        });
    }

    // Scope includes the CRM owner. Same Zalo account in a different owner never grants archive access.
    public function catalog(User $u, array $status, array $inbox): array
    {
        $owner = self::owner($u);
        $accounts = array_column($status['accounts'] ?? [], null, 'id');
        $links = [];
        foreach ($inbox['groups'] ?? [] as $g) {
            foreach ($g['sources'] as $s) {
                $links[$s] = 'group:'.$g['id'];
            }
        }
        $sources = [];
        DB::transaction(function () use ($inbox, $accounts, $owner, $links, &$sources) {
            DB::table('zt_archive_sources')->where('owner', $owner)->update(['accessible' => false]);
            foreach ($inbox['conversations'] ?? [] as $c) {
                $a = $accounts[$c['accountId']] ?? null;
                if (! $a || ($a['status'] ?? '') !== 'connected') {
                    continue;
                }
                $id = hash('sha256', $owner.':'.$a['externalId'].':'.$c['conversationId']);
                $canonical = $links[$c['accountId'].':'.$c['conversationId']] ?? ('source:'.$id);
                $data = ['owner' => $owner, 'account_id' => $a['id'], 'external_id' => $a['externalId'], 'conversation_id' => $c['conversationId'],
                    'canonical' => $canonical, 'name' => $c['name'], 'account_name' => $a['name'], 'accessible' => true];
                $previous = DB::table('zt_archive_sources')->where('id', $id)->first();
                if ($previous && $previous->canonical !== $canonical) {
                    $this->relink($previous, $canonical);
                }
                DB::table('zt_archive_sources')->updateOrInsert(['id' => $id], $data);
                $sources[] = DB::table('zt_archive_sources')->where('id', $id)->first();
            }
        });

        return $sources;
    }

    private function relink(object $source, string $canonical): void
    {
        foreach (DB::table('zt_archive_observations')->where('source_id', $source->id)->orderBy('id')->get() as $o) {
            $old = DB::table('zt_archive_messages')->where('id', $o->message_id)->first();
            ZaloTeamArchiveVersions::record($source, array_merge(json_decode($old->content, true), json_decode($o->view, true)), 'stored', 'retained');
            $body = json_decode($old->content, true);
            $identity = [$source->owner, $canonical, $body['id'], $body['clientId'] ?? '', $body['time']];
            $id = hash('sha256', self::json([$identity, $body]));
            DB::table('zt_archive_messages')->insertOrIgnore(['id' => $id, 'owner' => $source->owner, 'canonical' => $canonical, 'native_id' => $old->native_id, 'time' => $old->time, 'content' => $old->content]);
            foreach (DB::table('zt_archive_assets')->where('message_id', $old->id)->get() as $asset) {
                $copy = (array) $asset;
                $copy['id'] = hash('sha256', $id.':'.$copy['slot']);
                $copy['message_id'] = $id;
                DB::table('zt_archive_assets')->insertOrIgnore($copy);
                if ($copy['state'] === 'ready') {
                    DB::table('zt_archive_assets')->where('id', $copy['id'])->whereNull('hash')->update(array_intersect_key($copy, array_flip(['hash', 'bytes', 'mime', 'state'])));
                }
            }
            DB::table('zt_archive_observations')->where('id', $o->id)->update(['message_id' => $id]);
            // Retired content/assets remain recoverable. History and logical
            // counts use current observations, never every stored version.
        }
    }

    public function ingest(object $source, array $page, bool $updateRange = true): int
    {
        abort_unless(($page['accountId'] ?? null) === $source->account_id && ($page['conversationId'] ?? null) === $source->conversation_id, 409, 'Nguồn tin không khớp.');

        return DB::transaction(function () use ($source, $page, $updateRange) {
            $count = 0;
            foreach ($page['messages'] ?? [] as $m) {
                ['id' => $id, 'body' => $body, 'urls' => $urls] = $this->prepareMessage($source, $m);
                DB::table('zt_archive_messages')->insertOrIgnore(['id' => $id, 'owner' => $source->owner, 'canonical' => $source->canonical, 'native_id' => $m['id'], 'time' => $m['time'], 'content' => self::json($body)]);
                $view = array_diff_key($m, $body);
                $observation = hash('sha256', $source->id.':'.$m['id']);
                $old = DB::table('zt_archive_observations')->where('id', $observation)->first();
                if ($old) {
                    $previous = DB::table('zt_archive_messages')->where('id', $old->message_id)->first();
                    $previousBody = json_decode($previous->content, true);
                    $previousView = json_decode($old->view, true);
                    // Attribution is immutable CRM evidence; a later native read
                    // without the receipt index must not erase it from saved history.
                    if (empty($view['crmSender']) && ! empty($previousView['crmSender'])
                        && ! empty($m['clientId']) && ($previousBody['clientId'] ?? '') === $m['clientId']
                        && (int) $previous->time === (int) $m['time']) {
                        $view['crmSender'] = $previousView['crmSender'];
                    }
                    ZaloTeamArchiveVersions::record($source, array_merge(json_decode($previous->content, true), json_decode($old->view, true)), 'stored', 'retained');
                }
                ZaloTeamArchiveVersions::record($source, $m, 'web', 'observed');
                DB::table('zt_archive_observations')->updateOrInsert(['id' => $observation], [
                    'source_id' => $source->id, 'message_id' => $id, 'native_id' => $m['id'], 'view' => self::json($view),
                    'deleted' => $old?->deleted ?? false, 'observed_at' => now(),
                ]);
                foreach ($urls as $slot => $url) {
                    $aid = hash('sha256', $id.':'.$slot);
                    DB::table('zt_archive_assets')->insertOrIgnore(['id' => $aid, 'owner' => $source->owner, 'message_id' => $id, 'slot' => $slot, 'url' => $url]);
                    DB::table('zt_archive_assets')->where('id', $aid)->whereNull('hash')->where('url', '!=', $url)->update(['url' => $url, 'state' => 'pending', 'attempts' => 0, 'retry_at' => null, 'error' => null]);
                }
                $count++;
            }
            if ($updateRange) {
                $this->refreshRange($source);
            }

            return $count;
        });
    }

    public function refreshRange(object $source): void
    {
        $range = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')->where('o.source_id', $source->id)->selectRaw('MIN(m.time) as oldest, MAX(m.time) as latest')->first();
        DB::table('zt_archive_sources')->where('id', $source->id)->update(['oldest' => $range->oldest, 'latest' => $range->latest, 'last_sync' => now(), 'error' => null]);
    }

    public function prepareMessage(object $source, array $m): array
    {
        if (! preg_match('/^[a-zA-Z0-9_.:-]{1,200}$/', (string) ($m['id'] ?? '')) || ! is_numeric($m['time'] ?? null)) {
            throw new \UnexpectedValueException('Native message identity missing or unsupported');
        }
        $identity = [$source->owner, $source->canonical, $m['id'], $m['clientId'] ?? '', $m['time']];
        $body = array_intersect_key($m, array_flip(['id', 'clientId', 'time', 'type', 'kind', 'text', 'styles', 'inline', 'mentions', 'photoGroup', 'attachments']));
        $urls = [];
        foreach ($body['attachments'] ?? [] as $i => $a) {
            foreach (['url', 'preview'] as $key) {
                if (! empty($a[$key]) && ($a['kind'] ?? '') !== 'link') {
                    $urls["attachments.$i.$key"] = $a[$key];
                }
                unset($body['attachments'][$i][$key]);
            }
            if (($a['kind'] ?? '') === 'link') {
                $body['attachments'][$i] = $a;
            }
        }

        return ['id' => hash('sha256', self::json([$identity, $body])), 'body' => $body, 'urls' => $urls];
    }

    public function source(User $u, string $id): object
    {
        $s = DB::table('zt_archive_sources')->where('owner', self::owner($u))->where('id', $id)->first();
        abort_unless($s, 404, 'Không tìm thấy hội thoại đã lưu.');
        ZaloTeamAccess::allow($u, (int) $s->account_id);

        return $s;
    }

    public function history(User $u, string $id, ?array $before = null, string $query = '', ?string $day = null): array
    {
        $s = $this->source($u, $id);
        $nativeId = DB::connection()->getDriverName() === 'pgsql' ? 'o.native_id COLLATE "C"' : 'o.native_id COLLATE BINARY';
        // Archive access is retained for the original owner, never inferred from another account's membership.
        $q = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
            ->where('o.source_id', $s->id)->where('o.deleted', false);
        if ($before) {
            $q->where(function ($q) use ($before, $nativeId) {
                $q->where('m.time', '<', $before['time'])->orWhere(function ($q) use ($before, $nativeId) {
                    $q->where('m.time', $before['time'])->whereRaw($nativeId.' < ?', [$before['id']]);
                });
            });
        }
        if ($query !== '') {
            $q->whereRaw("LOWER(CAST(m.content AS TEXT)) LIKE ? ESCAPE '!'", ['%'.mb_strtolower(str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query)).'%']);
        }
        if ($day) {
            $from = CarbonImmutable::parse($day, 'Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
            $q->where('m.time', '>=', $from)->where('m.time', '<', $from + 86400000);
        }
        $rows = $q->orderByDesc('m.time')->orderByRaw($nativeId.' DESC')->limit(51)->get(['m.*', 'o.view', 'o.native_id as cursor_native_id']);
        $more = $rows->count() > 50;
        $rows = $rows->take(50);
        $messages = [];
        $allAssets = DB::table('zt_archive_assets')->whereIn('message_id', $rows->pluck('id'))->get();
        $availability = app(ZaloTeamDriveStore::class)->availableAssets($allAssets);
        $assets = $allAssets->groupBy('message_id');
        foreach ($rows as $r) {
            $m = array_merge(json_decode($r->content, true), json_decode($r->view, true));
            $m['attachments'] = $this->storedAttachments($m['attachments'] ?? [], $assets->get($r->id, collect()), $availability);
            $m['archived'] = true;
            $m['canRecall'] = false;
            $messages[] = $m;
        }
        $last = $rows->last();

        return ['accountId' => (int) $s->account_id, 'conversationId' => $s->conversation_id, 'messages' => array_reverse($messages),
            'cursor' => $more && $last ? ['id' => $last->cursor_native_id, 'time' => (string) $last->time] : null, 'hasMore' => $more, 'warning' => null];
    }

    public function storedAttachments(array $attachments, $assets, ?array $availability = null): array
    {
        $availability ??= app(ZaloTeamDriveStore::class)->availableAssets($assets);
        $bySlot = $assets->keyBy('slot');
        foreach ($attachments as $i => &$attachment) {
            if (($attachment['kind'] ?? '') === 'link') {
                continue;
            }
            $main = $bySlot->get("attachments.$i.url");
            $preview = $bySlot->get("attachments.$i.preview");
            $ready = function ($a) use ($availability) {
                if (! $a || $a->state !== 'ready' || ! $a->hash) {
                    return false;
                }
                return $availability[$a->id] ?? false;
            };
            $mainReady = $ready($main);
            $previewReady = $ready($preview);
            foreach (['url' => $main, 'preview' => $preview] as $key => $a) {
                if ($ready($a)) {
                    $attachment[$key] = '/api/zalo-team/archive/assets/'.$a->id;
                }
            }
            $attachment['archiveState'] = $mainReady ? 'ready' : ($previewReady ? 'partial' : (($main?->state === 'ready' || $preview?->state === 'ready') ? 'missing' : ($main?->state ?? $preview?->state ?? 'unavailable')));
            $attachment['archiveError'] = $main?->error ?? $preview?->error;
        }

        return $attachments;
    }

    public function attachmentStatus(User $u, int $account, string $conversation, array $ids): array
    {
        ZaloTeamAccess::allow($u, $account);
        $source = DB::table('zt_archive_sources')->where('owner', self::owner($u))->where('account_id', $account)->where('conversation_id', $conversation)->first();
        if (! $source) {
            return ['items' => []];
        }
        $rows = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')->where('o.source_id', $source->id)->where('o.deleted', false)->whereIn('o.native_id', $ids)->get(['m.id', 'm.content']);
        $allAssets = DB::table('zt_archive_assets')->whereIn('message_id', $rows->pluck('id'))->get();
        $availability = app(ZaloTeamDriveStore::class)->availableAssets($allAssets);
        $assets = $allAssets->groupBy('message_id');

        return ['items' => $rows->map(function ($r) use ($assets, $availability) {
            $m = json_decode($r->content, true);

            return ['id' => $m['id'], 'time' => $m['time'], 'clientId' => $m['clientId'] ?? '', 'attachments' => $this->storedAttachments($m['attachments'] ?? [], $assets->get($r->id, collect()), $availability)];
        })->values()->all()];
    }

    public function status(User $u, string $view = 'full', bool $includeIssues = false): array
    {
        $settings = $this->settings($u);
        $owner = $settings->owner;
        $scope = ZaloTeamAccess::scope($u);
        $full = $view === 'full';
        $storage = $full || $view === 'storage';
        $sync = $full || $view === 'sync';
        $admin = $scope['admin'] ?? false;
        $sources = $view === 'backup' ? collect() : ZaloTeamAccess::sources(DB::table('zt_archive_sources')->where('owner', $owner), $u)->orderBy('account_name')->orderBy('name')->get($full ? ['*'] : ['id','account_id','account_name','history_done','catchup_cursor','error']);
        $hashCollation = DB::connection()->getDriverName() === 'pgsql' ? ' COLLATE "C"' : '';
        // observation.message_id has a foreign key to messages; count references once in SQL.
        $counts = $storage ? DB::table('zt_archive_observations')->whereIn('source_id', $sources->pluck('id'))
            ->selectRaw("COUNT(*) as observations, COUNT(DISTINCT message_id$hashCollation) as messages")->first() : null;
        $observations = (int) ($counts->observations ?? 0);
        $messages = (int) ($counts->messages ?? 0);
        $blobRows = DB::table('zt_archive_assets')->where('owner', $owner)->tap(fn ($q) => ZaloTeamAccess::whereVisibleMessage($q, $u, 'zt_archive_assets.message_id'))->where('state', 'ready')
            ->selectRaw('MAX(bytes) as bytes, SUM(bytes) as referenced_bytes')->groupByRaw('hash'.$hashCollation);
        $blobs = $storage ? DB::query()->fromSub($blobRows, 'blobs')->selectRaw('COALESCE(SUM(bytes),0) as bytes, COALESCE(SUM(referenced_bytes - bytes),0) as saved')->first() : null;
        $fileSummary = ($sync || $storage) ? app(ZaloTeamArchiveReport::class)->fileSummary($owner, $u) : ['ready'=>0,'pending'=>0,'failed'=>0];
        $issueRows = ($full || ($sync && $includeIssues)) ? DB::table('zt_archive_assets as a')->join('zt_archive_messages as m', 'm.id', '=', 'a.message_id')->where('a.owner', $owner)->tap(fn ($q) => ZaloTeamAccess::whereVisibleMessage($q, $u, 'a.message_id'))->where('a.state', 'error')->orderBy('m.time', 'desc')->limit(20)->get(['a.id', 'a.message_id', 'a.slot', 'a.error', 'a.attempts', 'a.retry_at', 'm.content', 'm.time']) : collect();
        $issueOrigins = $issueRows->isEmpty() ? collect() : DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
            ->where('s.owner', $owner)->when(ZaloTeamAccess::ids($u) !== null, fn ($q) => $q->whereIn('s.account_id', ZaloTeamAccess::ids($u)))
            ->whereIn('o.message_id', $issueRows->pluck('message_id'))->where('o.deleted', false)->get(['o.message_id', 's.id', 's.account_id', 's.conversation_id', 's.name', 's.account_name'])->groupBy('message_id');
        $issueChecks = $issueRows->isEmpty() ? collect() : DB::table('zt_archive_pc_recoveries')->where('owner', $owner)->whereIn('asset_id', $issueRows->pluck('id'))->get()->groupBy('asset_id');
        $originals = $issueRows->isEmpty() ? collect() : DB::table('zt_archive_assets')->where('owner', $owner)->whereIn('message_id', $issueRows->pluck('message_id'))->where('state', 'ready')->get();
        $available = app(ZaloTeamDriveStore::class)->availableAssets($originals);
        $originals = $originals->keyBy(fn ($a) => $a->message_id.':'.$a->slot);
        $issues = $issueRows->map(function ($a) use ($issueOrigins, $issueChecks, $originals, $available) {
            $content = json_decode($a->content, true);
            $index = (int) explode('.', $a->slot)[1];

            $origins = $issueOrigins->get($a->message_id, collect());
            $checks = $issueChecks->get($a->id, collect())->whereIn('source_id', $origins->pluck('id'));
            $checked = $checks->isNotEmpty() && $checks->count() === $origins->pluck('id')->unique()->count() && $checks->every(fn ($r) => $r->checked_at !== null);
            $originalSaved = false;
            if (str_ends_with($a->slot, '.preview')) {
                $original = $originals->get($a->message_id.':attachments.'.$index.'.url');
                $originalSaved = $original && ($available[$original->id] ?? false);
            }

            return ['id' => $a->id, 'name' => ($content['attachments'][$index]['name'] ?? '') ?: 'Tệp đính kèm', 'error' => $a->error, 'time' => (int) $a->time, 'autoRetry' => $a->attempts < 5, 'retryAt' => $a->retry_at ? CarbonImmutable::parse($a->retry_at)->toIso8601String() : null, 'sources' => $origins->map(function ($origin) { $copy = clone $origin; unset($copy->message_id); return $copy; }),
                'role' => str_ends_with($a->slot, '.preview') ? 'preview' : 'original',
                'originalSaved' => $originalSaved,
                'pcCheck' => $checked ? 'checked' : 'queued', 'pcCheckedAt' => $checked ? CarbonImmutable::parse($checks->max('checked_at'))->toIso8601String() : null];
        });

        $result = ['settings' => ['enabled' => (bool) $settings->enabled, 'media' => (bool) $settings->media, 'daily_backup' => (bool) $settings->daily_backup, 'accounts' => json_decode($settings->accounts, true),
            'heartbeat' => $settings->heartbeat ? CarbonImmutable::parse($settings->heartbeat)->toIso8601String() : null, 'last_sync' => $settings->last_sync ? CarbonImmutable::parse($settings->last_sync)->toIso8601String() : null, 'error' => $settings->error],
            'progress' => $settings->progress ? json_decode($settings->progress, true) : null,
            'pcRecovery' => $full && $admin ? app(ZaloTeamPcRecovery::class)->summary($owner) : null,
            'storageLocation' => ZaloTeamRuntime::role() === 'zalo' ? 'vps' : 'local',
            'canMonitorServer' => ZaloTeamServerMetrics::allowed($u),
            'storage' => ['archive' => realpath(config('zalo_team.archive_path')) ?: config('zalo_team.archive_path'), 'backups' => realpath(config('zalo_team.backup_path')) ?: config('zalo_team.backup_path'), 'database' => 'PostgreSQL · bảng zt_archive_*'],
            'sources' => $sources, 'issuesLoaded' => $full || ($sync && $includeIssues), 'fileIssues' => $issues, 'fileSummary' => $fileSummary, 'maxFileBytes' => config('zalo_team.archive_max_file_bytes'), 'stats' => ['messages' => $messages, 'observations' => $observations, 'savedMessages' => $observations - $messages,
                'readyFiles' => $fileSummary['ready'],
                'bytes' => (int) ($blobs->bytes ?? 0), 'savedBytes' => (int) ($blobs->saved ?? 0),
                'pendingFiles' => $fileSummary['pending'],
                'failedFiles' => $fileSummary['failed']],
            'checkpoints' => $full && $admin ? DB::table('zt_archive_checkpoints')->where('owner', $owner)->orderByDesc('created_at')->limit(30)->get(['id', 'date', 'summary', 'verification', 'verified_at', 'created_at'])->map(function ($r) {
                $r->summary = json_decode($r->summary, true);
                $r->verification = $r->verification ? json_decode($r->verification, true) : null;

                return $r;
            }) : [],
            'imports' => $full && $admin ? DB::table('zt_archive_imports')->where('owner', $owner)->orderByDesc('created_at')->limit(20)->get()->map(function ($r) {
                $r->summary = json_decode($r->summary, true);
                unset($r->summary['coverage']['mediaChecks']);

                return $r;
            }) : [],
            'backups' => ($full || $view === 'backup') && $admin ? DB::table('zt_archive_backups')->where('owner', $owner)->orderByDesc('created_at')->limit(30)->get() : [], 'view' => $view];
        $scope = ZaloTeamAccess::scope($u);
        $result['access'] = ['admin' => $scope['admin'], 'accounts' => $scope['accounts']];
        if (! $scope['admin']) {
            $result['settings']['accounts'] = array_values(array_intersect($result['settings']['accounts'], ZaloTeamAccess::ids($u)));
            $result['settings']['error'] = null;
            $result['settings']['daily_backup'] = false;
            $result['progress'] = null;
            $result['pcRecovery'] = null;
            $result['storage'] = [];
            $result['checkpoints'] = $result['backups'] = $result['imports'] = [];
        }
        return $result;
    }

    public function withLock(string $owner, callable $callback)
    {
        $dir = config('zalo_team.archive_path').'/locks';
        if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) {
            throw new \RuntimeException('Không tạo được kho lưu.');
        }
        $f = fopen($dir.'/'.$owner.'.lock', 'c');
        if (! $f) {
            throw new \RuntimeException('Không mở được khóa kho lưu.');
        }
        try {
            abort_unless(flock($f, LOCK_EX | LOCK_NB), 409, 'Đồng bộ hoặc sao lưu đang chạy.');

            return $callback();
        } finally {
            fclose($f);
        }
    }
}
