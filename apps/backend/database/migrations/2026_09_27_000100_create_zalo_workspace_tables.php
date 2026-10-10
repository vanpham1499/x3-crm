<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zalo_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('slot', 64)->unique();
            $table->string('external_id', 128)->unique();
            $table->string('display_name');
            $table->string('label')->nullable();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('connected')->default(false);
            $table->string('version', 64)->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('zalo_customers', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->timestampsTz();
        });
        Schema::create('zalo_contacts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_id')->constrained('zalo_accounts')->restrictOnDelete();
            $table->string('external_id', 128);
            $table->string('display_name');
            $table->string('phone', 50)->nullable();
            $table->foreignId('customer_id')->constrained('zalo_customers')->restrictOnDelete();
            $table->timestampsTz();
            $table->unique(['account_id', 'external_id']);
        });
        Schema::create('zalo_conversations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_id')->constrained('zalo_accounts')->restrictOnDelete();
            $table->string('external_id', 128);
            $table->string('thread_type', 10);
            $table->string('title');
            $table->foreignId('contact_id')->nullable()->constrained('zalo_contacts')->nullOnDelete();
            $table->unsignedInteger('unread_count')->default(0);
            $table->timestampTz('last_message_at')->nullable();
            $table->text('last_message_text')->nullable();
            $table->timestampsTz();
            $table->unique(['account_id', 'thread_type', 'external_id'], 'zalo_conversation_source_unique');
            $table->index(['account_id', 'last_message_at']);
        });
        Schema::create('zalo_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_id')->constrained('zalo_accounts')->restrictOnDelete();
            $table->foreignId('conversation_id')->constrained('zalo_conversations')->restrictOnDelete();
            $table->string('external_id', 128);
            $table->string('sender_id', 128);
            $table->string('direction', 3);
            $table->string('kind', 20);
            $table->text('text')->nullable();
            $table->timestampTz('sent_at');
            $table->timestampsTz();
            $table->unique(['conversation_id', 'external_id']);
            $table->index(['conversation_id', 'sent_at', 'id']);
        });
        Schema::create('zalo_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_id')->constrained('zalo_accounts')->restrictOnDelete();
            $table->foreignId('message_id')->constrained('zalo_messages')->restrictOnDelete();
            $table->unsignedInteger('ordinal');
            $table->string('external_id', 128)->nullable();
            $table->string('name');
            $table->string('mime', 128)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->text('source_url')->nullable();
            $table->string('status', 20)->default('pending');
            $table->string('sha256', 64)->nullable();
            $table->string('storage_path')->nullable();
            $table->string('unavailable_reason', 128)->nullable();
            $table->timestampsTz();
            $table->unique(['message_id', 'ordinal']);
            $table->index(['account_id', 'status']);
        });
        Schema::create('zalo_tags', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('color', 7)->default('#0068ff');
            $table->timestampsTz();
        });
        Schema::create('zalo_customer_tags', function (Blueprint $table): void {
            $table->foreignId('customer_id')->constrained('zalo_customers')->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained('zalo_tags')->cascadeOnDelete();
            $table->primary(['customer_id', 'tag_id']);
        });
        Schema::create('zalo_audit_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 64);
            $table->string('subject_type', 64);
            $table->unsignedBigInteger('subject_id');
            $table->json('details');
            $table->timestampTz('created_at');
        });
        Schema::create('zalo_native_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_id')->constrained('zalo_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampTz('created_at');
        });
        foreach (['zalo.view' => 'Xem không gian Zalo', 'zalo.manage' => 'Quản lý tài khoản và nhãn Zalo'] as $code => $name) {
            DB::table('permissions')->updateOrInsert(['code' => $code], [
                'name' => $name, 'module' => 'zalo', 'description' => $name,
                'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
            ]);
        }
        foreach (['ADMIN', 'LEADER', 'EMPLOYEE', 'SALES', 'ACCOUNTANT'] as $role) {
            $roleId = DB::table('roles')->where('name', $role)->whereNull('deleted_at')->value('id');
            if (! $roleId) {
                continue;
            }
            foreach (DB::table('permissions')->whereIn('code', $role === 'ADMIN' ? ['zalo.view', 'zalo.manage'] : ['zalo.view'])->pluck('id') as $id) {
                DB::table('role_permissions')->updateOrInsert(['role_id' => $roleId, 'permission_id' => $id], [
                    'created_at' => now(), 'updated_at' => now(), 'deleted_at' => null,
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (['zalo_native_tickets', 'zalo_audit_entries', 'zalo_customer_tags', 'zalo_tags', 'zalo_attachments', 'zalo_messages', 'zalo_conversations', 'zalo_contacts', 'zalo_customers', 'zalo_accounts'] as $table) {
            Schema::dropIfExists($table);
        }
        $permissionIds = DB::table('permissions')->whereIn('code', ['zalo.view', 'zalo.manage'])->pluck('id');
        DB::table('role_permissions')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
