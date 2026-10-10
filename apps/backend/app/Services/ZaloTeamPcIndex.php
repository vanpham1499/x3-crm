<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** A disposable, owner-scoped read index. Never an authoritative history cursor. */
class ZaloTeamPcIndex
{
    public static function mediaFingerprint(object $m): string
    {
        $m = clone $m;
        // Reactions and display profiles can change without replacing the attachment.
        // Keep sender ID, content, attachment metadata and event identity in the digest.
        foreach (['reactions', 'currentReaction', 'lastReaction', 'lastReactionMine'] as $field) {
            unset($m->$field);
        }
        $m->sender = (object) ['id' => $m->sender->id ?? null];

        return self::fingerprint($m);
    }

    public static function fingerprint(object $m): string
    {
        $fields = ['id', 'clientId', 'time', 'type', 'kind', 'text', 'styles', 'inline', 'mentions', 'photoGroup', 'attachments', 'quote', 'reactions', 'currentReaction', 'lastReaction', 'lastReactionMine', 'sender', 'mine', 'archiveProjection'];
        $v = array_intersect_key((array) $m, array_flip($fields));
        $v['attachments'] = array_map(function ($a) {
            $a = clone $a;
            if (($a->kind ?? '') !== 'link') {
                foreach (['url', 'preview', 'archiveState', 'archiveError'] as $key) {
                    unset($a->$key);
                }
            }

            return $a;
        }, $m->attachments ?? []);
        $sort = function ($value) use (&$sort) {
            if (is_object($value)) {
                $array = (array) $value;
                ksort($array, SORT_STRING);

                return (object) array_map($sort, $array);
            }

            return is_array($value) ? array_map($sort, $value) : $value;
        };

        return hash('sha256', json_encode($sort((object) $v), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR));
    }

    public function build(object $source): array
    {
        $messages = [];
        $verified = [];
        $files = app(ZaloTeamArchiveFiles::class);
        // The index is an optimization. Import always revalidates source identity
        // and observations while holding the archive lock.
        DB::table('zt_archive_observations as o')->join('zt_archive_messages as m', 'm.id', '=', 'o.message_id')
            ->where('o.source_id', $source->id)->where('m.owner', $source->owner)->where('o.deleted', false)
            ->select(['o.id as observation_id', 'o.native_id', 'o.view', 'm.id', 'm.content'])->orderBy('o.id')
            ->chunk(200, function ($rows) use (&$messages, &$verified, $files) {
                $assets = DB::table('zt_archive_assets')->whereIn('message_id', $rows->pluck('id'))->get()->groupBy('message_id');
                foreach ($rows as $r) {
                    $view = json_decode($r->view);
                    if (($view->archiveOrigin ?? '') !== 'pc') {
                        continue;
                    }
                    $m = (object) array_merge((array) json_decode($r->content), (array) $view);
                    $ready = [];
                    $required = [];
                    foreach ($m->attachments ?? [] as $i => $a) {
                        if (($a->kind ?? '') !== 'link') {
                            $required[] = "attachments.$i.url";
                            if (in_array($a->kind ?? '', ['image', 'video', 'sticker'], true)) {
                                $required[] = "attachments.$i.preview";
                            }
                        }
                    }
                    foreach ($assets->get($r->id, collect()) as $a) {
                        $required[] = $a->slot;
                        if ($a->state !== 'ready' || ! $a->hash) {
                            continue;
                        }
                        $key = $a->owner.':'.$a->hash.':'.$a->bytes;
                        if (! array_key_exists($key, $verified)) {
                            $verified[$key] = $files->intact($a->owner, $a->hash, (int) $a->bytes);
                        }
                        if ($verified[$key]) {
                            $ready[] = $a->slot;
                        }
                    }
                    $messages[$r->native_id] = ['fingerprint' => self::fingerprint($m), 'readySlots' => $ready, 'complete' => ! array_diff($required, $ready)];
                }
            });

        return ['format' => 'zalo-team-pc-index/1', 'accountId' => $source->external_id, 'conversationId' => $source->conversation_id, 'messages' => (object) $messages];
    }
}
