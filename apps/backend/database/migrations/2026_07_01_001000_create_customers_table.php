<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('customer_code', 50)->unique();
            $table->foreignUuid('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->string('customer_name');
            $table->string('customer_type', 50)->nullable()->default('company');
            $table->string('company_name')->nullable();
            $table->string('representative_name')->nullable();
            $table->string('tax_code', 100)->nullable();
            $table->string('identity_no', 100)->nullable();
            $table->text('address')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->string('industry')->nullable();
            $table->date('birthday')->nullable();
            $table->foreignUuid('source_id')->nullable()->constrained('customer_sources')->nullOnDelete();
            $table->foreignUuid('sales_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['sales_user_id', 'source_id', 'deleted_at']);
            $table->index(['customer_name', 'company_name']);
        });

        Schema::table('leads', function (Blueprint $table): void {
            $table->foreign('converted_customer_id')->references('id')->on('customers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropForeign(['converted_customer_id']);
        });

        Schema::dropIfExists('customers');
    }
};
