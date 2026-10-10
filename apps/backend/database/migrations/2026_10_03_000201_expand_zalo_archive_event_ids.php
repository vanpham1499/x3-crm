<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['zt_archive_messages', 'zt_archive_observations'] as $name) {
            Schema::table($name, fn (Blueprint $t) => $t->string('native_id', 200)->change());
        }
    }

    public function down(): void {}
};
