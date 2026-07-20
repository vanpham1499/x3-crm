<?php

namespace App\Policies;

use App\Models\Quotation;
use App\Models\User;

class QuotationPolicy
{
    public function create(User $user): bool
    {
        return $user->hasPermission('quotation.create');
    }

    /**
     * A quotation inherits ownership from whichever parent record it's tied to
     * (project takes priority, then customer, then the originating lead).
     */
    public function update(User $user, Quotation $quotation): bool
    {
        if ($user->hasPermission('quotation.update_all')) {
            return true;
        }

        if (! $user->hasPermission('quotation.update')) {
            return false;
        }

        if ($quotation->project) {
            return $quotation->project->isManagedBy($user) || $quotation->project->isAssignedTo($user);
        }

        if ($quotation->customer) {
            return $quotation->customer->isAssignedTo($user);
        }

        if ($quotation->lead) {
            return $quotation->lead->isAssignedTo($user);
        }

        return false;
    }

    public function delete(User $user, Quotation $quotation): bool
    {
        if ($user->hasPermission('quotation.delete_all')) {
            return true;
        }

        if (! $user->hasPermission('quotation.delete')) {
            return false;
        }

        if ($quotation->project) {
            return $quotation->project->isManagedBy($user) || $quotation->project->isAssignedTo($user);
        }

        if ($quotation->customer) {
            return $quotation->customer->isAssignedTo($user);
        }

        if ($quotation->lead) {
            return $quotation->lead->isAssignedTo($user);
        }

        return false;
    }
}
