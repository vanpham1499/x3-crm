<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'leaderUserId' => $this->leader_user_id,
            'leader' => $this->when(
                $this->relationLoaded('leader') && $this->leader,
                fn (): array => (new UserResource($this->leader))->resolve(),
            ),
            'members' => UserResource::collection($this->whenLoaded('users')),
            'membersCount' => (int) ($this->users_count ?? 0),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
