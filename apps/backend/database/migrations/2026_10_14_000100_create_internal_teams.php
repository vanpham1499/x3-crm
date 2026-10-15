<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $t): void {
            $t->id();
            $t->string('name', 100);
            $t->foreignId('department_id')->constrained('departments');
            $t->foreignId('leader_user_id')->nullable()->index()->constrained('users');
            $t->unsignedBigInteger('created_by')->nullable();
            $t->unsignedBigInteger('updated_by')->nullable();
            $t->unsignedBigInteger('deleted_by')->nullable();
            $t->timestamps();
            $t->softDeletes();
        });
        Schema::table('users', fn (Blueprint $t) => $t->foreignId('team_id')->nullable()->index()->constrained('teams'));
        Schema::create('team_memberships', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('user_id')->constrained('users');
            $t->foreignId('team_id')->constrained('teams');
            $t->timestampTz('started_at', 6);
            $t->timestampTz('ended_at', 6)->nullable();
            $t->unsignedBigInteger('changed_by')->nullable();
            $t->index(['user_id', 'started_at']);
        });
        DB::statement('CREATE UNIQUE INDEX team_membership_open_unique ON team_memberships (user_id) WHERE ended_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX teams_active_name_unique ON teams (department_id, name) WHERE deleted_at IS NULL');
        $permissions = DB::table('permissions')->whereNull('deleted_at')->where('code', 'like', '%\_department')->get();
        foreach ($permissions as $p) {
            DB::table('permissions')->updateOrInsert(['code' => preg_replace('/_department$/', '_team', $p->code)], [
                'module' => $p->module, 'name' => str_replace(['phòng ban', 'phòng'], 'nhóm', $p->name),
                'description' => 'Trong phạm vi nhóm được quản lý', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        foreach (['view' => 'Xem', 'create' => 'Tạo', 'update' => 'Sửa', 'delete' => 'Xóa'] as $action => $label) {
            DB::table('permissions')->updateOrInsert(['code' => 'team.'.$action], [
                'module' => 'team', 'name' => $label.' nhóm nội bộ', 'description' => $label.' nhóm nội bộ',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $ids = DB::table('permissions')->where('module', 'team')->orWhere('code', 'like', '%\_team')->pluck('id');
        foreach (DB::table('roles')->where('name', 'ADMIN')->whereNull('deleted_at')->pluck('id') as $role) {
            foreach ($ids as $id) {
                DB::table('role_permissions')->insertOrIgnore(['role_id' => $role, 'permission_id' => $id]);
            }
        }
    }

    public function down(): void
    {
        $ids = DB::table('permissions')->where('module', 'team')->orWhere('code', 'like', '%\_team')->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
        Schema::dropIfExists('team_memberships');
        Schema::table('users', fn (Blueprint $t) => $t->dropConstrainedForeignId('team_id'));
        Schema::dropIfExists('teams');
    }
};
