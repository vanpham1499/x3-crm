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
        'topup_credit_enabled',
        'topup_credit_limit',
        'topup_credit_note',
        'topup_credit_approved_by',
        'topup_credit_approved_at',
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
        'topup_credit_enabled' => 'boolean',
        'topup_credit_limit' => 'decimal:2',
        'topup_credit_approved_at' => 'datetime',
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

    public function topupCreditApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'topup_credit_approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class)->orderBy('sort_order')->orderBy('created_at');
    }

    public function isOwnedBy(User $user): bool
    {
        if ($this->project) {
            return $this->project->isManagedBy($user) || $this->project->isAssignedTo($user);
        }

        if ($this->customer) {
            return $this->customer->isAssignedTo($user);
        }

        return $this->lead?->isAssignedTo($user) ?? false;
    }

    public function isInDepartmentOf(User $user): bool
    {
        if ($this->project) {
            return $this->project->isInDepartmentOf($user);
        }

        if ($this->customer) {
            return $this->customer->isInDepartmentOf($user);
        }

        return $this->lead?->isInDepartmentOf($user) ?? false;
    }
}
