<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessVerifikasiJob;
use App\Models\VerifikasiBiayaRutin;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BatchVerifikasiController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:verifikasi_biaya_rutin,id',
        ]);

        $user = $request->user();
        $ids = $request->ids;

        $items = VerifikasiBiayaRutin::whereIn('id', $ids)
            ->whereIn('status_verifikasi', ['menunggu', 'gagal'])
            ->get();

        if ($items->isEmpty()) {
            return response()->json([
                'message' => 'Tidak ada data yang dapat diproses. Pastikan data berstatus "menunggu" atau "gagal".',
                'total_jobs' => 0,
                'ids' => [],
            ], 422);
        }

        $processedIds = [];

        foreach ($items as $item) {
            $item->update([
                'status_verifikasi' => 'diproses',
                'error_message' => null,
            ]);

            ProcessVerifikasiJob::dispatch($item->id, $user->id);
            $processedIds[] = $item->id;
        }

        AuditService::log(
            'batch_verify_initiated',
            null,
            null,
            null,
            ['ids' => $processedIds, 'total' => count($processedIds)],
        );

        return response()->json([
            'message' => 'Batch verifikasi dimulai.',
            'total_jobs' => count($processedIds),
            'ids' => $processedIds,
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|string',
        ]);

        $ids = array_map('intval', explode(',', $request->ids));

        $items = VerifikasiBiayaRutin::whereIn('id', $ids)
            ->select('id', 'status_verifikasi', 'hasil_kesesuaian', 'catatan_verifikator', 'error_message')
            ->get();

        $completed = $items->whereIn('status_verifikasi', ['selesai', 'gagal'])->count();
        $processing = $items->where('status_verifikasi', 'diproses')->count();
        $failed = $items->where('status_verifikasi', 'gagal')->count();

        return response()->json([
            'total' => $items->count(),
            'completed' => $completed,
            'processing' => $processing,
            'failed' => $failed,
            'items' => $items,
        ]);
    }
}
