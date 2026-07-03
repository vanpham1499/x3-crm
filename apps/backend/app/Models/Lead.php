<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Lead extends BaseModel
{
    protected $fillable = [
        'lead_code',
        'customer_name',
        'status_id',
        'occurred_date',
        'assigned_user_id',
        'source_id',
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

    public function status(): BelongsTo
    {
        return $this->belongsTo(Status::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(CustomerSource::class, 'source_id');
    }

    public function interestedService(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'interested_service_id');
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
        return $this->hasMany(CustomerTimeline::class);
    }
}
