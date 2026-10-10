<?php

namespace App\Console\Commands;

use App\Services\ZaloCrmDocuments;
use App\Services\ZaloCrmDocumentWorker;
use App\Services\ZaloTeamRuntime;
use Illuminate\Console\Command;

class DeliverZaloCrmDocuments extends Command
{
    protected $signature = 'zalo-team:deliver-documents {--watch} {--prune}';

    protected $description = 'Deliver explicitly confirmed CRM customer documents';

    public function handle(ZaloCrmDocumentWorker $worker): int
    {
        if (ZaloTeamRuntime::role() === 'zalo') {
            $this->error('Run on the owning CRM database only.');

            return self::FAILURE;
        }
        if ($this->option('prune')) {
            $this->info('Removed '.app(ZaloCrmDocuments::class)->prune().' expired document artifacts; history retained.');

            return self::SUCCESS;
        }
        do {
            $worked = $worker->tick();
            if (! $worked && $this->option('watch')) {
                sleep(3);
            }
        } while ($worked || $this->option('watch'));

        return self::SUCCESS;
    }
}
