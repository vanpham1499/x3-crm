<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Trước khi có trường nhập cọc, ứng dụng luôn sao chép tổng thanh toán vào
        // deposit_amount. Đưa các giá trị mặc định cũ về 0 để không hiển thị thành cọc thật.
        DB::table('quotations')
            ->whereColumn('deposit_amount', 'total_amount')
            ->update(['deposit_amount' => 0]);
    }

    public function down(): void
    {
        // Không khôi phục vì có thể ghi đè các khoản cọc thật được nhập sau migration này.
    }
};
