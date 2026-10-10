<?php

namespace App\Models;

// An authenticated CRM identity, never a local password/role database.
class ZaloTeamIdentityUser extends User
{
    public function hasPermission(string $code): bool
    {
        return in_array($code, $this->getAttribute('zalo_permissions') ?? [], true);
    }
}
