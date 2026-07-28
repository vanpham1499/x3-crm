<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSIONS = [
        [
            'module' => 'kpi',
            'code' => 'kpi.view',
            'name' => 'Xem KPI',
        ],
        [
            'module' => 'kpi',
            'code' => 'kpi.manage',
            'name' => 'Quản lý kế hoạch KPI',
        ],
    ];

    public function up(): void
    {
        Schema::create('kpi_targets', function (Blueprint $table): void {
            $table->id();
            $table->string('scope_type', 20);
            $table->unsignedBigInteger('scope_id');
            $table->date('period_month');
            $table->decimal('target_amount', 18, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['scope_type', 'scope_id', 'period_month']);
            $table->index(['period_month', 'scope_type', 'deleted_at']);
        });

        $now = now();

        foreach (self::PERMISSIONS as $permission) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $permission['code']],
                [
                    'module' => $permission['module'],
                    'name' => $permission['name'],
                    'description' => 'Quyền '.$permission['name'],
                    'deleted_at' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );
        }

        $viewPermissionId = DB::table('permissions')->where('code', 'kpi.view')->value('id');
        $managePermissionId = DB::table('permissions')->where('code', 'kpi.manage')->value('id');

        foreach (DB::table('roles')->whereIn('name', ['ADMIN', 'LEADER', 'EMPLOYEE', 'SALES', 'ACCOUNTANT'])->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $roleId,
                'permission_id' => $viewPermissionId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $adminRoleId = DB::table('roles')->where('name', 'ADMIN')->value('id');

        if ($adminRoleId && $managePermissionId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $adminRoleId,
                'permission_id' => $managePermissionId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('code', ['kpi.view', 'kpi.manage'])
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
        Schema::dropIfExists('kpi_targets');
    }
};
