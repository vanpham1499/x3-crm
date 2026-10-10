<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_workspaces', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->unsignedBigInteger('revision')->default(0);
        });
        Schema::create('zt_tags', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('workspace')->index();
            $t->string('name', 80);
            $t->string('name_key', 160);
            $t->string('color', 7);
            $t->integer('position')->default(0);
            $t->boolean('archived')->default(false);
            $t->timestampsTz();
            $t->unique(['workspace', 'name_key']);
        });
        Schema::create('zt_tag_assignments', function (Blueprint $t) {
            $t->id();
            $t->string('workspace')->index();
            $t->string('source', 100);
            $t->uuid('tag_id');
            $t->boolean('active');
            $t->unsignedBigInteger('revision');
            $t->uuid('import_id')->nullable();
            $t->unique(['workspace', 'source', 'tag_id']);
            $t->foreign('tag_id')->references('id')->on('zt_tags');
        });
        Schema::create('zt_tag_imports', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('workspace')->index();
            $t->foreignId('created_by')->constrained('users');
            $t->json('snapshot');
            $t->json('result')->nullable();
            $t->timestampTz('created_at');
            $t->timestampTz('applied_at')->nullable();
            $t->timestampTz('rolled_back_at')->nullable();
        });
        Schema::create('zt_tag_audits', function (Blueprint $t) {
            $t->id();
            $t->string('workspace')->index();
            $t->uuid('request_id');
            $t->string('fingerprint', 64);
            $t->foreignId('actor_id')->constrained('users');
            $t->string('action');
            $t->json('details');
            $t->timestampTz('created_at');
            $t->unique(['workspace', 'request_id']);
        });
        if (config('zalo_team.runtime') === 'zalo') { return; }
        DB::table('permissions')->updateOrInsert(['code' => 'zalo_team.tags.manage'], ['module' => 'zalo_team', 'name' => 'Quản lý thẻ chung Zalo Team', 'description' => 'Tạo, sửa, gộp và nhập thẻ chung', 'created_at' => now(), 'updated_at' => now()]);
        $p = DB::table('permissions')->where('code', 'zalo_team.tags.manage')->value('id');
        foreach (DB::table('roles')->where('name', 'ADMIN')->pluck('id') as $r) {
            DB::table('role_permissions')->updateOrInsert(['role_id' => $r, 'permission_id' => $p], ['created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        foreach (['zt_tag_audits', 'zt_tag_imports', 'zt_tag_assignments', 'zt_tags', 'zt_workspaces'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
