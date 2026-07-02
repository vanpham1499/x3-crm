<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RevenueItem extends BaseModel
{
    protected $fillable = [
        'revenue_id',
        'service_package_id',
        'item_name',
        'quantity',
        'unit',
        'unit_price',
        'amount',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function revenue(): BelongsTo
    {
        return $this->belongsTo(Revenue::class);
    }

    public function servicePackage(): BelongsTo
    {
        return $this->belongsTo(ServicePackage::class);
    }
}
