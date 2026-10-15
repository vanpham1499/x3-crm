<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WeeklyReportTemplate extends Model
{
    protected $fillable = ['seed_key', 'title', 'service_id', 'category', 'usage_hint', 'content', 'is_active', 'sort_order', 'created_by', 'updated_by'];

    protected $hidden = ['seed_key', 'created_by', 'updated_by'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer', 'version' => 'integer'];
}
