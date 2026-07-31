<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const LABELS = [
        'cost.manage' => 'Nạp, cập nhật chi phí',
        'cost.manage_department' => 'Nạp, cập nhật chi phí trong phòng ban',
        'cost.manage_all' => 'Nạp, cập nhật mọi chi phí',
        'cost.approve' => 'Đối soát chi phí',
        'cost.approve_department' => 'Đối soát chi phí trong phòng ban',
        'cost.approve_all' => 'Đối soát mọi chi phí',
    ];

    private const PREVIOUS_LABELS = [
        'cost.manage' => 'Nạp, cập nhật và hủy chi phí Project mình phụ trách',
        'cost.manage_department' => 'Nạp, cập nhật và hủy chi phí Project trong phòng ban',
        'cost.manage_all' => 'Nạp, cập nhật và hủy mọi chi phí Project',
        'cost.approve' => 'Đối soát chi phí thuộc dự án mình phụ trách',
        'cost.approve_department' => 'Đối soát chi phí trong phòng ban',
        'cost.approve_all' => 'Đối soát mọi chi phí',
    ];

    public function up(): void
    {
        $this->rename(self::LABELS);
    }

    public function down(): void
    {
        $this->rename(self::PREVIOUS_LABELS);
    }

    private function rename(array $labels): void
    {
        foreach ($labels as $code => $name) {
            DB::table('permissions')
                ->where('code', $code)
                ->update([
                    'name' => $name,
                    'description' => 'Quyền '.$name,
                    'updated_at' => now(),
                ]);
        }
    }
};
