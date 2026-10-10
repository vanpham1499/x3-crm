<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ZaloTeamArchiveSync
{
    public function __construct(private ZaloTeamArchive $archive, private ZaloTeamCatalog $catalog, private ZaloTeamArchiveFiles $files) {}

    public function run(User $u, int $budget = 45): array
    {
        if (ZaloTeamFileImportLease::active(ZaloTeamArchive::owner($u))) {
            return ['pages' => 0, 'deferred' => 'file-import'];
        }

        return $this->archive->withLock(ZaloTeamArchive::owner($u), function () use ($u, $budget) {
            if (ZaloTeamFileImportLease::active(ZaloTeamArchive::owner($u))) {
                return ['pages' => 0, 'deferred' => 'file-import'];
            }
            $s = $this->archive->settings($u);
            $started = microtime(true);
            $count = 0;
            $processed = 0;
            $progress = function (string $phase, array $extra = []) use ($s, &$count, &$processed) {
                DB::table('zt_archive_settings')->where('owner', $s->owner)->update(['heartbeat' => now(), 'progress' => ZaloTeamArchive::json($extra + ['phase' => $phase, 'pages' => $count, 'processed' => $processed, 'at' => now()->toIso8601String()])]);
            };
            DB::table('zt_archive_settings')->where('owner', $s->owner)->update(['heartbeat' => now()]);
            app(ZaloTeamPhoneSync::class)->tick($u);
            $phoneTick = microtime(true);
            app(ZaloTeamArchiveRetry::class)->apply($s->owner);
            // Cached attachment URLs are independent of the live Web catalog.
            // Give due downloads a bounded slot even when Zalo is disconnected.
            if ($s->media) {
                $progress('files');
                $this->files->pending($s->owner, min(10, max(1, (int) ($budget / 3))), fn ($file) => $progress('files', $file));
            }
            if (! $s->enabled) {
                $progress('paused');

                return ['pages' => 0];
            }
            try {
                $progress('catalog');
                $status = $this->catalog->command($u, ['action' => 'status']);
                $inbox = $this->catalog->command($u, ['action' => 'conversations']);
                $sources = $this->archive->catalog($u, $status, $inbox);
                $selected = json_decode($s->accounts, true);
                $sources = array_values(array_filter($sources, fn ($v) => in_array($v->account_id, $selected, true)));
                usort($sources, fn ($a, $b) => strcmp($a->last_attempt ?? '', $b->last_attempt ?? ''));
                foreach ($sources as $source) {
                    if (microtime(true) - $phoneTick >= 5) {
                        app(ZaloTeamPhoneSync::class)->tick($u);
                        $phoneTick = microtime(true);
                    }
                    if (microtime(true) - $started > max(5, $budget - 10)) {
                        break;
                    }
                    if (! DB::table('zt_archive_settings')->where('owner', $s->owner)->value('enabled')) {
                        break;
                    }
                    try {
                        $progress('messages', ['source' => $source->name, 'account' => $source->account_name, 'oldest' => $source->oldest]);
                        DB::table('zt_archive_sources')->where('id', $source->id)->update(['last_attempt' => now()]);
                        $command = ['action' => 'messages', 'accountId' => (int) $source->account_id, 'conversationId' => $source->conversation_id];
                        $page = $this->catalog->command($u, $command);
                        if (! empty($page['warning'])) {
                            throw new \RuntimeException('History incomplete');
                        }
                        // Commit gap boundaries BEFORE ingest advances latest. A failed request must not lose the gap.
                        $catchup = $source->catchup_cursor ? json_decode($source->catchup_cursor, true) : null;
                        $until = $source->catchup_until ?? max(0, ($source->latest ?? 0) - 86400000);
                        if ($source->latest && ! empty($page['cursor']) &&
                            ((! $catchup && (int) $page['cursor']['time'] > $until) || (int) $page['cursor']['time'] > $source->latest)) {
                            $catchup = $page['cursor'];
                        }
                        $cursor = $source->cursor ? json_decode($source->cursor, true) : null;
                        $checkpoint = [];
                        if ($catchup) {
                            $checkpoint = ['catchup_cursor' => ZaloTeamArchive::json($catchup), 'catchup_until' => $until];
                        }
                        if (! $cursor && ! $source->history_done) {
                            if (! empty($page['hasMore']) && empty($page['cursor'])) {
                                throw new \RuntimeException('Missing history cursor');
                            }
                            $cursor = $page['cursor'] ?? null;
                            $checkpoint += ['cursor' => $cursor ? ZaloTeamArchive::json($cursor) : null, 'history_done' => ! ($page['hasMore'] ?? false)];
                        }
                        $this->commitPage($source, $page, $checkpoint);
                        $count++;
                        // Walk the gap after downtime, persisting the cursor. A refresh of only 50 rows is insufficient.
                        if ($catchup) {
                            $p = $this->catalog->command($u, $command + ['before' => $catchup]);
                            $next = $this->advanced($catchup, $p);
                            if (! $next || (int) $next['time'] <= $until) {
                                $next = null;
                            }
                            $this->commitPage($source, $p, ['catchup_cursor' => $next ? ZaloTeamArchive::json($next) : null, 'catchup_until' => $next ? $until : null]);
                            $count++;
                        }
                        if (! $source->history_done && $cursor && microtime(true) - $started < $budget) {
                            $p = $this->catalog->command($u, $command + ['before' => $cursor]);
                            $next = $this->advanced($cursor, $p);
                            $this->commitPage($source, $p, ['cursor' => $next ? ZaloTeamArchive::json($next) : null, 'history_done' => $next === null]);
                            $count++;
                        }
                    } catch (\Throwable $e) {
                        // Retain checkpoints on failure; only a successful exhausted page completes history.
                        DB::table('zt_archive_sources')->where('id', $source->id)->update(['error' => 'Chưa đọc được nguồn; sẽ thử lại.']);
                    }
                    $processed++;
                }
                if ($s->media) {
                    $progress('files');
                    $this->files->pending($s->owner, max(1, $budget - (int) (microtime(true) - $started)), fn ($file) => $progress('files', $file));
                }
                DB::table('zt_archive_settings')->where('owner', $s->owner)->update(['last_sync' => now(), 'error' => null]);
                $progress('waiting');

                return ['pages' => $count];
            } catch (\Throwable $e) {
                $progress('error');
                DB::table('zt_archive_settings')->where('owner', $s->owner)->update(['error' => 'Nguồn Zalo chưa sẵn sàng. Kiểm tra liên kết tài khoản.']);
                throw $e;
            }
        });
    }

    private function commitPage(object $source, array $page, array $checkpoint): void
    {
        if (! empty($page['warning']) || (! empty($page['hasMore']) && empty($page['cursor']))) {
            throw new \RuntimeException('History incomplete');
        }
        DB::transaction(function () use ($source, $page, $checkpoint) {
            $this->archive->ingest($source, $page);
            if ($checkpoint) {
                DB::table('zt_archive_sources')->where('id', $source->id)->update($checkpoint);
            }
        });
    }

    private function advanced(array $before, array $page): ?array
    {
        if (! empty($page['warning'])) {
            throw new \RuntimeException('History incomplete');
        }
        if (empty($page['hasMore'])) {
            return null;
        }
        $next = $page['cursor'] ?? null;
        if (! $next || $next === $before || (int) $next['time'] > (int) $before['time']) {
            throw new \RuntimeException('History stalled');
        }

        return $next;
    }
}
