<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validatedData();

        $response = $this->auth->login($data['email'], $data['password']);

        $request->session()->regenerate();

        return $this->success($response);
    }

    public function profile(Request $request): JsonResponse
    {
        return $this->success($this->auth->getProfile($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->success($this->auth->logout());
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $data = $request->validatedData();

        $user = $request->user();

        return $this->success($this->auth->changePassword($user, $data['currentPassword'], $data['newPassword']));
    }
}
