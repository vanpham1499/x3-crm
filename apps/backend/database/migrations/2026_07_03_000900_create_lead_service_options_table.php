<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_service_options', function (Blueprint $table): void {
            $table->uuid('lead_id');
            $table->uuid('option_id');
            $table->timestamps();

            $table->primary(['lead_id', 'option_id']);
            $table->foreign('lead_id')->references('id')->on('leads')->cascadeOnDelete();
            $table->foreign('option_id')->references('id')->on('options')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_service_options');
    }
};