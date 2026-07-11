<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomersController;
use App\Http\Controllers\ContractsController;
use App\Http\Controllers\InvoicesController;
use App\Http\Controllers\LeadsController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\OptionsController;
use App\Http\Controllers\PaymentsController;
use App\Http\Controllers\PermissionsController;
use App\Http\Controllers\ProjectsController;
use App\Http\Controllers\QuotationsController;
use App\Http\Controllers\RevenuesController;
use App\Http\Controllers\RolesController;
use App\Http\Controllers\ServicesController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => [
    'name' => 'X3 CRM Backend API',
    'status' => 'ok',
    'version' => '1.0.0',
]);

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/payments/webhook', [PaymentsController::class, 'webhook']);

Route::middleware('jwt')->group(function (): void {
    Route::get('/auth/profile', [AuthController::class, 'profile']);
    Route::get('/auth/me', [AuthController::class, 'profile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media/upload', [MediaController::class, 'upload']);

    Route::get('/options', [OptionsController::class, 'index']);
    Route::post('/options', [OptionsController::class, 'store']);
    Route::patch('/options/reorder', [OptionsController::class, 'reorder']);
    Route::get('/options/{id}', [OptionsController::class, 'show']);
    Route::put('/options/{id}', [OptionsController::class, 'update']);
    Route::patch('/options/{id}', [OptionsController::class, 'update']);
    Route::delete('/options/{id}', [OptionsController::class, 'destroy']);

    Route::get('/services', [ServicesController::class, 'index']);
    Route::get('/services/{id}', [ServicesController::class, 'show']);

    Route::middleware('role:ADMIN')->group(function (): void {
        Route::post('/services', [ServicesController::class, 'store']);
        Route::put('/services/{id}', [ServicesController::class, 'update']);
        Route::patch('/services/{id}', [ServicesController::class, 'update']);
        Route::delete('/services/{id}', [ServicesController::class, 'destroy']);
    });

    Route::get('/users', [UsersController::class, 'index']);
    Route::get('/users/stats', [UsersController::class, 'stats'])->middleware('role:ADMIN,LEADER');
    Route::get('/users/{id}', [UsersController::class, 'show']);
    Route::post('/users', [UsersController::class, 'store'])->middleware('role:ADMIN');
    Route::put('/users/{id}', [UsersController::class, 'update'])->middleware('role:ADMIN');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->middleware('role:ADMIN');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('role:ADMIN');

    Route::get('/leads', [LeadsController::class, 'index']);
    Route::post('/leads', [LeadsController::class, 'store']);
    Route::post('/leads/{id}/convert', [LeadsController::class, 'convert']);
    Route::get('/leads/{id}', [LeadsController::class, 'show']);
    Route::put('/leads/{id}', [LeadsController::class, 'update']);
    Route::patch('/leads/{id}', [LeadsController::class, 'update']);
    Route::delete('/leads/{id}', [LeadsController::class, 'destroy']);

    Route::get('/customers', [CustomersController::class, 'index']);
    Route::post('/customers', [CustomersController::class, 'store']);
    Route::get('/customers/{id}', [CustomersController::class, 'show']);
    Route::put('/customers/{id}', [CustomersController::class, 'update']);
    Route::patch('/customers/{id}', [CustomersController::class, 'update']);
    Route::delete('/customers/{id}', [CustomersController::class, 'destroy']);

    Route::get('/projects', [ProjectsController::class, 'index']);
    Route::post('/projects', [ProjectsController::class, 'store']);
    Route::get('/projects/{id}', [ProjectsController::class, 'show']);
    Route::put('/projects/{id}', [ProjectsController::class, 'update']);
    Route::patch('/projects/{id}', [ProjectsController::class, 'update']);
    Route::delete('/projects/{id}', [ProjectsController::class, 'destroy']);

    Route::get('/quotations', [QuotationsController::class, 'index']);
    Route::post('/quotations', [QuotationsController::class, 'store']);
    Route::get('/quotations/{id}', [QuotationsController::class, 'show']);
    Route::put('/quotations/{id}', [QuotationsController::class, 'update']);
    Route::patch('/quotations/{id}', [QuotationsController::class, 'update']);
    Route::delete('/quotations/{id}', [QuotationsController::class, 'destroy']);

    Route::get('/revenues', [RevenuesController::class, 'index']);
    Route::post('/revenues', [RevenuesController::class, 'store']);
    Route::get('/revenues/{id}', [RevenuesController::class, 'show']);
    Route::put('/revenues/{id}', [RevenuesController::class, 'update']);
    Route::patch('/revenues/{id}', [RevenuesController::class, 'update']);
    Route::delete('/revenues/{id}', [RevenuesController::class, 'destroy']);

    Route::get('/invoices', [InvoicesController::class, 'index']);
    Route::post('/invoices', [InvoicesController::class, 'store']);
    Route::get('/invoices/{id}', [InvoicesController::class, 'show']);
    Route::put('/invoices/{id}', [InvoicesController::class, 'update']);
    Route::patch('/invoices/{id}', [InvoicesController::class, 'update']);
    Route::delete('/invoices/{id}', [InvoicesController::class, 'destroy']);

    Route::get('/contracts', [ContractsController::class, 'index']);
    Route::post('/contracts', [ContractsController::class, 'store']);
    Route::get('/contracts/{id}', [ContractsController::class, 'show']);
    Route::put('/contracts/{id}', [ContractsController::class, 'update']);
    Route::patch('/contracts/{id}', [ContractsController::class, 'update']);
    Route::delete('/contracts/{id}', [ContractsController::class, 'destroy']);

    Route::get('/payments', [PaymentsController::class, 'index']);
    Route::post('/payments', [PaymentsController::class, 'store']);
    Route::post('/payments/{id}/match-project', [PaymentsController::class, 'matchProject']);
    Route::get('/payments/{id}', [PaymentsController::class, 'show']);
    Route::put('/payments/{id}', [PaymentsController::class, 'update']);
    Route::patch('/payments/{id}', [PaymentsController::class, 'update']);
    Route::delete('/payments/{id}', [PaymentsController::class, 'destroy']);

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
