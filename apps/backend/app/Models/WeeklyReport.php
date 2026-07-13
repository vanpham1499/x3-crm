<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeeklyReport extends BaseModel
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_APPROVED = 'approved';

    protected $fillable = [
        'project_id',
        'customer_id',
        'reporter_user_id',
        'week_start_date',
        'week_end_date',
        'report_date',
        'project_status',
        'weekly_condition',
        'status',
        'monthly_budget',
        'management_fee_rate',
        'problem_solution',
        'summary',
        'next_action',
        'submitted_at',
        'approved_by',
        'approved_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'week_start_date' => 'date',
        'week_end_date' => 'date',
        'report_date' => 'date',
        'monthly_budget' => 'decimal:2',
        'management_fee_rate' => 'decimal:2',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(WeeklyReportItem::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(WeeklyReportAttachment::class);
    }
}
