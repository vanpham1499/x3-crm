<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ZaloTeamPcImport;
use Illuminate\Console\Command;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ImportZaloTeamPc extends Command
{
    protected $signature = 'zalo-team:import-pc {user : CRM owner ID} {source : Existing archive source ID} {directory : PC export directory} {--apply : Import after validation} {--wait=0 : Wait up to 60 seconds for the archive lock}';

    protected $description = 'Validate/import local Zalo PC history into the existing account-scoped Team archive';

    public function handle(ZaloTeamPcImport $import): int
    {
        $user = app(\App\Services\ZaloTeamIdentity::class)->worker((int) ($this->argument('user')));
        $deadline = microtime(true) + min(60, max(0, (int) $this->option('wait')));
        do {
            try {
                $result = $import->run($user, $this->argument('source'), $this->argument('directory'), (bool) $this->option('apply'), function ($progress) {
                    $this->line(json_encode($progress, JSON_UNESCAPED_UNICODE));
                });
                break;
            } catch (HttpExceptionInterface $e) {
                if ($e->getStatusCode() !== 409 || microtime(true) >= $deadline) {
                    throw $e;
                }
                usleep(250000);
            }
        } while (true);
        $this->line(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return $result['state'] === 'conflicts' ? self::FAILURE : self::SUCCESS;
    }
}
