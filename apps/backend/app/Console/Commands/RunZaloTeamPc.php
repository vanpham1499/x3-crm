<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class RunZaloTeamPc extends Command
{
    protected $signature = 'zalo-team:pc-worker {--watch}';

    protected $description = 'Retired: use the Zalo export file importer';

    public function handle(): int
    {
        $this->warn('Nhập trực tiếp từ Zalo PC đã ngừng. Sử dụng Nhập từ file xuất trong Đồng bộ & sao lưu.');
        return self::SUCCESS;
    }
}
