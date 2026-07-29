<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ContractsController;
use App\Http\Controllers\CustomersController;
use App\Http\Controllers\DashboardController;
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

    Route::middleware('permission:media.view')->group(function (): void {
        Route::get('/media', [MediaController::class, 'index']);
        Route::post('/media/upload', [MediaController::class, 'upload'])->middleware('permission:media.create');
        Route::patch('/media/{id}', [MediaController::class, 'update'])->middleware('permission:media.update,media.update_department,media.update_all');
        Route::delete('/media/{id}', [MediaController::class, 'destroy'])->middleware('permission:media.delete,media.delete_department,media.delete_all');
    });

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

    Route::get('/users/lookup', [UsersController::class, 'lookup'])
        ->middleware('permission:user.lookup,user.view,department.view');
    Route::get('/users', [UsersController::class, 'index'])->middleware('permission:user.view');
    Route::get('/users/stats', [UsersController::class, 'stats'])->middleware('permission:user.view');
    Route::get('/users/{id}', [UsersController::class, 'show'])->middleware('permission:user.view');
    Route::post('/users', [UsersController::class, 'store'])->middleware('permission:user.create');
    Route::put('/users/{id}', [UsersController::class, 'update'])->middleware('permission:user.update');
    Route::patch('/users/{id}', [UsersController::class, 'update'])->middleware('permission:user.update');
    Route::delete('/users/{id}', [UsersController::class, 'destroy'])->middleware('permission:user.delete');

    Route::get('/departments/lookup', [DepartmentsController::class, 'index'])
        ->middleware('permission:department.lookup,department.view');
    Route::get('/departments', [DepartmentsController::class, 'index'])->middleware('permission:department.view');
    Route::get('/departments/{id}', [DepartmentsController::class, 'show'])->middleware('permission:department.view');
    Route::post('/departments', [DepartmentsController::class, 'store'])->middleware('permission:user.create');
    Route::put('/departments/{id}', [DepartmentsController::class, 'update'])->middleware('permission:user.update');
    Route::patch('/departments/{id}', [DepartmentsController::class, 'update'])->middleware('permission:user.update');
    Route::delete('/departments/{id}', [DepartmentsController::class, 'destroy'])->middleware('permission:user.delete');

    Route::get('/leads', [LeadsController::class, 'index'])->middleware('permission:lead.view');
    Route::post('/leads', [LeadsController::class, 'store'])->middleware('permission:lead.create');
    Route::post('/leads/{id}/convert', [LeadsController::class, 'convert'])->middleware('permission:lead.update,lead.update_department,lead.update_all');
    Route::get('/leads/{id}', [LeadsController::class, 'show'])->middleware('permission:lead.view');
    Route::put('/leads/{id}', [LeadsController::class, 'update'])->middleware('permission:lead.update,lead.update_department,lead.update_all');
    Route::patch('/leads/{id}', [LeadsController::class, 'update'])->middleware('permission:lead.update,lead.update_department,lead.update_all');
    Route::delete('/leads/{id}', [LeadsController::class, 'destroy'])->middleware('permission:lead.delete,lead.delete_department,lead.delete_all');

    Route::get('/customers/lookup', [CustomersController::class, 'lookup'])
        ->middleware('permission:customer.lookup,customer.view,customer.view_department,customer.view_all');
    Route::get('/customers/lookup/{id}', [CustomersController::class, 'lookupShow'])
        ->middleware('permission:customer.lookup,customer.view,customer.view_department,customer.view_all');
    Route::get('/customers', [CustomersController::class, 'index'])->middleware('permission:customer.view');
    Route::post('/customers', [CustomersController::class, 'store'])->middleware('permission:customer.create');
    Route::get('/customers/{id}', [CustomersController::class, 'show'])->middleware('permission:customer.view');
    Route::put('/customers/{id}', [CustomersController::class, 'update'])->middleware('permission:customer.update,customer.update_department,customer.update_all');
    Route::patch('/customers/{id}', [CustomersController::class, 'update'])->middleware('permission:customer.update,customer.update_department,customer.update_all');
    Route::delete('/customers/{id}', [CustomersController::class, 'destroy'])->middleware('permission:customer.delete,customer.delete_department,customer.delete_all');

    Route::get('/projects', [ProjectsController::class, 'index'])->middleware('permission:project.view');
    Route::post('/projects', [ProjectsController::class, 'store'])->middleware('permission:project.create');
    Route::get('/projects/{id}', [ProjectsController::class, 'show'])->middleware('permission:project.view');
    Route::put('/projects/{id}', [ProjectsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::patch('/projects/{id}', [ProjectsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::delete('/projects/{id}', [ProjectsController::class, 'destroy'])->middleware('permission:project.delete,project.delete_department,project.delete_all');

    Route::get('/project-costs', [ProjectCostsController::class, 'index'])->middleware('permission:cost.view');
    Route::post('/project-costs', [ProjectCostsController::class, 'store'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::post('/project-costs/{id}/reconcile', [ProjectCostsController::class, 'reconcile'])->middleware('permission:cost.approve,cost.approve_department,cost.approve_all');
    Route::put('/project-costs/{id}/cid-incident', [ProjectCostsController::class, 'reportCidIncident'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::post('/project-costs/{id}/cid-incident/confirm', [ProjectCostsController::class, 'confirmCidIncident'])->middleware('permission:cost.approve,cost.approve_department,cost.approve_all');
    Route::delete('/project-costs/{id}/cid-incident', [ProjectCostsController::class, 'cancelCidIncident'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::get('/project-costs/{id}', [ProjectCostsController::class, 'show'])->middleware('permission:cost.view');
    Route::put('/project-costs/{id}', [ProjectCostsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::patch('/project-costs/{id}', [ProjectCostsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::delete('/project-costs/{id}', [ProjectCostsController::class, 'destroy'])->middleware('permission:project.delete,project.delete_department,project.delete_all');

    Route::get('/quotations', [QuotationsController::class, 'index'])->middleware('permission:quotation.view');
    Route::post('/quotations', [QuotationsController::class, 'store'])->middleware('permission:quotation.create');
    Route::get('/quotations/{id}', [QuotationsController::class, 'show'])->middleware('permission:quotation.view');
    Route::put('/quotations/{id}', [QuotationsController::class, 'update'])->middleware('permission:quotation.update,quotation.update_department,quotation.update_all');
    Route::patch('/quotations/{id}', [QuotationsController::class, 'update'])->middleware('permission:quotation.update,quotation.update_department,quotation.update_all');
    Route::delete('/quotations/{id}', [QuotationsController::class, 'destroy'])->middleware('permission:quotation.delete,quotation.delete_department,quotation.delete_all');

    Route::get('/contracts', [ContractsController::class, 'index'])->middleware('permission:project.view');
    Route::post('/contracts', [ContractsController::class, 'store'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::get('/contracts/{id}', [ContractsController::class, 'show'])->middleware('permission:project.view');
    Route::put('/contracts/{id}', [ContractsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::patch('/contracts/{id}', [ContractsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::delete('/contracts/{id}', [ContractsController::class, 'destroy'])->middleware('permission:project.delete,project.delete_department,project.delete_all');

    Route::get('/project-weekly-settings', [ProjectWeeklySettingsController::class, 'index'])->middleware('permission:weeklyreport.view');
    Route::get('/project-weekly-settings/assignment-summary', [ProjectWeeklySettingsController::class, 'assignmentSummary'])->middleware('permission:weeklyreport.view');
    Route::post('/project-weekly-settings', [ProjectWeeklySettingsController::class, 'store'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::get('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'show'])->middleware('permission:weeklyreport.view');
    Route::put('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::patch('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'update'])->middleware('permission:project.update,project.update_department,project.update_all');
    Route::delete('/project-weekly-settings/{id}', [ProjectWeeklySettingsController::class, 'destroy'])->middleware('permission:project.delete,project.delete_department,project.delete_all');

    Route::middleware('permission:weeklyreport.view')->group(function (): void {
        Route::get('/weekly-reports/board', [WeeklyReportsController::class, 'board']);
        Route::get('/weekly-reports', [WeeklyReportsController::class, 'index']);
        Route::post('/weekly-reports', [WeeklyReportsController::class, 'store'])->middleware('permission:weeklyreport.create');
        Route::get('/weekly-reports/{id}', [WeeklyReportsController::class, 'show']);
        Route::put('/weekly-reports/{id}', [WeeklyReportsController::class, 'update'])->middleware('permission:weeklyreport.update,weeklyreport.update_department,weeklyreport.update_all');
        Route::patch('/weekly-reports/{id}', [WeeklyReportsController::class, 'update'])->middleware('permission:weeklyreport.update,weeklyreport.update_department,weeklyreport.update_all');
        Route::delete('/weekly-reports/{id}', [WeeklyReportsController::class, 'destroy'])->middleware('permission:weeklyreport.delete,weeklyreport.delete_department,weeklyreport.delete_all');
        Route::post('/weekly-reports/{id}/submit', [WeeklyReportsController::class, 'submit'])->middleware('permission:weeklyreport.update,weeklyreport.update_department,weeklyreport.update_all');
        Route::post('/weekly-reports/{id}/approve', [WeeklyReportsController::class, 'approve'])->middleware('permission:weeklyreport.approve,weeklyreport.approve_department,weeklyreport.approve_all');
        Route::post('/weekly-reports/{id}/return-to-draft', [WeeklyReportsController::class, 'returnToDraft'])->middleware('permission:weeklyreport.approve,weeklyreport.approve_department,weeklyreport.approve_all');
        Route::post('/weekly-reports/{id}/attachments', [WeeklyReportAttachmentsController::class, 'store'])->middleware('permission:weeklyreport.update,weeklyreport.update_department,weeklyreport.update_all');
        Route::delete('/weekly-report-attachments/{id}', [WeeklyReportAttachmentsController::class, 'destroy'])->middleware('permission:weeklyreport.update,weeklyreport.update_department,weeklyreport.update_all');
    });

    Route::middleware('permission:meeting.view')->group(function (): void {
        Route::get('/meetings/summary', [MeetingsController::class, 'summary']);
        Route::get('/meetings', [MeetingsController::class, 'index']);
        Route::post('/meetings', [MeetingsController::class, 'store'])->middleware('permission:meeting.create');
        Route::get('/meetings/{id}', [MeetingsController::class, 'show']);
        Route::put('/meetings/{id}', [MeetingsController::class, 'update'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
        Route::patch('/meetings/{id}', [MeetingsController::class, 'update'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
        Route::delete('/meetings/{id}', [MeetingsController::class, 'destroy'])->middleware('permission:meeting.delete,meeting.delete_department,meeting.delete_all');
        Route::post('/meetings/{id}/confirm', [MeetingsController::class, 'confirm'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
        Route::post('/meetings/{id}/complete', [MeetingsController::class, 'complete'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
        Route::post('/meetings/{id}/cancel', [MeetingsController::class, 'cancel'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
        Route::post('/meetings/{id}/no-show', [MeetingsController::class, 'markNoShow'])->middleware('permission:meeting.update,meeting.update_department,meeting.update_all');
    });

    Route::get('/p2-points', [P2PointsController::class, 'index'])->middleware('permission:p2point.view');
    Route::post('/p2-points', [P2PointsController::class, 'store'])->middleware('permission:p2point.create,p2point.create_department,p2point.create_all');
    Route::get('/p2-points/{id}', [P2PointsController::class, 'show'])->middleware('permission:p2point.view');
    Route::put('/p2-points/{id}', [P2PointsController::class, 'update'])->middleware('permission:p2point.update,p2point.update_department,p2point.update_all');
    Route::patch('/p2-points/{id}', [P2PointsController::class, 'update'])->middleware('permission:p2point.update,p2point.update_department,p2point.update_all');
    Route::delete('/p2-points/{id}', [P2PointsController::class, 'destroy'])->middleware('permission:p2point.delete,p2point.delete_department,p2point.delete_all');
    Route::post('/p2-points/{id}/approve', [P2PointsController::class, 'approve'])->middleware('permission:p2point.approve,p2point.approve_department,p2point.approve_all');

    Route::get('/kpi', [KpiController::class, 'report'])->middleware('permission:kpi.view');
    Route::put('/kpi/targets', [KpiController::class, 'upsertTarget'])->middleware('permission:kpi.manage');
    Route::get('/dashboard', [DashboardController::class, 'report'])->middleware('permission:dashboard.view');

    Route::middleware('permission:payment.view')->group(function (): void {
        Route::get('/payment-refunds', [PaymentsController::class, 'refundIndex']);
        Route::get('/payments', [PaymentsController::class, 'index']);
        Route::get('/payments/{id}', [PaymentsController::class, 'show']);

        Route::middleware('permission:payment.manage')->group(function (): void {
            Route::patch('/payment-refunds/{id}', [PaymentsController::class, 'updateRefund']);
            Route::delete('/payment-refunds/{id}', [PaymentsController::class, 'destroyRefund']);
            Route::post('/payments', [PaymentsController::class, 'store']);
            Route::post('/payments/{id}/allocations', [PaymentsController::class, 'allocate']);
            Route::delete('/payments/{paymentId}/allocations/{allocationId}', [PaymentsController::class, 'removeAllocation']);
            Route::post('/payments/{id}/refunds', [PaymentsController::class, 'refund']);
            Route::post('/payments/{id}/classification', [PaymentsController::class, 'classify']);
            Route::patch('/payments/{id}/invoice', [PaymentsController::class, 'updateInvoice']);
            Route::put('/payments/{id}', [PaymentsController::class, 'update']);
            Route::patch('/payments/{id}', [PaymentsController::class, 'update']);
            Route::delete('/payments/{id}', [PaymentsController::class, 'destroy']);
        });
    });

    Route::middleware('permission:role.view')->group(function (): void {
        Route::get('/roles', [RolesController::class, 'index']);
        Route::post('/roles', [RolesController::class, 'store'])
            ->middleware(['permission:role.create', 'permission:role.permission.update']);
        Route::get('/roles/{id}', [RolesController::class, 'show']);
        Route::patch('/roles/{id}', [RolesController::class, 'update'])
            ->middleware(['permission:role.update', 'permission:role.permission.update']);
        Route::put('/roles/{id}', [RolesController::class, 'update'])
            ->middleware(['permission:role.update', 'permission:role.permission.update']);
        Route::delete('/roles/{id}', [RolesController::class, 'destroy'])->middleware('permission:role.delete');
        Route::get('/roles/{id}/permissions', [RolesController::class, 'permissions']);
        Route::post('/roles/{id}/permissions', [RolesController::class, 'syncPermissions'])->middleware('permission:role.permission.update');

    });

    Route::get('/permissions', [PermissionsController::class, 'index'])->middleware('permission:permission.view');
});
