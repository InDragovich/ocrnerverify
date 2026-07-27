<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BatchVerifikasiController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\MockOcrNerController;
use App\Http\Controllers\VerifikasiController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/login', [AuthController::class, 'login']);

// Mock OCR-NER endpoint (accessible internally)
Route::post('/mock/ocr-ner', [MockOcrNerController::class, 'extract']);

// Lampiran preview (auth via query token for browser direct requests)
Route::middleware(['auth.query', 'auth:sanctum'])->group(function () {
    Route::get('/verifikasi/{id}/lampiran', [VerifikasiController::class, 'lampiran']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Verifikasi - stats & summary must come before {id} route
    Route::get('/verifikasi/stats', [VerifikasiController::class, 'stats'])
        ->middleware('role:verifikator,super_admin');
    Route::get('/verifikasi/summary', [VerifikasiController::class, 'summary'])
        ->middleware('role:verifikator,super_admin');

    // Verifikasi - batch routes must come before {id} route
    Route::post('/verifikasi/batch', [BatchVerifikasiController::class, 'store'])
        ->middleware('role:verifikator,super_admin');
    Route::get('/verifikasi/batch-status', [BatchVerifikasiController::class, 'status'])
        ->middleware('role:verifikator,super_admin');

    // Ekspor CSV — harus mendahului route {id}
    Route::get('/verifikasi/export/dokumen', [ExportController::class, 'dokumen'])
        ->middleware('role:verifikator,super_admin');
    Route::get('/verifikasi/export/batch', [ExportController::class, 'batch'])
        ->middleware('role:verifikator,super_admin');

    // Verifikasi CRUD
    Route::get('/verifikasi', [VerifikasiController::class, 'index']);
    Route::post('/verifikasi', [VerifikasiController::class, 'store'])
        ->middleware('role:operator');
    Route::get('/verifikasi/{id}', [VerifikasiController::class, 'show']);
    Route::post('/verifikasi/{id}', [VerifikasiController::class, 'update'])
        ->middleware('role:operator');
    Route::delete('/verifikasi/{id}', [VerifikasiController::class, 'destroy'])
        ->middleware('role:operator');
    // Keputusan manual
    Route::put('/verifikasi/{id}/keputusan', [VerifikasiController::class, 'keputusan'])
        ->middleware('role:verifikator,super_admin');

    // Audit logs
    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('role:super_admin');

    // Admin user management
    Route::prefix('admin')->middleware('role:super_admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{id}', [UserController::class, 'show']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
    });
});
