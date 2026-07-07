<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends BaseModel
{
    protected $fillable = [
        'customer_code',
        'lead_id',
        'customer_name',
        'customer_type',
        'customer_type_option_id',
        'company_name',
        'representative_name',
        'tax_code',
        'identity_no',
        'address',
        'phone',
        'email',
        'website',
        'industry',
        'industry_option_id',
        'birthday',
        'source_id',
        'source_option_id',
        'sales_user_id',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'birthday' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(CustomerSource::class, 'source_id');
    }

    public function customerTypeOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'customer_type_option_id');
    }

    public function sourceOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'source_option_id');
    }

    public function industryOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'industry_option_id');
    }

    public function salesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(CustomerTimeline::class)->orderByDesc('created_at');
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
