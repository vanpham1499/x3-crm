<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeamMembership extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $casts = ['started_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime'];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function team()
    {
        return $this->belongsTo(Team::class)->withTrashed();
    }
}
