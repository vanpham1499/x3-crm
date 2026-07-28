<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContractsController;
use App\Http\Controllers\CustomersController;
use App\Http\Controllers\DepartmentsController;
use App\Http\Controllers\KpiController;
use App\Http\Controllers\LeadsController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\MeetingsController;
use App\Http\Controllers\OptionsController;
use App\Http\Controllers\P2PointsController;
use App\Http\Controllers\PaymentsController;
use App\Http\Controllers\PermissionsController;
use App\Http\Controllers\ProjectCostsController;
use App\Http\Controllers\ProjectsController;
use App\Http\Controllers\ProjectWeeklySettingsController;
use App\Http\Controllers\QuotationsController;
use App\Http\Controllers\RolesController;
use App\Http\Controllers\ServicesController;
use App\Http\Controllers\UsersController;
use App\Http\Controllers\WeeklyReportAttachmentsController;
use App\Http\Controllers\WeeklyReportsController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => [
    'name' => 'X3 CRM Backend API',
    'status' => 'ok',
    'version' => '1.0.0',
]);

Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/payments/webhook', [PaymentsController::class, 'webhook'])->middleware('verify_payment_webhook');

Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::get('/auth/profile', [AuthController::class, 'profile']);
    Route::get('/auth/me', [AuthController::class, 'profile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/change-password', [AuthController::class, 'changePassword']);

    Route::get('/media', [MediaController::class, 'index']);
    Route::post('/media/upload', [MediaController::class, 'upload']);
    Route::patch('/media/{id}', [MediaController::class, 'update']);
    Route::delete('/media/{id}', [MediaController::class, 'destroy']);

    Route::get('/options', [OptionsController::class, 'index']);
    Route::get('/options/{id}', [OptionsController::class, 'show']);

    Route::get('/services', [ServicesController::class, 'index']);
    Route::get('/services/{id}', [ServicesController::class, 'show']);

    Route::middleware('permission:option.manage')->group(function (): void {
        Route::post('/options', [OptionsController::class, 'store']);
        Route::patch('/options/reorder', [OptionsController::class, 'reorder']);
        Route::put('/options/{id}', [OptionsController::class, 'update']);
        Route::patch('/options/{id}', [OptionsController::class, 'update']);
        Route::delete('/options/{id}', [OptionsController::class, 'destroy']);

        Route::post('/services', [ServicesController::class, 'store']);
        Route::patch('/services/reorder', [ServicesController::class, 'reorder']);
        Route::put('/services/{id}', [ServicesController::class, 'update']);
        Route::patch('/services/{id}', [ServicesController::class, 'update']);
        Route::delete('/services/{id}', [ServicesController::class, 'destroy']);
    });

    Route::get('/users', [UsersController::class, 'index']);
    Route::get('/users/stats', [UsersController::class, 'stats'])->middleware('permission:user.view');
    Route::get('/users/{id}', [UsersController::class, 'show']);
    Route::post('/users', [UsersController::class, 'store'])->middleware('permission:user.create');
    Route::put('/users/{id}', [UsersController::class, 'update'])->middleware('permission:user.update');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->middleware('permission:user.update');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('permission:user.delete');

    Route::get('/departments', [DepartmentsController::class, 'index'])->middleware('permission:user.view');
    Route::get('/departments/{id}', [DepartmentsController::class, 'show'])->middleware('permission:user.view');
    Route::post('/departments', [DepartmentsController::class, 'store'])->middleware('permission:user.create');
    Route::put('/departments/{id}', [DepartmentsController::class, 'update'])->middleware('permission:user.update');
    Route::patch('/departments/{id}', [DepartmentsController::class, 'update'])->middleware('permission:user.update');
    Route::delete('/departments/{id}', [DepartmentsController::class, 'destroy'])->middleware('permission:user.delete');

    Route::get('/leads', [LeadsController::class, 'index'])->middleware('permission:lead.view');
    Route::post('/leads', [LeadsController::class, 'store']);
    Route::post('/leads/{id}/convert', [LeadsController::class, 'convert']);
    Route::get('/leads/{id}', [LeadsController::class, 'show'])->middleware('permission:lead.view');
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

    Route::get('/project-costs', [ProjectCostsController::class, 'index']);
    Route::post('/project-costs', [ProjectCostsController::class, 'store']);
    Route::post('/project-costs/{id}/reconcile', [ProjectCostsController::class, 'reconcile']);
    Route::put('/project-costs/{id}/cid-incident', [ProjectCostsController::class, 'reportCidIncident']);
    Route::post('/project-costs/{id}/cid-incident/confirm', [ProjectCostsController::class, 'confirmCidIncident']);
    Route::delete('/project-costs/{id}/cid-incident', [ProjectCostsController::class, 'cancelCidIncident']);
    Route::get('/project-costs/{id}', [ProjectCostsController::class, 'show']);
    Route::put('/project-costs/{id}', [ProjectCostsController::class, 'update']);
    Route::patch('/project-costs/{id}', [ProjectCostsController::class, 'update']);
    Route::delete('/project-costs/{id}', [ProjectCostsController::class, 'destroy']);

    Route::get('/quotations', [QuotationsController::class, 'index']);
    Route::post('/quotations', [QuotationsController::class, 'store']);
    Route::get('/quotations/{id}', [QuotationsController::class, 'show']);
    Route::put('/quotations/{id}', [QuotationsController::class, 'update']);
    Route::patch('/quotations/{id}', [QuotationsController::class, 'update']);
    Route::delete('/quotations/{id}', [QuotationsController::class, 'destroy']);

    Route::get('/contracts', [ContractsController::class, 'index']);
    Route::post('/contracts', [ContractsController::class, 'store']);
    Route::get('/contracts/{id}', [ContractsController::class, 'show']);
    Route::put('/contracts/{id}', [ContractsController::class, 'update']);
    Route::patch('/contracts/{id}', [ContractsController::class, 'update']);
    Route::delete('/contracts/{id}', [ContractsController::class, 'destroy']);

    Route::get('/project-weekly-settings', [ProjectWeeklySettingsController::class, 'index']);
    Route::get('/project-weekly-settings/assignment-summary', [ProjectWeeklySettingsController::class, 'assignmentSummary']);
    Route::post('/project-weekly-settings', [ProjectWeeklySettingsController::class, 'store']);
    Route::get('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'show']);
    Route::put('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'update']);
    Route::patch('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'update']);
    Route::delete('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'destroy']);

    Route::get('/weekly-reports/board', [WeeklyReportsController::class, 'board']);
    Route::get('/weekly-reports', [WeeklyReportsController::class, 'index']);
    Route::post('/weekly-reports', [WeeklyReportsController::class, 'store']);
    Route::get('/weekly-reports/{id}', [WeeklyReportsController::class, 'show']);
    Route::put('/weekly-reports/{id}', [WeeklyReportsController::class, 'update']);
    Route::patch('/weekly-reports/{id}', [WeeklyReportsController::class, 'update']);
    Route::delete('/weekly-reports/{id}', [WeeklyReportsController::class, 'destroy']);
    Route::post('/weekly-reports/{id}/submit', [WeeklyReportsController::class, 'submit']);
    Route::post('/weekly-reports/{id}/approve', [WeeklyReportsController::class, 'approve']);
    Route::post('/weekly-reports/{id}/return-to-draft', [WeeklyReportsController::class, 'returnToDraft']);
    Route::post('/weekly-reports/{id}/attachments', [WeeklyReportAttachmentsController::class, 'store']);
    Route::delete('/weekly-report-attachments/{id}', [WeeklyReportAttachmentsController::class, 'destroy']);

    Route::middleware('permission:meeting.view')->group(function (): void {
        Route::get('/meetings/summary', [MeetingsController::class, 'summary']);
        Route::get('/meetings', [MeetingsController::class, 'index']);
        Route::post('/meetings', [MeetingsController::class, 'store'])->middleware('permission:meeting.create');
        Route::get('/meetings/{id}', [MeetingsController::class, 'show']);
        Route::put('/meetings/{id}', [MeetingsController::class, 'update']);
        Route::patch('/meetings/{id}', [MeetingsController::class, 'update']);
        Route::delete('/meetings/{id}', [MeetingsController::class, 'destroy']);
        Route::post('/meetings/{id}/confirm', [MeetingsController::class, 'confirm']);
        Route::post('/meetings/{id}/complete', [MeetingsController::class, 'complete']);
        Route::post('/meetings/{id}/cancel', [MeetingsController::class, 'cancel']);
        Route::post('/meetings/{id}/no-show', [MeetingsController::class, 'markNoShow']);
    });

    Route::get('/p2-points', [P2PointsController::class, 'index'])->middleware('permission:p2point.view');
    Route::post('/p2-points', [P2PointsController::class, 'store']);
    Route::get('/p2-points/{id}', [P2PointsController::class, 'show'])->middleware('permission:p2point.view');
    Route::put('/p2-points/{id}', [P2PointsController::class, 'update']);
    Route::patch('/p2-points/{id}', [P2PointsController::class, 'update']);
    Route::delete('/p2-points/{id}', [P2PointsController::class, 'destroy']);
    Route::post('/p2-points/{id}/approve', [P2PointsController::class, 'approve']);

    Route::get('/kpi', [KpiController::class, 'report'])->middleware('permission:kpi.view');
    Route::put('/kpi/targets', [KpiController::class, 'upsertTarget'])->middleware('permission:kpi.manage');

    Route::get('/payment-refunds', [PaymentsController::class, 'refundIndex']);
    Route::patch('/payment-refunds/{id}', [PaymentsController::class, 'updateRefund']);
    Route::delete('/payment-refunds/{id}', [PaymentsController::class, 'destroyRefund']);
    Route::get('/payments', [PaymentsController::class, 'index']);
    Route::post('/payments', [PaymentsController::class, 'store']);
    Route::post('/payments/{id}/allocations', [PaymentsController::class, 'allocate']);
    Route::delete('/payments/{paymentId}/allocations/{allocationId}', [PaymentsController::class, 'removeAllocation']);
    Route::post('/payments/{id}/refunds', [PaymentsController::class, 'refund']);
    Route::post('/payments/{id}/classification', [PaymentsController::class, 'classify']);
    Route::patch('/payments/{id}/invoice', [PaymentsController::class, 'updateInvoice']);
    Route::get('/payments/{id}', [PaymentsController::class, 'show']);
    Route::put('/payments/{id}', [PaymentsController::class, 'update']);
    Route::patch('/payments/{id}', [PaymentsController::class, 'update']);
    Route::delete('/payments/{id}', [PaymentsController::class, 'destroy']);

    Route::middleware('permission:role.view')->group(function (): void {
        Route::get('/roles', [RolesController::class, 'index']);
        Route::post('/roles', [RolesController::class, 'store'])->middleware('permission:role.create');
        Route::get('/roles/{id}', [RolesController::class, 'show']);
        Route::patch('/roles/{id}', [RolesController::class, 'update'])->middleware('permission:role.update');
        Route::put('/roles/{id}', [RolesController::class, 'update'])->middleware('permission:role.update');
        Route::delete('/roles/{id}', [RolesController::class, 'destroy'])->middleware('permission:role.delete');
        Route::get('/roles/{id}/permissions', [RolesController::class, 'permissions']);
        Route::post('/roles/{id}/permissions', [RolesController::class, 'syncPermissions'])->middleware('permission:role.permission.update');

        Route::get('/permissions', [PermissionsController::class, 'index']);
    });
});
