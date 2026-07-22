<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectCostAdjustment extends BaseModel
{
    public const TYPE_ADDITIONAL_TOPUP = 'additional_topup';

    public const TYPE_PREVIOUS_BALANCE = 'previous_period_balance';

    public const TYPE_TRANSFER_TO_CID = 'transfer_to_cid';

    public const TYPE_CARRY_FORWARD = 'carry_forward';

    public const TYPE_CUSTOMER_BONUS = 'customer_bonus';

    public const TYPE_COMPANY_COMPENSATION = 'company_compensation';

    public const TYPE_REFUND_COMPANY = 'refund_company';

    public const TYPE_REFUND_CUSTOMER = 'refund_customer';

    public const TYPE_BANK_FEE = 'bank_fee';

    public const TYPE_ROUNDING = 'rounding';

    public const TYPE_OFFSET_NEXT_TOPUP = 'offset_next_topup';

    public const TYPE_OTHER = 'other';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const BALANCE_HANDLING_TYPES = [
        self::TYPE_TRANSFER_TO_CID,
        self::TYPE_CARRY_FORWARD,
        self::TYPE_REFUND_COMPANY,
        self::TYPE_REFUND_CUSTOMER,
        self::TYPE_OFFSET_NEXT_TOPUP,
    ];

    public const EXTRA_COST_TYPES = [
        self::TYPE_ADDITIONAL_TOPUP,
        self::TYPE_CUSTOMER_BONUS,
        self::TYPE_COMPANY_COMPENSATION,
        self::TYPE_BANK_FEE,
    ];

    public const ALL_TYPES = [
        self::TYPE_ADDITIONAL_TOPUP,
        self::TYPE_PREVIOUS_BALANCE,
        self::TYPE_TRANSFER_TO_CID,
        self::TYPE_CARRY_FORWARD,
        self::TYPE_CUSTOMER_BONUS,
        self::TYPE_COMPANY_COMPENSATION,
        self::TYPE_REFUND_COMPANY,
        self::TYPE_REFUND_CUSTOMER,
        self::TYPE_BANK_FEE,
        self::TYPE_ROUNDING,
        self::TYPE_OFFSET_NEXT_TOPUP,
        self::TYPE_OTHER,
    ];

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'project_cost_id',
        'adjustment_type',
        'status',
        'amount',
        'reference',
        'note',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function projectCost(): BelongsTo
    {
        return $this->belongsTo(ProjectCost::class);
    }
}
