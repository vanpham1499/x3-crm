<?php

namespace App\Console\Commands;

use App\Services\ZaloTeamArchiveBackup;
use App\Services\ZaloTeamArchiveSync;
use App\Services\ZaloTeamIdentity;
use App\Services\ZaloTeamRuntime;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SyncZaloTeamArchive extends Command
{
    protected $signature = 'zalo-team:archive {--watch : Run continuously} {--mode=all : all, sync or backup} {--max-seconds=3600 : Recycle watched worker after this many seconds} {--user= : Limit to a CRM user} {--budget=45 : Seconds per owner}';

    protected $description = 'Collect readable Zalo history/media and process requested private backups';

    public function handle(ZaloTeamArchiveSync $sync, ZaloTeamArchiveBackup $backup): int
    {
        ZaloTeamRuntime::requireWorker();
        if (config('zalo_team.remote_api_url') || config('zalo_team.maintenance')) {
            $this->warn('Archive workers moved to the dedicated Zalo service.');
            return self::SUCCESS;
        }
        $mode = $this->option('mode');
        if (! in_array($mode, ['all', 'sync', 'backup'], true)) {
            return self::INVALID;
        }
        $started = time();
        if (! Schema::hasTable('zt_archive_settings')) {
            return self::SUCCESS;
        }
        do {
            $q = DB::table('zt_archive_settings');
            if ($this->option('user')) {
                $q->where('user_id', (int) $this->option('user'));
            }
            foreach ($q->lazyById(100, 'owner') as $s) {
                try {
                    $u = app(ZaloTeamIdentity::class)->worker((int) $s->user_id);
                } catch (\Throwable) {
                    $this->warn('CRM identity unavailable; skipping user '.$s->user_id);

                    continue;
                }
                if (! $u) {
                    continue;
                }
                // Independent workers share the archive lock. Once a backup is
                // queued, let it claim the next turn instead of starting another sync.
                if ($mode === 'sync' && DB::table('zt_archive_backups')->where('owner', $s->owner)->whereIn('state', ['pending', 'running'])->exists()) {
                    continue;
                }
                try {
                    if ($mode !== 'backup') {
                        $r = $sync->run($u, max(5, min(120, (int) $this->option('budget'))));
                        if ($r['pages']) {
                            $this->info('Archived '.$r['pages'].' pages for CRM user '.$u->id);
                        }
                    }
                } catch (\Throwable $e) {
                    $this->warn('Archive sync will retry for CRM user '.$u->id.' ('.class_basename($e).').');
                }
                try {
                    if ($mode === 'sync') {
                        continue;
                    }
                    if ($s->daily_backup && ! DB::table('zt_archive_backups')->where('owner', $s->owner)->whereIn('state', ['ready', 'pending', 'running'])->where('created_at', '>=', now()->subDay())->exists()) {
                        $backup->request($u);
                    }
                    $pending = DB::table('zt_archive_backups')->where('owner', $s->owner)->whereIn('state', ['pending', 'running'])->orderBy('created_at')->first();
                    if ($pending) {
                        $backup->create($u, $pending->id);
                    }
                } catch (\Throwable $e) {
                    $this->warn('Archive worker will retry for CRM user '.$u->id.' ('.class_basename($e).').');
                }
            }
            if ($this->option('watch')) {
                sleep(5);
            }
        } while ($this->option('watch') && time() - $started < max(30, (int) $this->option('max-seconds')));

        return self::SUCCESS;
    }
}
