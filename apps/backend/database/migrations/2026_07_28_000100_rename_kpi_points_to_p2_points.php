<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        'kpipoint.view' => [
            'code' => 'p2point.view',
            'name' => 'Xem điểm P2',
        ],
        'kpipoint.create' => [
            'code' => 'p2point.create',
            'name' => 'Ghi nhận P2 (dự án mình quản lý)',
        ],
        'kpipoint.create_all' => [
            'code' => 'p2point.create_all',
            'name' => 'Ghi nhận P2 không cần dự án',
        ],
        'kpipoint.approve' => [
            'code' => 'p2point.approve',
            'name' => 'Duyệt P2 (dự án mình quản lý)',
        ],
        'kpipoint.approve_all' => [
            'code' => 'p2point.approve_all',
            'name' => 'Duyệt mọi điểm P2',
        ],
    ];

    public function up(): void
    {
        if (Schema::hasTable('kpi_points') && ! Schema::hasTable('p2_points')) {
            Schema::rename('kpi_points', 'p2_points');
        }

        DB::table('options')
            ->where('group', 'kpi_category')
            ->update([
                'group' => 'p2_category',
                'updated_at' => now(),
            ]);

        foreach (self::PERMISSIONS as $oldCode => $permission) {
            DB::table('permissions')
                ->where('code', $oldCode)
                ->update([
                    'module' => 'p2point',
                    'code' => $permission['code'],
                    'name' => $permission['name'],
                    'description' => 'Quyền '.$permission['name'],
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        foreach (self::PERMISSIONS as $oldCode => $permission) {
            $oldName = match ($oldCode) {
                'kpipoint.view' => 'Xem điểm KPI',
                'kpipoint.create' => 'Ghi nhận KPI (dự án mình quản lý)',
                'kpipoint.create_all' => 'Ghi nhận KPI không cần dự án',
                'kpipoint.approve' => 'Duyệt KPI (dự án mình quản lý)',
                'kpipoint.approve_all' => 'Duyệt mọi điểm KPI',
            };

            DB::table('permissions')
                ->where('code', $permission['code'])
                ->update([
                    'module' => 'kpipoint',
                    'code' => $oldCode,
                    'name' => $oldName,
                    'description' => 'Quyền '.$oldName,
                    'updated_at' => now(),
                ]);
        }

        DB::table('options')
            ->where('group', 'p2_category')
            ->update([
                'group' => 'kpi_category',
                'updated_at' => now(),
            ]);

        if (Schema::hasTable('p2_points') && ! Schema::hasTable('kpi_points')) {
            Schema::rename('p2_points', 'kpi_points');
        }
    }
};
