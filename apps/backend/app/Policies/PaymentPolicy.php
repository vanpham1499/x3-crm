<?php

namespace App\Policies;

use App\Models\User;

class PaymentPolicy
{
    /**
     * Reconciliation/settlement actions (matching a payment to a project, allocating it
     * across quotations, refunding, linking) are restricted to accounting staff.
     */
    public function manage(User $user): bool
    {
        return $user->hasPermission('payment.manage');
    }
}
