<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingGuest extends Model
{
    protected $fillable = [
        'meeting_id',
        'name',
        'email',
        'phone',
        'attendance_status',
    ];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }
}
