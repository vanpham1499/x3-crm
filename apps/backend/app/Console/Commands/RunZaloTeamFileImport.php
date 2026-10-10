<?php

namespace App\Console\Commands;

use App\Services\ZaloTeamFileImport;
use Illuminate\Console\Command;

class RunZaloTeamFileImport extends Command
{
    protected $signature = 'zalo-team:file-worker {owner}';

    protected $description = 'Process the selected local Zalo export file; exits when idle';

    public function handle(ZaloTeamFileImport $import): int
    {
        $import->work($this->argument('owner'));

        return self::SUCCESS;
    }
}
