<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ZaloTeamArchiveDetail
{
    public function read(User $user, array $input): array
    {
        ZaloTeamAccess::allow($user, (int) $input['accountId']);
        $source = DB::table('zt_archive_sources')->where('owner', ZaloTeamArchive::owner($user))
            ->where('account_id', $input['accountId'])->where('conversation_id', $input['conversationId'])->first();
        abort_unless($source, 404, 'Hội thoại này chưa có dữ liệu lưu.');
        $nativeId = DB::connection()->getDriverName() === 'pgsql' ? 'o.native_id COLLATE "C"' : 'o.native_id COLLATE BINARY';
        $query = DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
            ->where('o.source_id', $source->id)->where('o.deleted', false);
        $before = $input['before'] ?? null;
        if ($before) $query->where(fn ($q) => $q->where('m.time', '<', $before['time'])
            ->orWhere(fn ($q) => $q->where('m.time', $before['time'])->whereRaw($nativeId.' < ?', [$before['id']])));
        $search = $input['kind'] === 'search-messages';
        if (! $search) $query->whereJsonLength('m.content->attachments', '>', 0);
        if ($search && ($input['days'] ?? 0)) $query->where('m.time', '>=', now()->subDays($input['days'])->getTimestampMs());
        $normalize = fn ($s) => mb_strtolower(Str::ascii((string) $s, 'vi'));
        $needle = $normalize(trim($input['query'] ?? ''));
        $sender = $input['sender'] ?? 'all';
        $items = []; $cursor = null; $mediaRows = [];
        $archive = app(ZaloTeamArchive::class);
        // Scan only this owner's source; stop at a whole-message boundary so albums
        // are never split/lost between pages. No raw content escapes this projection.
        foreach ($query->orderByDesc('m.time')->orderByRaw($nativeId.' DESC')->select(['m.id', 'm.time', 'm.content', 'o.view', 'o.native_id'])->cursor() as $row) {
            $body = json_decode($row->content, true); $view = json_decode($row->view, true);
            if ($search) {
                if ($sender === 'me' && empty($view['mine']) || $sender === 'others' && ! empty($view['mine'])) continue;
                if (! in_array($sender, ['all', 'me', 'others']) && (string) ($view['sender']['id'] ?? '') !== $sender) continue;
                $text = (string) ($body['text'] ?? '');
                if ($text === '') $text = implode(' · ', array_column($body['attachments'] ?? [], 'name'));
                if (! str_contains($normalize($text), $needle)) continue;
                $projected = [['id' => $row->native_id, 'time' => (int) $row->time, 'text' => $text, 'kind' => $body['kind'] ?? 'text',
                    'sender' => ['id' => ! empty($view['mine']) ? 'me' : ($view['sender']['id'] ?? ''), 'name' => ! empty($view['mine']) ? 'Bạn' : ($view['sender']['name'] ?? '')]]];
            } else {
                $kinds = match ($input['section'] ?? 'overview') { 'images' => ['image', 'video'], 'files' => ['file', 'audio'], 'links' => ['link'], default => ['image', 'video', 'file', 'audio', 'link'] };
                $attachments = $body['attachments'] ?? [];
                if (! array_filter($attachments, fn ($a) => in_array($a['kind'] ?? '', $kinds))) continue;
                if (count($items) >= 50) break;
                $mediaRows[$row->id] = $attachments;
                $projected = [];
                foreach ($attachments as $index => $attachment) if (in_array($attachment['kind'] ?? '', $kinds)) {
                    $projected[] = array_merge($attachment, ['_archiveMessage' => $row->id, '_archiveSlot' => $index, 'id' => $row->native_id.':'.$index, 'messageId' => $row->native_id, 'time' => (int) $row->time, 'sender' => $view['sender'] ?? null]);
                }
            }
            if (count($items) >= 50) break;
            $items = array_merge($items, $projected);
            $cursor = ['id' => $row->native_id, 'time' => (string) $row->time];
        }
        if ($mediaRows) {
            $assets = DB::table('zt_archive_assets')->whereIn('message_id', array_keys($mediaRows))->get();
            $available = app(ZaloTeamDriveStore::class)->availableAssets($assets);
            $byMessage = $assets->groupBy('message_id');
            foreach ($mediaRows as $id => $attachments) $mediaRows[$id] = $archive->storedAttachments($attachments, $byMessage->get($id, collect()), $available);
            foreach ($items as &$item) {
                $stored = $mediaRows[$item['_archiveMessage']][$item['_archiveSlot']];
                $item = array_merge($item, array_intersect_key($stored, array_flip(['url','preview','archiveState','archiveError'])));
                unset($item['_archiveMessage'], $item['_archiveSlot']);
            }
            unset($item);
        }
        // A full page may need one final empty read; it must never skip older rows.
        return ['accountId' => (int) $source->account_id, 'conversationId' => $source->conversation_id,
            'items' => $items, 'cursor' => count($items) >= 50 ? $cursor : null];
    }
}
