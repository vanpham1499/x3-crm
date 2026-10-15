<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_report_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 160);
            $table->string('seed_key')->nullable()->unique();
            $table->foreignId('service_id')->nullable()->constrained('services')->restrictOnDelete();
            $table->string('category', 100);
            $table->text('usage_hint')->nullable();
            $table->text('content');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['is_active', 'service_id', 'sort_order']);
        });
        $now = now();
        DB::table('permissions')->updateOrInsert(['code' => 'weeklytemplate.manage'], [
            'module' => 'weeklytemplate', 'name' => 'Quản lý mẫu báo cáo tuần',
            'description' => 'Thêm, sửa, nhân bản, sắp xếp và bật/tắt mẫu gợi ý',
            'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null,
        ]);
        $permissionId = DB::table('permissions')->where('code', 'weeklytemplate.manage')->value('id');
        $adminId = DB::table('roles')->where('name', 'ADMIN')->whereNull('deleted_at')->value('id');
        if ($adminId) {
            DB::table('role_permissions')->updateOrInsert(['role_id' => $adminId, 'permission_id' => $permissionId], [
                'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null, 'deleted_by' => null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_report_templates');
        $id = DB::table('permissions')->where('code', 'weeklytemplate.manage')->value('id');
        DB::table('role_permissions')->where('permission_id', $id)->delete();
        DB::table('permissions')->where('id', $id)->delete();
    }
};
