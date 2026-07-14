<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectCost extends BaseModel
{
    public const TYPE_AD_SPEND = 'ad_spend';

    public const TYPE_PARTNER_COST = 'partner_cost';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'project_id',
        'quotation_id',
        'entry_type',
        'transaction_date',
        'status',
        'cid',
        'ad_account',
        'cid_is_dead',
        'cid_spent_amount',
        'bank_account_option_id',
        'partner_option_id',
        'amount_before_vat',
        'vat_rate',
        'vat_amount',
        'discount_amount',
        'total_amount',
        'acceptance_status',
        'input_invoice_status',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'cid_is_dead' => 'boolean',
        'cid_spent_amount' => 'decimal:2',
        'amount_before_vat' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function bankAccountOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'bank_account_option_id');
    }

    public function partnerOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'partner_option_id');
    }
}
