<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends BaseModel
{
    protected $fillable = [
        'project_id',
        'quotation_id',
        'lead_id',
        'customer_id',
        'contract_no',
        'contract_status_id',
        'deposit_amount',
        'signed_date',
        'expired_date',
        'contract_month',
        'file_url',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'deposit_amount' => 'decimal:2',
        'signed_date' => 'date',
        'expired_date' => 'date',
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

    public function contractStatus(): BelongsTo
    {
        return $this->belongsTo(Status::class, 'contract_status_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
