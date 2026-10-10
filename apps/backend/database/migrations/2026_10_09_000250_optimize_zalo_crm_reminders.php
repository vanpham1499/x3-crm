<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('zt_crm_tasks', function (Blueprint $t) {
            $t->timestamp('reminded_at')->nullable();
            $t->unsignedInteger('reminder_cycle')->default(0);
            $t->index(['status', 'reminded_at', 'due_at'], 'zt_crm_tasks_reminder_pending');
        });
    }

    public function down(): void
    {
        Schema::table('zt_crm_tasks', function (Blueprint $t) {
            $t->dropIndex('zt_crm_tasks_reminder_pending');
            $t->dropColumn(['reminded_at', 'reminder_cycle']);
        });
    }
};
