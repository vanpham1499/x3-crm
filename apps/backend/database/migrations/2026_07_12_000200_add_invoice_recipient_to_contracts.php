<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->string('invoice_recipient_type', 20)->default('customer')->after('note');
            $table->string('invoice_recipient_name')->nullable()->after('invoice_recipient_type');
            $table->string('invoice_representative_name')->nullable()->after('invoice_recipient_name');
            $table->string('invoice_tax_code', 50)->nullable()->after('invoice_representative_name');
            $table->text('invoice_address')->nullable()->after('invoice_tax_code');
            $table->string('invoice_email')->nullable()->after('invoice_address');
            $table->string('invoice_phone', 50)->nullable()->after('invoice_email');

            $table->index(['invoice_recipient_type', 'deleted_at']);
        });

        DB::statement(<<<'SQL'
            UPDATE contracts
            SET invoice_recipient_name = COALESCE(NULLIF(customers.company_name, ''), customers.customer_name),
                invoice_representative_name = customers.representative_name,
                invoice_tax_code = customers.tax_code,
                invoice_address = customers.address,
                invoice_email = customers.email,
                invoice_phone = customers.phone
            FROM customers
            WHERE contracts.customer_id = customers.id
        SQL);
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table): void {
            $table->dropIndex(['invoice_recipient_type', 'deleted_at']);
            $table->dropColumn([
                'invoice_recipient_type',
                'invoice_recipient_name',
                'invoice_representative_name',
                'invoice_tax_code',
                'invoice_address',
                'invoice_email',
                'invoice_phone',
            ]);
        });
    }
};
