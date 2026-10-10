<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->unsignedBigInteger('id')->primary();
            $t->string('zalo_owner', 64);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
