<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('zalo_accounts', function (Blueprint $table): void {
            $table->boolean('session_disabled')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('zalo_accounts', fn (Blueprint $table) => $table->dropColumn('session_disabled'));
    }
};
