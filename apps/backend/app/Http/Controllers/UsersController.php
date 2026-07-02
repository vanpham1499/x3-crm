<?php

namespace App\Http\Controllers;

use App\Http\Requests\Users\CreateUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Services\UsersService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UsersController extends Controller
{
    public function __construct(private readonly UsersService $users)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->users->findAll($request->query('search')));
    }

    public function stats(): JsonResponse
    {
        return $this->success($this->users->getStats());
    }

    public function show(string $id): JsonResponse
    {
        return $this->success($this->users->findOne($id));
    }

    public function store(CreateUserRequest $request): JsonResponse
    {
        return $this->success($this->users->create($request->validatedData()), 201);
    }

    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        return $this->success($this->users->update($id, $request->validatedData()));
    }

    public function destroy(string $id): JsonResponse
    {
        return $this->success($this->users->remove($id));
    }
}
