<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationItem extends BaseModel
{
    protected $fillable = [
        'quotation_id',
        'service_id',
        'item_code',
        'item_name',
        'description',
        'quantity',
        'unit_price',
        'amount_before_vat',
        'vat_rate',
        'vat_amount',
        'amount_after_vat',
        'sort_order',
        'metadata',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'amount_before_vat' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'amount_after_vat' => 'decimal:2',
        'sort_order' => 'integer',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
