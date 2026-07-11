<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table): void {
                if (! Schema::hasColumn('users', 'role_id')) {
                    $table->foreignId('role_id')->nullable()->after('code')->constrained('roles')->restrictOnDelete();
                }

                if (! Schema::hasColumn('users', 'department_id')) {
                    $table->foreignId('department_id')->nullable()->after('role_id')->constrained('departments')->nullOnDelete();
                }

                if (! Schema::hasColumn('users', 'avatar')) {
                    $table->string('avatar')->nullable()->after('password');
                }
            });
        } else {
            Schema::create('users', function (Blueprint $table): void {
                $table->id();
                $table->string('code', 50)->unique();
                $table->foreignId('role_id')->constrained('roles')->restrictOnDelete();
                $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
                $table->string('name');
                $table->string('email')->unique();
                $table->string('phone', 30)->nullable();
                $table->string('password');
                $table->string('role', 50)->default(User::ROLE_EMPLOYEE);
                $table->string('avatar')->nullable();
                $table->boolean('is_active')->default(true);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->unsignedBigInteger('deleted_by')->nullable();
                $table->softDeletes();

                $table->index(['role_id', 'department_id']);
                $table->index('is_active');
            });

            Schema::table('users', function (Blueprint $table): void {
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('deleted_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        Schema::table('roles', function (Blueprint $table): void {
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('deleted_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('departments', function (Blueprint $table): void {
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('deleted_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('departments')) {
            Schema::table('departments', function (Blueprint $table): void {
                $table->dropForeign(['created_by']);
                $table->dropForeign(['updated_by']);
                $table->dropForeign(['deleted_by']);
            });
        }

        if (Schema::hasTable('roles')) {
            Schema::table('roles', function (Blueprint $table): void {
                $table->dropForeign(['created_by']);
                $table->dropForeign(['updated_by']);
                $table->dropForeign(['deleted_by']);
            });
        }

        Schema::dropIfExists('users');
    }
};
