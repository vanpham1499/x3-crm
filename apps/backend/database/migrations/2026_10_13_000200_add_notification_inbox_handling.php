<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_notifications', function (Blueprint $table): void {
            $table->timestampTz('handled_at')->nullable();
            $table->timestampTz('inbox_reopened_at')->nullable();
            $table->index(['user_id', 'module', 'created_at'], 'notification_module_inbox_index');
        });
        // Existing resolved/archived rows are projected as done, preserving their original evidence.
    }

    public function down(): void
    {
        Schema::table('user_notifications', function (Blueprint $table): void {
            $table->dropIndex('notification_module_inbox_index');
            $table->dropColumn(['handled_at', 'inbox_reopened_at']);
        });
    }
};
