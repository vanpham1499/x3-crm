<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('projects', 'project_type')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->string('project_type', 1)->default('K');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('projects', 'project_type')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('project_type');
        });
    }
};
