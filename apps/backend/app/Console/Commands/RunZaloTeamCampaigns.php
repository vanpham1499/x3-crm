<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use App\Services\ZaloTeamRuntime;
use App\Services\ZaloTeamCampaignWorker;
class RunZaloTeamCampaigns extends Command
{
    protected $signature='zalo-team:campaigns {--once}';
    protected $description='Dispatch persisted Zalo campaigns on the dedicated VPS only';
    public function handle(ZaloTeamCampaignWorker $worker): int
    {
        if (ZaloTeamRuntime::role()!=='zalo' || !config('zalo_team.campaign_worker') || PHP_OS_FAMILY==='Windows') {
            $this->error('Campaign worker is disabled in this environment.'); return self::FAILURE;
        }
        $status=app(\App\Services\ZaloTeamCampaignTransport::class)->command(['action'=>'status']);
        if (($status['campaignProtocol'] ?? null)!==1) {
            $this->error('Connector campaign protocol is unavailable.'); return self::FAILURE;
        }
        do {
            \Illuminate\Support\Facades\DB::table('zt_campaign_workers')->updateOrInsert(['key'=>app(\App\Services\ZaloTeamCampaigns::class)->workerKey()],['seen_at'=>now()]);
            $worker->tick(); if (!$this->option('once')) sleep(2);
        } while (!$this->option('once'));
        return self::SUCCESS;
    }
}
