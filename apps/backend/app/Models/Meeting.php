<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meeting extends BaseModel
{
    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_NO_SHOW = 'no_show';

    public const ACTIVE_STATUSES = [
        self::STATUS_SCHEDULED,
        self::STATUS_CONFIRMED,
    ];

    public const MEETING_TYPES = ['online', 'onsite', 'phone'];

    protected $fillable = [
        'meeting_code',
        'lead_id',
        'customer_id',
        'project_id',
        'organizer_user_id',
        'subject',
        'meeting_type',
        'starts_at',
        'ends_at',
        'timezone',
        'location',
        'meeting_url',
        'status',
        'agenda',
        'result',
        'next_action',
        'next_action_date',
        'cancellation_reason',
        'completed_at',
        'cancelled_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'next_action_date' => 'date',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
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

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organizer_user_id');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'meeting_participants')
            ->withPivot('attendance_status')
            ->withTimestamps();
    }

    public function guests(): HasMany
    {
        return $this->hasMany(MeetingGuest::class)->orderBy('id');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(MeetingHistory::class)->latest('created_at');
    }
}
