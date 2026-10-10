<?php

namespace App\Services;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class ZaloTeamArchiveReport
{
    public function dayFileIssues(User $u, string $date, ?int $account = null, int $offset = 0): array
    {
        $owner = ZaloTeamArchive::owner($u);
        $start = CarbonImmutable::parse($date, 'Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
        $origins = DB::table('zt_archive_observations as o')->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
            ->where('s.owner', $owner)->where('o.deleted', false)
            ->when(ZaloTeamAccess::ids($u) !== null, fn ($q) => $q->whereIn('s.account_id', ZaloTeamAccess::ids($u)))
            ->when($account, fn ($q) => $q->where('s.account_id', $account));
        // Same unit as days().failed: original attachment slots, once per canonical message.
        $query = DB::table('zt_archive_assets as a')->join('zt_archive_messages as m', 'm.id', '=', 'a.message_id')
            ->where('a.owner', $owner)->where('m.owner', $owner)->where('a.state', 'error')->where('a.slot', 'like', '%.url')
            ->where('m.time', '>=', $start)->where('m.time', '<', $start + 86400000)
            ->whereIn('m.id', (clone $origins)->select('o.message_id'));
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('m.time')->orderBy('a.id')->offset($offset)->limit(50)
            ->get(['a.id', 'a.message_id', 'a.slot', 'a.error', 'a.attempts', 'a.retry_at', 'm.time', 'm.content']);
        $sources = (clone $origins)->whereIn('o.message_id', $rows->pluck('message_id'))
            ->orderBy('s.account_id')->orderBy('s.id')
            ->get(['o.message_id', 'o.native_id', 'o.view', 's.id', 's.name', 's.account_id', 's.account_name'])->groupBy('message_id');
        $items = $rows->map(function ($row) use ($sources) {
            $content = json_decode($row->content, true, 64, JSON_THROW_ON_ERROR);
            $index = (int) explode('.', $row->slot)[1];
            $attachment = $content['attachments'][$index] ?? [];
            $kind = $attachment['kind'] ?? 'file';
            $fallback = match ($kind) { 'image' => 'Hình ảnh', 'video' => 'Video', 'audio' => 'Ghi âm', 'sticker' => 'Sticker', default => 'Tệp đính kèm' };
            return ['id' => $row->id, 'name' => trim($attachment['name'] ?? '') ?: $fallback, 'kind' => $kind,
                'time' => (int) $row->time, 'error' => $row->error ?: 'Chưa xác định được nguyên nhân.',
                'retryAt' => $row->attempts < 5 && $row->retry_at ? CarbonImmutable::parse($row->retry_at)->toIso8601String() : null,
                'sources' => ($sources->get($row->message_id) ?? collect())->map(function ($source) {
                    $view = json_decode($source->view, true, 64, JSON_THROW_ON_ERROR);
                    return ['id' => $source->id, 'name' => $source->name, 'accountId' => (int) $source->account_id,
                        'accountName' => $source->account_name, 'messageId' => $source->native_id,
                        'senderName' => ! empty($view['mine']) ? $source->account_name.' (Bạn)' : (trim($view['sender']['name'] ?? '') ?: 'Chưa có tên người gửi')];
                })->values()->all()];
        })->all();
        return ['date' => $date, 'total' => $total, 'items' => $items, 'nextOffset' => $offset + count($items) < $total ? $offset + count($items) : null];
    }

    public function fileSummary(string $owner, ?User $user = null): array
    {
        $role = "CASE WHEN slot LIKE '%.preview' THEN 'preview' ELSE 'original' END";
        $rows = DB::table('zt_archive_assets')->where('owner', $owner)->when($user !== null, fn ($q) => $q->tap(fn ($q) => ZaloTeamAccess::whereVisibleMessage($q, $user, 'zt_archive_assets.message_id')))->selectRaw("state, error, attempts, $role as role, COUNT(*) as count")
            ->selectRaw("SUM(CASE WHEN state = 'error' AND attempts < 5 AND (retry_at IS NULL OR retry_at <= ?) THEN 1 ELSE 0 END) as retry_due, MIN(CASE WHEN state = 'error' AND attempts < 5 AND retry_at > ? THEN retry_at ELSE NULL END) as next_retry", [now(), now()])
            ->groupBy('state', 'error', 'attempts')->groupByRaw($role)->get();
        $result = ['ready' => 0, 'pending' => 0, 'failed' => 0, 'dismissed' => 0, 'retrying' => 0, 'originalErrors' => 0, 'previewErrors' => 0, 'retryDue' => 0, 'nextRetryAt' => null, 'groups' => []];
        foreach ($rows as $r) {
            $count = (int) $r->count;
            $result['retryDue'] += (int) $r->retry_due;
            if ($r->next_retry && (! $result['nextRetryAt'] || CarbonImmutable::parse($r->next_retry)->lt($result['nextRetryAt']))) $result['nextRetryAt'] = CarbonImmutable::parse($r->next_retry)->toIso8601String();
            if ($r->state !== 'error') {
                if (isset($result[$r->state])) {
                    $result[$r->state] += $count;
                }

                continue;
            }
            $result['failed'] += $count;
            $result[$r->role === 'preview' ? 'previewErrors' : 'originalErrors'] += $count;
            if ($r->attempts < 5) {
                $result['retrying'] += $count;
            }
            $error = $r->error ?? '';
            $category = match (true) {
                str_contains($error, 'Chưa có tệp gốc đọc được từ Zalo PC') => 'pc_missing',
                preg_match('/HTTP (404|410)/', $error) === 1 => 'source_unavailable',
                preg_match('/HTTP (401|403)/', $error) === 1 => 'refresh_required',
                preg_match('/HTTP (429|5\d\d)/', $error) === 1, str_contains($error, 'phân giải'), str_contains($error, 'gián đoạn') => 'network',
                default => 'other',
            };
            $result['groups'][$category] = ($result['groups'][$category] ?? 0) + $count;
        }

        $result['needsAttention'] = $result['failed'] - $result['retrying'];

        return $result;
    }

    // Aggregate in SQL; never load message bodies just to display daily counters.
    public function days(User $u, ?int $account = null, ?string $date = null, int $offset = 0, ?int $limit = null, bool $includeSources = true): array
    {
        $owner = ZaloTeamArchive::owner($u);
        $sources = ZaloTeamAccess::sources(DB::table('zt_archive_sources')->where('owner', $owner), $u)->when($account, fn ($q) => $q->where('account_id', $account))->get();
        $visible = DB::table('zt_archive_observations')->whereIn('source_id', $sources->pluck('id'))->where('deleted', false);
        $day = '((m.time + 25200000) / 86400000)';
        $hashCollation = DB::connection()->getDriverName() === 'pgsql' ? ' COLLATE "C"' : '';
        $base = DB::table('zt_archive_messages as m')->where('m.owner', $owner)->tap(fn ($q) => ZaloTeamAccess::whereVisibleMessage($q, $u, 'm.id', $account));
        if ($date) {
            $start = CarbonImmutable::parse($date, 'Asia/Ho_Chi_Minh')->startOfDay()->getTimestampMs();
            $base->where('m.time', '>=', $start)->where('m.time', '<', $start + 86400000);
        }
        $total = $limit !== null ? (clone $base)->selectRaw("COUNT(DISTINCT $day) as total")->value('total') : null;
        $limit = $limit !== null ? max(1, min(100, $limit)) : null;
        $offset = max(0, $offset);
        if ($limit !== null) $offset = min($offset, max(0, (int) ceil($total / $limit) - 1) * $limit);
        $rows = (clone $base)->selectRaw("$day as day, COUNT(*) as messages, COUNT(DISTINCT m.canonical$hashCollation) as conversations, MIN(m.time) as oldest, MAX(m.time) as latest")->groupByRaw($day)->orderByDesc('day')->when($limit !== null, fn ($q) => $q->offset($offset)->limit($limit))->get();
        // Only aggregate media for the days on this page.
        if ($rows->isNotEmpty()) {
            $base->where('m.time', '>=', (int) $rows->min('day') * 86400000 - 25200000)
                ->where('m.time', '<', ((int) $rows->max('day') + 1) * 86400000 - 25200000);
        } else {
            $base->whereRaw('1 = 0');
        }
        $assets = (clone $base)->join('zt_archive_assets as a', 'a.message_id', '=', 'm.id')->where('a.slot', 'like', '%.url')
            ->selectRaw("$day as day, COUNT(*) as files, SUM(CASE WHEN a.state = 'ready' THEN 1 ELSE 0 END) as ready, SUM(CASE WHEN a.state = 'pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN a.state = 'error' THEN 1 ELSE 0 END) as failed, SUM(CASE WHEN a.state = 'dismissed' THEN 1 ELSE 0 END) as dismissed")->groupByRaw($day)->get()->keyBy('day');
        $blobRows = (clone $base)->join('zt_archive_assets as a', 'a.message_id', '=', 'm.id')->where('a.state', 'ready')->selectRaw("$day as day, MAX(a.bytes) as bytes")->groupByRaw("$day, a.hash$hashCollation");
        $blobs = DB::query()->fromSub($blobRows, 'daily_blobs')->selectRaw('day, COUNT(*) as blobs, SUM(bytes) as bytes')->groupBy('day')->get()->keyBy('day');
        $selected = json_decode(app(ZaloTeamArchive::class)->settings($u)->accounts, true);
        $scope = $sources->filter(fn ($s) => in_array($s->account_id, $selected, true));
        $days = $rows->map(function ($r) use ($assets, $blobs, $scope) {
            $key = (int) $r->day;
            $a = $assets->get($key);
            $start = $key * 86400000 - 25200000;
            // Completion only describes the catalog that was scanned, never unseen Zalo history.
            $unscanned = $scope->filter(fn ($s) => ! $s->history_done && (! $s->oldest || (int) $s->oldest > $start))->count();
            $gaps = $scope->filter(function ($s) use ($start) {
                $cursor = $s->catchup_cursor ? json_decode($s->catchup_cursor, true) : null;

                return $cursor && (int) ($cursor['time'] ?? 0) >= $start && (int) $s->catchup_until < $start + 86400000;
            })->count();

            return ['date' => gmdate('Y-m-d', $key * 86400), 'messages' => (int) $r->messages, 'conversations' => (int) $r->conversations,
                'files' => (int) ($a->files ?? 0), 'ready' => (int) ($a->ready ?? 0), 'pending' => (int) ($a->pending ?? 0), 'failed' => (int) ($a->failed ?? 0), 'dismissed' => (int) ($a->dismissed ?? 0),
                'blobs' => (int) ($blobs->get($key)->blobs ?? 0), 'bytes' => (int) ($blobs->get($key)->bytes ?? 0),
                'unscanned' => $unscanned, 'gaps' => $gaps, 'oldest' => (int) $r->oldest, 'latest' => (int) $r->latest];
        })->all();
        $detail = [];
        if ($date && $includeSources) {
            $counts = (clone $visible)->joinSub((clone $base)->select('m.id'), 'visible_messages', 'visible_messages.id', '=', 'zt_archive_observations.message_id')
                ->selectRaw('source_id, COUNT(*) as messages')->groupBy('source_id')->get()->keyBy('source_id');
            foreach ($sources as $s) {
                if ($c = $counts->get($s->id)) {
                    $detail[] = (array) $s + ['messages' => (int) $c->messages];
                }
            }
        }

        return ['days' => $days, 'sources' => $detail] + ($limit !== null ? ['pagination'=>['offset'=>$offset, 'limit'=>$limit, 'total'=>(int) $total]] : []);
    }
}
