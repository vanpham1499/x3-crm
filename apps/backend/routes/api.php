<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\PermissionsController;
use App\Http\Controllers\RolesController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => [
    'name' => 'X3 CRM Backend API',
    'status' => 'ok',
    'version' => '1.0.0',
]);

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('jwt')->group(function (): void {
    Route::get('/auth/profile', [AuthController::class, 'profile']);
    Route::get('/auth/me', [AuthController::class, 'profile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media/upload', [MediaController::class, 'upload']);

    Route::get('/users', [UsersController::class, 'index']);
    Route::get('/users/stats', [UsersController::class, 'stats'])->middleware('role:ADMIN,LEADER');
    Route::get('/users/{id}', [UsersController::class, 'show']);
    Route::post('/users', [UsersController::class, 'store'])->middleware('role:ADMIN');
    Route::put('/users/{id}', [UsersController::class, 'update'])->middleware('role:ADMIN');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->middleware('role:ADMIN');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('role:ADMIN');

    Route::middleware('role:ADMIN')->group(function (): void {
        Route::get('/roles', [RolesController::class, 'index']);
        Route::post('/roles', [RolesController::class, 'store']);
        Route::get('/roles/{id}', [RolesController::class, 'show']);
        Route::patch('/roles/{id}', [RolesController::class, 'update']);
        Route::put('/roles/{id}', [RolesController::class, 'update']);
        Route::delete('/roles/{id}', [RolesController::class, 'destroy']);
        Route::get('/roles/{id}/permissions', [RolesController::class, 'permissions']);
        Route::post('/roles/{id}/permissions', [RolesController::class, 'syncPermissions']);

        Route::get('/permissions', [PermissionsController::class, 'index']);
    });
});
