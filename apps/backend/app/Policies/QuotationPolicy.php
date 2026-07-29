<?php

namespace App\Policies;

use App\Models\Quotation;
use App\Models\User;

class QuotationPolicy
{
    public function view(User $user, Quotation $quotation): bool
    {
        return $this->allows($user, $quotation, 'view');
    }

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
        return $this->allows($user, $quotation, 'update');
    }

    public function delete(User $user, Quotation $quotation): bool
    {
        return $this->allows($user, $quotation, 'delete');
    }

    private function allows(User $user, Quotation $quotation, string $action): bool
    {
        if ($user->hasPermission("quotation.{$action}_all")) {
            return true;
        }

        if ($user->hasPermission("quotation.{$action}_department") && $quotation->isInDepartmentOf($user)) {
            return true;
        }

        return $user->hasPermission("quotation.{$action}") && $quotation->isOwnedBy($user);
    }
}
