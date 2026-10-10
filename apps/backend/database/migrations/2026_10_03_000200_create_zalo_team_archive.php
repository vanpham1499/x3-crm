<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zt_archive_settings', function (Blueprint $t) {
            $t->string('owner', 64)->primary();
            $t->foreignId('user_id')->constrained('users');
            $t->boolean('enabled')->default(false);
            $t->boolean('media')->default(true);
            $t->boolean('daily_backup')->default(false);
            $t->json('accounts');
            $t->timestampTz('heartbeat')->nullable();
            $t->timestampTz('last_sync')->nullable();
            $t->string('error')->nullable();
            $t->timestampsTz();
        });
        Schema::create('zt_archive_sources', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->unsignedBigInteger('account_id');
            $t->string('external_id', 40);
            $t->string('conversation_id', 40);
            $t->string('canonical', 100)->index();
            $t->string('name');
            $t->string('account_name');
            $t->boolean('accessible')->default(true);
            $t->json('cursor')->nullable();
            $t->json('catchup_cursor')->nullable();
            $t->unsignedBigInteger('catchup_until')->nullable();
            $t->boolean('history_done')->default(false);
            $t->unsignedBigInteger('oldest')->nullable();
            $t->unsignedBigInteger('latest')->nullable();
            $t->timestampTz('last_sync')->nullable();
            $t->timestampTz('last_attempt')->nullable();
            $t->string('error')->nullable();
            $t->unique(['owner', 'external_id', 'conversation_id'], 'zt_archive_source_identity');
        });
        Schema::create('zt_archive_messages', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('canonical', 100)->index();
            $t->string('native_id', 40);
            $t->unsignedBigInteger('time')->index();
            $t->json('content');
        });
        Schema::create('zt_archive_observations', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('source_id', 64)->index();
            $t->string('message_id', 64)->index();
            $t->string('native_id', 40);
            $t->json('view');
            $t->boolean('deleted')->default(false);
            $t->timestampTz('observed_at');
            $t->unique(['source_id', 'native_id'], 'zt_archive_observation_identity');
            $t->foreign('source_id')->references('id')->on('zt_archive_sources');
            $t->foreign('message_id')->references('id')->on('zt_archive_messages');
        });
        Schema::create('zt_archive_assets', function (Blueprint $t) {
            $t->string('id', 64)->primary();
            $t->string('owner', 64)->index();
            $t->string('message_id', 64)->index();
            $t->string('slot', 80);
            $t->text('url');
            $t->string('hash', 64)->nullable()->index();
            $t->unsignedBigInteger('bytes')->default(0);
            $t->string('mime')->nullable();
            $t->string('state', 24)->default('pending');
            $t->unsignedInteger('attempts')->default(0);
            $t->timestampTz('retry_at')->nullable();
            $t->string('error')->nullable();
            $t->unique(['message_id', 'slot']);
        });
        Schema::create('zt_archive_backups', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('owner', 64)->index();
            $t->string('state');
            $t->unsignedBigInteger('bytes')->default(0);
            $t->string('checksum', 64)->nullable();
            $t->string('error')->nullable();
            $t->timestampTz('verified_at')->nullable();
            $t->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        foreach (['backups', 'assets', 'observations', 'messages', 'sources', 'settings'] as $name) {
            Schema::dropIfExists('zt_archive_'.$name);
        }
    }
};
