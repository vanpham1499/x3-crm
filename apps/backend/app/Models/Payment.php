<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends BaseModel
{
    protected $fillable = [
        'quotation_id',
        'lead_id',
        'customer_id',
        'project_id',
        'contract_id',
        'transaction_date',
        'transaction_at',
        'bank_account',
        'sender_name',
        'transaction_content',
        'amount',
        'allocated_amount',
        'refunded_amount',
        'excess_amount',
        'cumulative_received',
        'outstanding_after',
        'sequence_no',
        'customer_code_text',
        'is_notified',
        'reconciled_status',
        'status',
        'receipt_type',
        'matched_at',
        'note',
        'webhook_payload',
        'reference',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'transaction_at' => 'datetime',
        'amount' => 'decimal:2',
        'allocated_amount' => 'decimal:2',
        'refunded_amount' => 'decimal:2',
        'excess_amount' => 'decimal:2',
        'cumulative_received' => 'decimal:2',
        'outstanding_after' => 'decimal:2',
        'sequence_no' => 'integer',
        'is_notified' => 'boolean',
        'matched_at' => 'datetime',
        'webhook_payload' => 'array',
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

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class)->orderBy('allocated_at')->orderBy('id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(PaymentRefund::class)->orderBy('refunded_at')->orderBy('id');
    }
}
