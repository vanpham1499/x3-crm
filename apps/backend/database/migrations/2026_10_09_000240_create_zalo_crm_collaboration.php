<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('zt_crm_workspace_sources', fn (Blueprint $t) => $t->string('conversation_name', 240)->nullable());
        Schema::create('zt_crm_notes', function (Blueprint $t) {
            $t->id();
            $t->string('workspace_id', 64);
            $t->foreign('workspace_id')->references('id')->on('zt_crm_workspaces')->cascadeOnDelete();
            $t->unsignedBigInteger('author_id');
            $t->text('body');
            $t->json('mentions');
            $t->timestamps();
            $t->index(['workspace_id', 'id']);
        });
        Schema::create('zt_crm_tasks', function (Blueprint $t) {
            $t->id();
            $t->string('workspace_id', 64);
            $t->foreign('workspace_id')->references('id')->on('zt_crm_workspaces')->cascadeOnDelete();
            $t->unsignedBigInteger('assignee_id');
            $t->unsignedBigInteger('created_by');
            $t->string('title', 240);
            $t->text('description')->nullable();
            $t->string('status', 20)->default('todo');
            $t->timestamp('due_at');
            $t->unsignedBigInteger('source_account_id');
            $t->string('source_conversation_id', 32);
            $t->string('source_message_id', 128)->nullable();
            $t->unsignedBigInteger('source_message_time')->nullable();
            $t->unsignedBigInteger('project_id')->nullable();
            $t->string('repeat', 20)->default('none');
            $t->timestamp('next_repeat_at')->nullable();
            $t->string('occurrence_key', 128)->nullable()->unique();
            $t->unsignedInteger('revision')->default(0);
            $t->timestamps();
            $t->index(['workspace_id', 'status', 'due_at']);
            $t->index(['assignee_id', 'status', 'due_at']);
            $t->index('next_repeat_at');
        });
        Schema::create('zt_crm_presence', function (Blueprint $t) {
            $t->string('workspace_id', 64);
            $t->unsignedBigInteger('user_id');
            $t->string('session_id', 64);
            $t->unsignedBigInteger('account_id');
            $t->string('external_id', 64);
            $t->timestamp('expires_at')->index();
            $t->timestamp('typing_until')->nullable();
            $t->primary(['workspace_id', 'user_id', 'session_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zt_crm_presence');
        Schema::dropIfExists('zt_crm_tasks');
        Schema::dropIfExists('zt_crm_notes');
        Schema::table('zt_crm_workspace_sources', fn (Blueprint $t) => $t->dropColumn('conversation_name'));
    }
};
