<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validatedData();

        return $this->success($this->auth->login($data['email'], $data['password']));
    }

    public function profile(Request $request): JsonResponse
    {
        return $this->success($this->auth->getProfile($request->attributes->get('auth_user')));
    }

    public function logout(): JsonResponse
    {
        return $this->success($this->auth->logout());
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $data = $request->validatedData();

        $user = $request->attributes->get('auth_user');

        return $this->success($this->auth->changePassword($user, $data['currentPassword'], $data['newPassword']));
    }
}
