<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table): void {
            $table->id();
            $table->string('meeting_code', 30)->nullable()->unique();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('organizer_user_id')->constrained('users')->restrictOnDelete();
            $table->string('subject');
            $table->string('meeting_type', 30)->default('online');
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('timezone', 50)->default('Asia/Ho_Chi_Minh');
            $table->string('location', 500)->nullable();
            $table->string('meeting_url', 1000)->nullable();
            $table->string('status', 30)->default('scheduled');
            $table->text('agenda')->nullable();
            $table->text('result')->nullable();
            $table->text('next_action')->nullable();
            $table->date('next_action_date')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['starts_at', 'ends_at']);
            $table->index(['organizer_user_id', 'status', 'starts_at']);
            $table->index(['lead_id', 'customer_id', 'project_id']);
        });

        Schema::create('meeting_participants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('attendance_status', 30)->default('pending');
            $table->timestamps();

            $table->unique(['meeting_id', 'user_id']);
            $table->index(['user_id', 'attendance_status']);
        });

        Schema::create('meeting_guests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('email', 255)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('attendance_status', 30)->default('pending');
            $table->timestamps();

            $table->index(['meeting_id', 'attendance_status']);
        });

        Schema::create('meeting_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->string('action', 50);
            $table->json('payload')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['meeting_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_histories');
        Schema::dropIfExists('meeting_guests');
        Schema::dropIfExists('meeting_participants');
        Schema::dropIfExists('meetings');
    }
};
