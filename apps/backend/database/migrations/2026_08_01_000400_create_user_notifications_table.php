<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('module', 40);
            $table->string('event_key', 80);
            $table->string('title', 180);
            $table->text('message')->nullable();
            $table->string('kind', 20)->default('info');
            $table->string('severity', 20)->default('info');
            $table->string('entity_type', 60)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('action_url', 500)->nullable();
            $table->jsonb('data')->nullable();
            $table->string('dedupe_key', 191);
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'dedupe_key'], 'user_notification_dedupe_unique');
            $table->index(['user_id', 'archived_at', 'created_at'], 'user_notification_list_index');
            $table->index(['user_id', 'read_at'], 'user_notification_read_index');
            $table->index(['entity_type', 'entity_id', 'event_key'], 'user_notification_entity_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
