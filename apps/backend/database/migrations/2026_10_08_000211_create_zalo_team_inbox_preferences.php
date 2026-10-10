<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('zt_inbox_archived', function (Blueprint $t) {
            $t->string('owner', 64);
            $t->unsignedBigInteger('user_id');
            $t->unsignedBigInteger('account_id');
            $t->string('conversation_id', 32);
            $t->timestamp('created_at');
            $t->primary(['owner', 'user_id', 'account_id', 'conversation_id']);
        });
    }

    public function down(): void { Schema::dropIfExists('zt_inbox_archived'); }
};
