<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ZaloTeamTags
{
    private function workspace(): string
    {
        return config('zalo_team.workspace');
    }

    private function table(string $name)
    {
        return DB::table('zt_'.$name)->where('workspace', $this->workspace());
    }

    public function canManage(User $u): bool
    {
        return $u->hasPermission('zalo_team.tags.manage');
    }

    private function nameKey(string $s): string
    {
        $s = class_exists(\Normalizer::class) ? \Normalizer::normalize($s, \Normalizer::FORM_C) : $s;

        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($s)));
    }

    private function sourceSnapshot(array $labels): array
    {
        foreach ($labels as &$label) {
            sort($label['members']);
            if (isset($label['pendingMembers'])) {
                sort($label['pendingMembers']);
            }
        }
        unset($label);
        usort($labels, fn ($a, $b) => strcmp($a['key'], $b['key']));

        return $labels;
    }

    private function ensure(): void
    {
        DB::table('zt_workspaces')->insertOrIgnore(['id' => $this->workspace(), 'revision' => 0]);
    }

    private function tag(string $id)
    {
        $t = $this->table('tags')->where('id', $id)->first();
        abort_unless($t, 404, 'Không tìm thấy thẻ.');

        return $t;
    }

    private function keys(array $catalog, string $runtime): array
    {
        abort_unless(isset($catalog['sources'][$runtime]), 403, 'Hội thoại không còn khả dụng với tài khoản này.');
        abort_if(in_array($runtime, $catalog['blockedSources'] ?? [], true), 409, 'Chưa đọc đủ các tài khoản của nhóm đã liên kết. Kết nối lại hoặc bỏ ẩn nguồn trước khi sửa thẻ chung.');
        $sources = [$runtime];
        foreach ($catalog['groups'] as $g) {
            if (in_array($runtime, $g['sources'], true)) {
                $sources = $g['sources'];
            }
        }

        return array_values(array_unique(array_map(fn ($r) => $catalog['sources'][$r]['key'], $sources)));
    }

    private function put(string $source, string $tag, bool $active, int $revision, ?string $batch = null): void
    {
        DB::table('zt_tag_assignments')->updateOrInsert(['workspace' => $this->workspace(), 'source' => $source, 'tag_id' => $tag], ['active' => $active, 'revision' => $revision, 'import_id' => $batch]);
    }

    public function read(User $user, array $catalog): array
    {
        $this->ensure();
        $tags = $this->table('tags')->orderBy('position')->orderBy('name')->get();
        $active = $tags->where('archived', false)->pluck('id')->all();
        $keys = array_column($catalog['sources'], 'key');
        $stored = $this->table('tag_assignments')->whereIn('source', $keys)->where('active', true)->get()->groupBy('source');
        $assignments = [];
        $entities = [];
        foreach ($catalog['sources'] as $runtime => $s) {
            $assignments[$runtime] = ($stored[$s['key']] ?? collect())->pluck('tag_id')->all();
            $entities[$runtime] = $s['key'];
        }
        foreach ($catalog['groups'] as $g) {
            $union = [];
            foreach ($g['sources'] as $s) {
                $union = array_merge($union, $assignments[$s] ?? []);
            }
            foreach ($g['sources'] as $s) {
                $assignments[$s] = array_values(array_unique($union));
                $entities[$s] = 'group:'.$g['id'];
            }
        }
        $counts = [];
        foreach ($assignments as $s => $ids) {
            foreach ($ids as $id) {
                $counts[$id][$entities[$s]] = true;
            }
        }
        foreach ($assignments as $source => $ids) {
            $assignments[$source] = array_values(array_intersect($ids, $active));
        }
        $batches = [];
        if ($this->canManage($user)) {
            foreach ($this->table('tag_imports')->whereNotNull('applied_at')->orderByDesc('created_at')->limit(15)->get() as $b) {
                $batches[] = ['id' => $b->id, 'createdAt' => $b->created_at, 'rolledBack' => (bool) $b->rolled_back_at, 'result' => array_intersect_key(json_decode($b->result, true), array_flip(['added', 'pending', 'preserved', 'skipped']))];
            }
        }

        return ['revision' => (int) DB::table('zt_workspaces')->where('id', $this->workspace())->value('revision'), 'canManage' => $this->canManage($user), 'tags' => $tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'color' => $t->color, 'archived' => (bool) $t->archived, 'count' => count($counts[$t->id] ?? [])])->all(), 'assignments' => (object) $assignments, 'accounts' => $catalog['accounts'], 'unavailable' => $catalog['unavailable'], 'batches' => $batches];
    }

    public function preview(User $user, array $catalog): array
    {
        abort_unless($this->canManage($user), 403);
        abort_unless(count($catalog['accounts']), 409, 'Chưa có tài khoản Zalo sẵn sàng.');
        $id = (string) Str::uuid();
        $snapshot = ['labels' => $catalog['labels'], 'unavailable' => $catalog['unavailable']];
        DB::table('zt_tag_imports')->insert(['id' => $id, 'workspace' => $this->workspace(), 'created_by' => $user->id, 'snapshot' => json_encode($snapshot), 'created_at' => now()]);
        $remembered = [];
        foreach ($this->table('tag_imports')->whereNotNull('applied_at')->whereNull('rolled_back_at')->orderBy('applied_at')->get() as $b) {
            foreach (json_decode($b->result, true)['mapping'] ?? [] as $m) {
                $remembered[$m['key']] = $m['targetId'];
            }
        }
        $active = $this->table('tags')->where('archived', false)->pluck('id')->all();

        return ['id' => $id, 'labels' => array_map(function ($l) use ($remembered, $active) {
            $l['count'] = count($l['members']);
            unset($l['members'],$l['pendingMembers']);
            $target = $remembered[$l['key']] ?? null;
            $l['targetId'] = in_array($target, $active, true) ? $target : null;

            return $l;
        }, $catalog['labels']), 'unavailable' => $catalog['unavailable']];
    }

    public function mutate(User $user, array $v, array $catalog): array
    {
        $this->ensure();
        $kind = $v['kind'];
        if ($kind === 'assign') {
            $this->keys($catalog, $v['source']);
        } else {
            abort_unless($this->canManage($user), 403, 'Bạn chưa có quyền quản lý thẻ chung.');
        }
        $fingerprint = hash('sha256', json_encode([$user->id, $v]));

        return DB::transaction(function () use ($user, $v, $catalog, $kind, $fingerprint) {
            $w = DB::table('zt_workspaces')->where('id', $this->workspace())->lockForUpdate()->first();
            $saved = $this->table('tag_audits')->where('request_id', $v['requestId'])->first();
            if ($saved) {
                abort_unless($saved->fingerprint === $fingerprint, 409, 'Yêu cầu đã được dùng cho thao tác khác.');

                return ['status' => 'confirmed', 'replayed' => true];
            }
            abort_unless((int) $w->revision === $v['revision'], 409, 'Thẻ vừa được thay đổi. Tải lại trước khi tiếp tục.');
            $rev = $w->revision + 1;
            $details = [];
            if (in_array($kind, ['create', 'update'], true)) {
                $name = trim(preg_replace('/\s+/u', ' ', $v['name']));
                $key = $this->nameKey($name);
                abort_if($key === '', 422, 'Nhập tên thẻ.');
                $id = $kind === 'create' ? (string) Str::uuid() : $this->tag($v['id'])->id;
                abort_if($this->table('tags')->where('name_key', $key)->where('id', '!=', $id)->exists(), 409, 'Tên thẻ đã tồn tại, kể cả trong mục lưu trữ.');
                $values = ['name' => $name, 'name_key' => $key, 'color' => strtolower($v['color']), 'updated_at' => now()];
                if ($kind === 'create') {
                    DB::table('zt_tags')->insert(array_merge($values, ['id' => $id, 'workspace' => $this->workspace(), 'position' => ($this->table('tags')->max('position') ?? 0) + 1, 'archived' => false, 'created_at' => now()]));
                } else {
                    $this->table('tags')->where('id', $id)->update($values);
                }
                $details = ['id' => $id];
            } elseif ($kind === 'assign') {
                $tag = $this->tag($v['id']);
                abort_if($tag->archived, 409, 'Thẻ đã được lưu trữ.');
                $sources = $this->keys($catalog, $v['source']);
                foreach ($sources as $source) {
                    $this->put($source, $tag->id, $v['active'], $rev);
                }
                $details = ['tag' => $tag->id, 'sources' => $sources, 'active' => $v['active']];
            } elseif ($kind === 'archive') {
                $tag = $this->tag($v['id']);
                $this->table('tags')->where('id', $tag->id)->update(['archived' => $v['archived'], 'updated_at' => now()]);
                $details = ['id' => $tag->id, 'archived' => $v['archived']];
            } elseif ($kind === 'reorder') {
                $ids = $this->table('tags')->pluck('id')->all();
                abort_unless(count($ids) === count($v['ids']) && ! array_diff($ids, $v['ids']), 422, 'Danh sách thẻ đã thay đổi.');
                foreach ($v['ids'] as $i => $id) {
                    $this->table('tags')->where('id', $id)->update(['position' => $i]);
                }
            } elseif ($kind === 'merge') {
                $to = $this->tag($v['targetId']);
                abort_if($to->archived, 409, 'Chọn thẻ đích đang sử dụng.');
                abort_if(in_array($to->id, $v['ids'], true), 422, 'Thẻ đích phải khác các thẻ nguồn.');
                foreach ($v['ids'] as $id) {
                    $from = $this->tag($id);
                    foreach ($this->table('tag_assignments')->where('tag_id', $id)->where('active', true)->get() as $a) {
                        $this->put($a->source, $to->id, true, $rev);
                        $this->put($a->source, $id, false, $rev);
                    }
                    $this->table('tags')->where('id', $id)->update(['archived' => true, 'updated_at' => now()]);
                }
                $details = ['sources' => $v['ids'], 'target' => $to->id];
            } elseif ($kind === 'import') {
                $batch = $this->table('tag_imports')->where('id', $v['batchId'])->first();
                abort_unless($batch && (int) $batch->created_by === $user->id, 404);
                abort_if($batch->applied_at || $batch->rolled_back_at, 409, 'Lần nhập này đã được xử lý.');
                abort_if(now()->diffInMinutes(Carbon::parse($batch->created_at), true) > 30, 409, 'Bản xem trước đã hết hạn. Đọc lại nguồn Zalo.');
                $snapshot = json_decode($batch->snapshot, true);
                abort_unless($this->sourceSnapshot($snapshot['labels']) === $this->sourceSnapshot($catalog['labels']), 409, 'Thẻ nguồn đã thay đổi hoặc tài khoản mất kết nối. Đọc lại bản xem trước.');
                $plan = collect($v['mapping'])->keyBy('key');
                abort_unless(count($v['mapping']) === count($snapshot['labels']) && $plan->count() === count($snapshot['labels']), 422, 'Cần đối chiếu đủ các thẻ nguồn.');
                $details = ['added' => 0, 'preserved' => 0, 'pending' => 0, 'skipped' => 0, 'created' => [], 'mapping' => []];
                foreach ($snapshot['labels'] as $l) {
                    $m = $plan->get($l['key']);
                    abort_unless($m, 422, 'Ánh xạ không khớp nguồn.');
                    $details['pending'] += $l['pending'];
                    if ($m['skip'] ?? false) {
                        $details['skipped'] += count($l['members']);

                        continue;
                    }
                    if (! empty($m['targetId'])) {
                        $t = $this->tag($m['targetId']);
                        abort_if($t->archived, 409, 'Thẻ đích đã lưu trữ.');
                        $id = $t->id;
                    } else {
                        $name = trim(preg_replace('/\s+/u', ' ', $m['name']));
                        $key = $this->nameKey($name);
                        abort_if($key === '', 422, 'Nhập tên thẻ chung.');
                        $t = $this->table('tags')->where('name_key', $key)->first();
                        abort_if($t && $t->archived, 409, 'Tên này nằm trong thẻ đã lưu trữ. Chọn tên khác hoặc khôi phục thẻ.');
                        $id = $t?->id ?? (string) Str::uuid();
                        abort_if($t && in_array($id, $details['created'], true) && strtolower($t->color) !== strtolower($m['color']), 422, 'Các thẻ cùng tên đích cần chọn cùng một màu trước khi nhập.');
                        if (! $t) {
                            DB::table('zt_tags')->insert(['id' => $id, 'workspace' => $this->workspace(), 'name' => $name, 'name_key' => $key, 'color' => $m['color'], 'position' => ($this->table('tags')->max('position') ?? 0) + 1, 'archived' => false, 'created_at' => now(), 'updated_at' => now()]);
                            $details['created'][] = $id;
                        }
                    }
                    $details['mapping'][] = ['key' => $l['key'], 'targetId' => $id];
                    foreach ($l['members'] as $source) {
                        // A false row is an explicit removal/rollback: never resurrect it on re-import.
                        if ($this->table('tag_assignments')->where('source', $source)->where('tag_id', $id)->exists()) {
                            $details['preserved']++;

                            continue;
                        }
                        $this->put($source, $id, true, $rev, $batch->id);
                        $details['added']++;
                    }
                }
                $this->table('tag_imports')->where('id', $batch->id)->update(['result' => json_encode($details), 'applied_at' => now()]);
            } elseif ($kind === 'rollback') {
                $batch = $this->table('tag_imports')->where('id', $v['batchId'])->first();
                abort_unless($batch && $batch->applied_at && ! $batch->rolled_back_at, 409, 'Lần nhập không còn có thể hoàn tác.');
                $affected = $this->table('tag_assignments')->where('import_id', $batch->id)->where('active', true)->update(['active' => false, 'revision' => $rev, 'import_id' => null]);
                $this->table('tag_imports')->where('id', $batch->id)->update(['rolled_back_at' => now()]);
                $details = ['removed' => $affected];
            } else {
                abort(422, 'Thao tác không hợp lệ.');
            }
            DB::table('zt_tag_audits')->insert(['workspace' => $this->workspace(), 'request_id' => $v['requestId'], 'fingerprint' => $fingerprint, 'actor_id' => $user->id, 'action' => $kind, 'details' => json_encode($details), 'created_at' => now()]);
            DB::table('zt_workspaces')->where('id', $this->workspace())->update(['revision' => $rev]);

            return ['status' => 'confirmed', 'details' => $details];
        });
    }
}
