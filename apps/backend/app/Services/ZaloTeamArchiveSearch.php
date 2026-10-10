<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ZaloTeamArchiveSearch
{
    public function listing(User $user, ?int $accountId = null, int $offset = 0): array
    {
        return $this->conversations($user, '', $accountId, $offset, true);
    }

    public function conversations(User $user, string $query, ?int $accountId = null, int $offset = 0, bool $listing = false): array
    {
        $normalize = static fn (string $text) => preg_replace('/\s+/u', ' ', mb_strtolower(Str::ascii(trim($text), 'vi')));
        $needle = $normalize($query);
        if ($needle === '' && ! $listing) {
            return ['conversations' => [], 'nextOffset' => null];
        }
        // Match names first; project only the last visible message for each result.
        $sources = DB::table('zt_archive_sources as s')
            ->where('s.owner', ZaloTeamArchive::owner($user))
            ->when(ZaloTeamAccess::ids($user) !== null, fn ($q) => $q->whereIn('s.account_id', ZaloTeamAccess::ids($user)))
            ->when($accountId, fn ($q) => $q->where('s.account_id', $accountId))
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('zt_archive_observations as o')->whereColumn('o.source_id', 's.id')->where('o.deleted', false))
            ->orderBy('s.id')->select(['s.id', 's.account_id', 's.account_name', 's.conversation_id', 's.name', 's.latest'])
            ->when($listing, fn ($q) => $q->offset($offset)->limit(51))->cursor();
        $selected = [];
        $nextOffset = null;
        $skipped = $listing ? $offset : 0;
        foreach ($sources as $source) {
            if (! str_contains($normalize($source->name), $needle)) {
                continue;
            }
            if ($skipped++ < $offset) {
                continue;
            }
            if (count($selected) === 50) {
                $nextOffset = $offset + 50;
                break;
            }
            $selected[] = $source;
        }
        $ids = array_map(fn ($source) => $source->id, $selected);
        // Window before projection: bounded rows, constant query count per page.
        $messages = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
            ->whereIn('o.source_id', $ids)->where('o.deleted', false);
        $rank = 'ROW_NUMBER() OVER (PARTITION BY o.source_id ORDER BY m.time DESC, o.native_id DESC) as position';
        $lastRows = DB::query()->fromSub((clone $messages)->selectRaw("o.source_id, m.time, m.content, o.view, $rank"), 'ranked')
            ->where('position', 1)->get()->keyBy('source_id');
        $avatarRows = (clone $messages)->join('zt_archive_sources as s', 's.id', '=', 'o.source_id')
            ->whereNotNull('o.view->sender->avatarSrc')
            ->where(fn ($q) => $q->where('s.conversation_id', 'like', 'g%')->orWhereColumn('o.view->sender->id', 's.conversation_id'))
            ->selectRaw("o.source_id, o.view, $rank");
        $avatarsBySource = DB::query()->fromSub($avatarRows, 'ranked')->where('position', '<=', 40)->orderBy('position')->get()->groupBy('source_id');
        $matches = [];
        foreach ($selected as $source) {
            $last = $lastRows->get($source->id);
            $content = json_decode($last->content ?? '{}', true) ?: [];
            $view = json_decode($last->view ?? '{}', true) ?: [];
            $group = str_starts_with($source->conversation_id, 'g');
            $avatars = $avatarsBySource->get($source->id, collect())->take($group ? 40 : 1);
            $members = [];
            foreach ($avatars as $avatar) {
                $sender = json_decode($avatar->view, true)['sender'] ?? [];
                if (! empty($sender['avatarSrc'])) {
                    $members[$sender['id'] ?? $sender['avatarSrc']] = ['name' => $sender['name'] ?? '', 'avatarSrc' => $sender['avatarSrc']];
                }
                if (count($members) === 4) break;
            }
            $members = array_values($members);
            $matches[] = [
                'id' => $source->account_id.':'.$source->conversation_id,
                'accountId' => (int) $source->account_id, 'accountName' => $source->account_name,
                'conversationId' => $source->conversation_id, 'name' => $source->name,
                'updatedAt' => (int) ($last->time ?? $source->latest), 'group' => $group,
                'preview' => $this->preview($content, $view, $group),
                ...($group ? ['avatarMembers' => $members] : ['avatarSrc' => $members[0]['avatarSrc'] ?? null]),
            ];
        }

        return ['conversations' => $matches, 'nextOffset' => $nextOffset];
    }

    private function preview(array $content, array $view, bool $group): string
    {
        $text = is_string($content['text'] ?? null) ? trim($content['text']) : '';
        if ($text === '') {
            $attachment = $content['attachments'][0] ?? [];
            $text = match ($attachment['kind'] ?? $content['kind'] ?? '') {
                'image' => 'Ảnh', 'video' => 'Video', 'audio' => 'Tin nhắn thoại',
                'sticker' => 'Sticker', 'file' => $attachment['name'] ?? 'Tệp đính kèm',
                'call' => 'Cuộc gọi', 'recall' => 'Tin nhắn đã thu hồi',
                default => 'Tin nhắn',
            };
        }
        $prefix = ! empty($view['mine']) ? 'Bạn: ' : ($group && ! empty($view['sender']['name']) ? $view['sender']['name'].': ' : '');
        return Str::limit($prefix.preg_replace('/\s+/u', ' ', $text), 180);
    }
}
