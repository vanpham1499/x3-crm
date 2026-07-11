<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weekly_report_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('weekly_report_id')->constrained('weekly_reports')->cascadeOnDelete();
            $table->string('file_name');
            $table->string('file_url', 500);
            $table->string('mime_type', 100)->nullable();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['weekly_report_id', 'deleted_at']);
            $table->index('uploaded_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_report_attachments');
    }
};
