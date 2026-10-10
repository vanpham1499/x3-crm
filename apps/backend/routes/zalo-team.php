<?php

use App\Http\Controllers\ZaloTeamArchiveController;
use App\Http\Controllers\ZaloTeamPcBridgeController;
use App\Http\Controllers\ZaloTeamTagsController;
use App\Http\Middleware\AuthenticateZaloTeamService;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['service' => 'zalo-team', 'status' => 'ok']);
Route::post('/internal/zalo-team/pc/{id}', [ZaloTeamPcBridgeController::class, 'command'])->whereNumber('id');
Route::put('/internal/zalo-team/pc/{id}/upload', [ZaloTeamPcBridgeController::class, 'upload'])->whereNumber('id');
Route::put('/internal/zalo-team/pc/{id}/upload-pack', [ZaloTeamPcBridgeController::class, 'uploadPack'])->whereNumber('id');
Route::middleware(AuthenticateZaloTeamService::class)->group(function () {
    Route::post('/zalo-team/campaigns', [\App\Http\Controllers\ZaloTeamCampaignController::class, 'command']);
    Route::get('/zalo-team/campaigns/{id}/assets/{asset}', [\App\Http\Controllers\ZaloTeamCampaignController::class, 'preview'])->whereUuid('id')->whereUuid('asset');
    Route::post('/zalo-team/tags', [ZaloTeamTagsController::class, 'command']);
    Route::post('/zalo-team/archive', [ZaloTeamArchiveController::class, 'command']);
    Route::get('/zalo-team/archive/assets/{id}', [ZaloTeamArchiveController::class, 'asset']);
});
