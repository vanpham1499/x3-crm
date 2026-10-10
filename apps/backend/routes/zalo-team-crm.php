<?php

// CRM-side boundary: identities, account assignments and conversation work profiles.
// The archive and connector execute on the dedicated Zalo server.
use Illuminate\Support\Facades\Route;

Route::get('/internal/zalo-team/identity/{id}', function (\Illuminate\Http\Request $request, int $id) {
    \App\Services\ZaloTeamRuntime::authenticateService($request);
    $user = \App\Models\User::where('is_active', true)->findOrFail($id);
    return response()->json(\App\Services\ZaloTeamIdentity::projection($user))->header('Cache-Control', 'private, no-store');
});

Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
    Route::prefix('zalo-team/documents')->controller(\App\Http\Controllers\ZaloCrmDocumentsController::class)->group(function (): void {
        Route::get('accounts', 'accounts');
        Route::get('groups/{account}', 'groups')->whereNumber('account');
        Route::get('binding/{kind}/{id}', 'binding')->whereIn('kind', ['project', 'customer'])->whereNumber('id');
        Route::put('binding/{kind}/{id}', 'saveBinding')->whereIn('kind', ['project', 'customer'])->whereNumber('id');
        Route::get('source/{kind}/{id}', 'context')->whereIn('kind', ['quotation', 'report'])->whereNumber('id');
        Route::post('source/{kind}/{id}', 'enqueue')->whereIn('kind', ['quotation', 'report'])->whereNumber('id')->middleware('throttle:12,1');
        Route::post('delivery/{id}', 'action')->whereUuid('id')->middleware('throttle:20,1');
        Route::get('delivery/{id}/file', 'artifact')->whereUuid('id');
    });
    Route::post('/zalo-team/access', [\App\Http\Controllers\ZaloTeamAccessController::class, 'command']);
    Route::post('/zalo-team/workspace', [\App\Http\Controllers\ZaloTeamWorkspaceController::class, 'command']);
    Route::get('/auth/zalo-team', fn (\Illuminate\Http\Request $request) =>
        response()->json(\App\Services\ZaloTeamIdentity::projection($request->user()))->header('Cache-Control', 'private, no-store'));
});
