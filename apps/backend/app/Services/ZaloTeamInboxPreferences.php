<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Personal list organization; never changes a native Zalo chat or its messages. */
class ZaloTeamInboxPreferences
{
    private function rows(User $user)
    {
        return DB::table('zt_inbox_archived')->where('owner', ZaloTeamArchive::owner($user))->where('user_id', $user->id);
    }

    public function read(User $user): array
    {
        return ['archived' => ZaloTeamAccess::sources($this->rows($user), $user)
            ->orderBy('account_id')->orderBy('conversation_id')->get()
            ->map(fn ($r) => $r->account_id.':'.$r->conversation_id)->all()];
    }

    public function set(User $user, array $sources, bool $archived): array
    {
        $owner = ZaloTeamArchive::owner($user);
        $targets = array_map(fn ($source) => explode(':', $source, 2), $sources);
        // Authorize every source before any write, including merged groups.
        foreach ($targets as [$account]) ZaloTeamAccess::allow($user, (int) $account);
        DB::transaction(function () use ($user, $owner, $targets, $archived) {
            foreach ($targets as [$account, $conversation]) {
                if ($archived) {
                    DB::table('zt_inbox_archived')->insertOrIgnore(['owner' => $owner, 'user_id' => $user->id,
                        'account_id' => (int) $account, 'conversation_id' => $conversation, 'created_at' => now()]);
                } else {
                    $this->rows($user)->where('account_id', (int) $account)->where('conversation_id', $conversation)->delete();
                }
            }
        });
        return $this->read($user);
    }
}
