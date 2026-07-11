<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('options', function (Blueprint $table): void {
            $table->id();
            $table->string('group', 100);
            $table->string('key', 100);
            $table->string('value')->nullable();
            $table->string('label');
            $table->json('meta')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['group', 'is_active', 'deleted_at']);
            $table->index(['group', 'sort_order']);
        });

        DB::statement('create unique index options_group_key_unique on options ("group", "key") where deleted_at is null');
    }

    public function down(): void
    {
        DB::statement('drop index if exists options_group_key_unique');
        Schema::dropIfExists('options');
    }
};
