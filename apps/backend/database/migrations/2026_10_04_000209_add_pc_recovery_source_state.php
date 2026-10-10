<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('zt_archive_pc_recoveries', fn (Blueprint $t) => $t->string('source_state', 24)->nullable());
    }

    public function down(): void
    {
        Schema::table('zt_archive_pc_recoveries', fn (Blueprint $t) => $t->dropColumn('source_state'));
    }
};
