<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table): void {
            $table->timestamp('voided_at')->nullable()->index();
            $table->unsignedBigInteger('voided_by')->nullable();
            $table->uuid('void_request_id')->nullable()->unique();
            $table->string('void_request_hash', 64)->nullable();
            $table->json('void_details')->nullable();
        });
        $permission = DB::table('permissions')->where('code', 'quotation.void')->first();
        if (! $permission) {
            $id = DB::table('permissions')->insertGetId([
                'code' => 'quotation.void', 'module' => 'quotation',
                'name' => 'Hủy báo phí tạo nhầm và xử lý phân bổ',
                'description' => 'Hủy có lịch sử; cần quyền xem/xóa báo phí và phân bổ thanh toán.',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach (DB::table('roles')->where('name', 'ADMIN')->whereNull('deleted_at')->pluck('id') as $roleId) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id' => $roleId, 'permission_id' => $id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (DB::table('quotations')->whereNotNull('voided_at')->exists()) {
            throw new RuntimeException('Không thể rollback khi đã hủy báo phí: phải giữ lịch sử xử lý tiền.');
        }
        // Keep the permission catalog entry on rollback; without the feature it grants no action.
        Schema::table('quotations', function (Blueprint $table): void {
            $table->dropUnique(['void_request_id']);
            $table->dropIndex(['voided_at']);
            $table->dropColumn(['voided_at', 'voided_by', 'void_request_id', 'void_request_hash', 'void_details']);
        });
    }
};
