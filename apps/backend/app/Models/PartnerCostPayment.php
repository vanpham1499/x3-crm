<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PartnerCostPayment extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['amount' => 'decimal:2', 'paid_on' => 'date', 'voided_at' => 'datetime', 'is_legacy' => 'boolean'];
}
