<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quotation extends BaseModel
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_WON = 'won';

    public const STATUS_REFUNDED = 'refunded';

    public const DEPOSIT_MODE_NON_TAXABLE_ADDITION = 'non_taxable_addition_v1';

    protected $fillable = [
        'quotation_code',
        'lead_id',
        'customer_id',
        'project_id',
        'contract_id',
        'service_id',
        'service_code',
        'service_name',
        'status',
        'subtotal_amount',
        'vat_rate',
        'vat_amount',
        'total_amount',
        'deposit_amount',
        'account_reconciliation_image_urls',
        'valid_until',
        'note',
        'metadata',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'deposit_amount' => 'decimal:2',
        'account_reconciliation_image_urls' => 'array',
        'valid_until' => 'date',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function paymentAllocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function paymentRefunds(): HasMany
    {
        return $this->hasMany(PaymentRefund::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class)->orderBy('sort_order')->orderBy('created_at');
    }
}
