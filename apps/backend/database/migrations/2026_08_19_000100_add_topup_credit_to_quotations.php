<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSION_CODE = 'quotation.approve_topup_credit';

    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->boolean('topup_credit_enabled')->default(false)->after('deposit_amount');
            $table->decimal('topup_credit_limit', 18, 2)->default(0)->after('topup_credit_enabled');
            $table->text('topup_credit_note')->nullable()->after('topup_credit_limit');
            $table->foreignId('topup_credit_approved_by')
                ->nullable()
                ->after('topup_credit_note')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('topup_credit_approved_at')->nullable()->after('topup_credit_approved_by');
        });

        DB::transaction(function (): void {
            $now = now();
            DB::table('permissions')->updateOrInsert(
                ['code' => self::PERMISSION_CODE],
                [
                    'module' => 'quotation',
                    'name' => 'Duyệt hạn mức nợ để nạp ngân sách',
                    'description' => 'Cho phép Báo phí giải ngân ngân sách trước khi khách thanh toán',
                    'deleted_at' => null,
                    'deleted_by' => null,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );

            $permissionId = DB::table('permissions')->where('code', self::PERMISSION_CODE)->value('id');
            $eligibleRoleIds = DB::table('roles')
                ->whereNull('deleted_at')
                ->where(function ($query): void {
                    $query
                        ->where('name', 'ADMIN')
                        ->orWhereExists(function ($permissionQuery): void {
                            $permissionQuery
                                ->selectRaw('1')
                                ->from('role_permissions')
                                ->join('permissions', 'permissions.id', '=', 'role_permissions.permission_id')
                                ->whereColumn('role_permissions.role_id', 'roles.id')
                                ->whereNull('role_permissions.deleted_at')
                                ->whereNull('permissions.deleted_at')
                                ->whereIn('permissions.code', [
                                    'quotation.update_department',
                                    'quotation.update_all',
                                ]);
                        });
                })
                ->pluck('id');

            $rows = $eligibleRoleIds->map(fn ($roleId): array => [
                'role_id' => $roleId,
                'permission_id' => $permissionId,
                'deleted_at' => null,
                'deleted_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            if ($rows !== []) {
                DB::table('role_permissions')->upsert(
                    $rows,
                    ['role_id', 'permission_id'],
                    ['deleted_at', 'deleted_by', 'updated_at'],
                );
            }
        });
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->where('code', self::PERMISSION_CODE)
            ->pluck('id');

        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('topup_credit_approved_by');
            $table->dropColumn([
                'topup_credit_enabled',
                'topup_credit_limit',
                'topup_credit_note',
                'topup_credit_approved_at',
            ]);
        });
    }
};
