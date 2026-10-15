<?php

namespace App\Http\Controllers;

use App\Services\TeamsService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeamsController extends Controller
{
    public function __construct(private readonly TeamsService $teams) {}

    public function index()
    {
        return $this->success($this->teams->listing());
    }

    public function lookup()
    {
        return $this->success($this->teams->listing(true));
    }

    public function history(int $id)
    {
        return $this->success($this->teams->history($id));
    }

    public function store(Request $request)
    {
        return $this->success($this->teams->save(null, $this->payload($request)), 201);
    }

    public function update(Request $request, int $id)
    {
        return $this->success($this->teams->save($id, $this->payload($request, $id)));
    }

    public function destroy(int $id)
    {
        return $this->success($this->teams->remove($id));
    }

    private function payload(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('teams')->where('department_id', $request->input('departmentId'))->whereNull('deleted_at')->ignore($id)],
            'departmentId' => ['required', 'integer', Rule::exists('departments', 'id')->whereNull('deleted_at')],
            'leaderUserId' => ['present', 'nullable', 'integer', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'memberUserIds' => ['present', 'array'], 'memberUserIds.*' => ['integer', 'distinct', Rule::exists('users', 'id')->whereNull('deleted_at')],
            'confirmTransfers' => ['sometimes', 'boolean'],
        ]);
    }
}
