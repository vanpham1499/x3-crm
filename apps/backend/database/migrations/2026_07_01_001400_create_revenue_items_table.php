<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('revenue_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('revenue_id')->constrained('revenues')->cascadeOnDelete();
            $table->foreignUuid('service_package_id')->nullable()->constrained('service_packages')->nullOnDelete();
            $table->string('item_name');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('unit', 50)->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('amount', 15, 2)->default(0);
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreignUuid('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();

            $table->index(['revenue_id', 'deleted_at']);
            $table->index('service_package_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_items');
    }
};
