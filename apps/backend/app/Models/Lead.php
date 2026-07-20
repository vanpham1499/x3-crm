<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Lead extends BaseModel
{
    protected $fillable = [
        'lead_code',
        'customer_name',
        'status_option_id',
        'occurred_date',
        'assigned_user_id',
        'source_option_id',
        'industry_option_id',
        'interested_service_option_id',
        'interested_service_id',
        'interested_service_text',
        'phone',
        'website',
        'industry',
        'plan_link',
        'zalo_group',
        'note',
        'closed_date',
        'converted_customer_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'occurred_date' => 'date',
        'closed_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function statusOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'status_option_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function isAssignedTo(User $user): bool
    {
        return $this->assigned_user_id === $user->id;
    }

    public function sourceOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'source_option_id');
    }

    public function industryOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'industry_option_id');
    }

    public function interestedServiceOption(): BelongsTo
    {
        return $this->belongsTo(Option::class, 'interested_service_option_id');
    }

    public function interestedService(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'interested_service_id');
    }

    public function interestedServiceOptions(): BelongsToMany
    {
        return $this->belongsToMany(Option::class, 'lead_service_options', 'lead_id', 'option_id')->withTimestamps();
    }

    public function convertedCustomer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'converted_customer_id');
    }

    public function customer(): HasOne
    {
        return $this->hasOne(Customer::class);
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
