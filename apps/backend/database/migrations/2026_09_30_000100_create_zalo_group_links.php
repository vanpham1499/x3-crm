<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zalo_group_links', function (Blueprint $table) {
            $table->foreignId('conversation_id')->primary()->constrained('zalo_conversations')->cascadeOnDelete();
            $table->uuid('group_id')->index();
            $table->foreignId('account_id')->constrained('zalo_accounts')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->timestampTz('created_at');
            $table->unique(['group_id', 'account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zalo_group_links');
    }
};
