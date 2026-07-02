<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('jwt')->group(function (): void {
    Route::get('/auth/profile', [AuthController::class, 'profile']);
    Route::put('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::get('/users', [UsersController::class, 'index']);
    Route::get('/users/stats', [UsersController::class, 'stats'])->middleware('role:ADMIN,LEADER');
    Route::get('/users/{id}', [UsersController::class, 'show']);
    Route::post('/users', [UsersController::class, 'store'])->middleware('role:ADMIN');
    Route::put('/users/{id}', [UsersController::class, 'update'])->middleware('role:ADMIN');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('role:ADMIN');
});
