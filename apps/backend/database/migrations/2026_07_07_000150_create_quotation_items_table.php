<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('quotation_id')->constrained('quotations')->cascadeOnDelete();
            $table->foreignUuid('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('item_code', 100)->nullable();
            $table->string('item_name');
            $table->text('description')->nullable();
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('amount_before_vat', 15, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('vat_amount', 15, 2)->default(0);
            $table->decimal('amount_after_vat', 15, 2)->default(0);
            $table->integer('sort_order')->default(0);
            $table->json('metadata')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['quotation_id', 'sort_order', 'deleted_at']);
            $table->index(['service_id', 'deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_items');
    }
};
