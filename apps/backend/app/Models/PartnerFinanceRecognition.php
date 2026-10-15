<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PartnerFinanceRecognition extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['amount' => 'decimal:2', 'allocations' => 'array'];
}
