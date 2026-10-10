<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // CRM owns assignments and organization membership; the Zalo VPS owns messages.
        Schema::create('zt_access_accounts', function (Blueprint $t) {
            $t->unsignedBigInteger('account_id')->primary();
            $t->string('external_id', 128)->unique();
            $t->string('name');
            $t->foreignId('department_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('primary_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps();
        });
        Schema::create('zt_access_grants', function (Blueprint $t) {
            $t->unsignedBigInteger('account_id');
            $t->foreign('account_id')->references('account_id')->on('zt_access_accounts')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->unsignedBigInteger('department_at_grant')->nullable();
            $t->string('level', 16);
            $t->boolean('can_sync')->default(false);
            $t->boolean('can_link')->default(false);
            $t->timestamps();
            $t->primary(['account_id', 'user_id']);
        });
        Schema::create('zt_access_logins', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained();
            $t->unsignedBigInteger('account_id');
            $t->unsignedBigInteger('department_id')->nullable();
            $t->timestamp('expires_at');
        });
        Schema::create('zt_access_audit', function (Blueprint $t) {
            $t->id(); $t->unsignedBigInteger('user_id')->nullable();
            $t->unsignedBigInteger('account_id')->nullable();
            $t->string('action', 80); $t->json('detail')->nullable(); $t->timestamp('created_at');
        });
    }
    public function down(): void
    {
        foreach (['zt_access_logins','zt_access_audit','zt_access_grants','zt_access_accounts'] as $table) Schema::dropIfExists($table);
    }
};
