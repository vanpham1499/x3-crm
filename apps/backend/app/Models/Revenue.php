<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Revenue extends BaseModel
{
    public const PAYMENT_STATUS_UNPAID = 'unpaid';

    public const PAYMENT_STATUS_PARTIAL = 'partial';

    public const PAYMENT_STATUS_PAID = 'paid';

    public const INVOICE_STATUS_NOT_ISSUED = 'not_issued';

    public const INVOICE_STATUS_ISSUED = 'issued';

    protected $fillable = [
        'project_id',
        'revenue_code',
        'revenue_type',
        'reported_date',
        'payment_due_date',
        'paid_date',
        'revenue_month',
        'amount_before_vat',
        'vat_rate',
        'vat_amount',
        'amount_after_vat',
        'actual_received_amount',
        'payment_status',
        'invoice_status',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'reported_date' => 'date',
        'payment_due_date' => 'date',
        'paid_date' => 'date',
        'revenue_month' => 'date',
        'amount_before_vat' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'amount_after_vat' => 'decimal:2',
        'actual_received_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RevenueItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }
}
