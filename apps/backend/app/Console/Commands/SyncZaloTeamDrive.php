<?php

namespace App\Console\Commands;

use App\Services\ZaloTeamDriveClient;
use App\Services\ZaloTeamDriveStore;
use App\Services\ZaloTeamRuntime;
use Illuminate\Console\Command;

class SyncZaloTeamDrive extends Command
{
    protected $signature = 'zalo-team:drive {--watch} {--check} {--recover-owner=} {--retry-owner=} {--max-seconds=1800}';
    protected $description = 'Upload and verify Zalo files on a restricted Google Shared Drive';

    public function handle(ZaloTeamDriveStore $store, ZaloTeamDriveClient $client): int
    {
        ZaloTeamRuntime::requireWorker();
        if (! ZaloTeamDriveStore::enabled() || config('zalo_team.remote_api_url')) {
            $this->error('Drive worker is disabled on this server.');
            return 1;
        }
        if ($this->option('check')) {
            try {
                $client->destination();
            } catch (\Throwable $e) {
                $this->error(preg_match('/^drive_[a-z0-9_]+$/D', $e->getMessage()) ? $e->getMessage() : 'drive_connection_failed');
                return 1;
            }
            $this->info('Shared Drive folder writable; service account cannot trash/delete this folder.');
            return 0;
        }
        if ($owner = $this->option('recover-owner')) {
            $this->info('Recovered locators: '.$store->recoverCatalog($owner));
            return 0;
        }
        if ($owner = $this->option('retry-owner')) { $store->retry($owner); }
        $start = time();
        do {
            $idle = true;
            try {
                if (! config('zalo_team.maintenance')) {
                    $result = $store->run();
                    $idle = ! array_sum($result);
                    if (! $idle) { $this->line(json_encode($result)); }
                    $store->heartbeat();
                }
            } catch (\Throwable $e) {
                $code = preg_match('/^drive_[a-z0-9_]+$/D', $e->getMessage()) ? $e->getMessage() : 'drive_worker_unavailable';
                $this->error($code);
                $store->heartbeat($code);
                if (! $this->option('watch')) { return 1; }
                sleep(15);
            }
            if (! $this->option('watch') || time() - $start >= (int) $this->option('max-seconds')) { break; }
            sleep($idle ? 15 : 3);
        } while (true);
        return 0;
    }
}
