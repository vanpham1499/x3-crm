<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_service_options', function (Blueprint $table): void {
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->foreignId('option_id')->constrained('options')->cascadeOnDelete();
            $table->timestamps();

            $table->primary(['lead_id', 'option_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_service_options');
    }
};