<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('zt_archive_settings', fn (Blueprint $t) => $t->text('progress')->nullable());
    }

    public function down(): void
    {
        Schema::table('zt_archive_settings', fn (Blueprint $t) => $t->dropColumn('progress'));
    }
};
