<?php

namespace App\Http\Controllers;

use App\Http\Requests\KeputusanRequest;
use App\Http\Requests\StoreVerifikasiRequest;
use App\Http\Requests\UpdateVerifikasiRequest;
use App\Models\VerifikasiBiayaRutin;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VerifikasiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = VerifikasiBiayaRutin::with(['operator:id,name,username', 'verifikator:id,name,username']);

        if ($user->isOperator()) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('kategori')) {
            $query->where('kategori', $request->kategori);
        }
        if ($request->filled('tahun')) {
            $query->where('tahun', $request->tahun);
        }
        if ($request->filled('triwulan')) {
            $query->where('triwulan', $request->triwulan);
        }
        if ($request->filled('periode')) {
            $query->where('periode', $request->periode);
        }
        if ($request->filled('status_verifikasi')) {
            $query->where('status_verifikasi', $request->status_verifikasi);
        }
        if ($request->filled('hasil_kesesuaian')) {
            $query->where('hasil_kesesuaian', $request->hasil_kesesuaian);
        }
        if ($request->filled('regional')) {
            $query->where('regional', $request->regional);
        }
        if ($request->filled('kcu')) {
            $query->where('kcu', $request->kcu);
        }
        if ($request->filled('kpc')) {
            $query->where('kpc', $request->kpc);
        }

        $perPage = $request->input('per_page', 15);
        $data = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($data);
    }

    public function store(StoreVerifikasiRequest $request): JsonResponse
    {
        $user = $request->user();

        $file = $request->file('lampiran');
        $path = $file->store('lampiran', 'local');

        $verifikasi = VerifikasiBiayaRutin::create([
            'user_id' => $user->id,
            'kategori' => $request->kategori,
            'tahun' => $request->tahun,
            'triwulan' => $request->triwulan,
            'periode' => $request->periode,
            'regional' => $user->region ?? '',
            'kcu' => $user->kcu ?? '',
            'kpc' => $user->kcp ?? '',
            'nominal_pelaporan' => $request->nominal_pelaporan,
            'lampiran_path' => $path,
            'lampiran_nama_asli' => $file->getClientOriginalName(),
            'status_verifikasi' => 'menunggu',
            'hasil_kesesuaian' => 'belum_ditentukan',
        ]);

        AuditService::log(
            'create',
            VerifikasiBiayaRutin::class,
            $verifikasi->id,
            null,
            $verifikasi->toArray(),
        );

        return response()->json([
            'message' => 'Data berhasil disimpan.',
            'data' => $verifikasi->load('operator:id,name,username'),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $verifikasi = VerifikasiBiayaRutin::with([
            'operator:id,name,username,region,kcu,kcp',
            'verifikator:id,name,username',
        ])->findOrFail($id);

        if ($user->isOperator() && $verifikasi->user_id !== $user->id) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        return response()->json($verifikasi);
    }

    public function update(UpdateVerifikasiRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        $verifikasi = VerifikasiBiayaRutin::findOrFail($id);

        if ($verifikasi->user_id !== $user->id) {
            return response()->json(['message' => 'Anda hanya dapat mengubah data milik Anda.'], 403);
        }

        if ($verifikasi->status_verifikasi !== 'menunggu') {
            return response()->json(['message' => 'Data yang sudah diverifikasi tidak dapat diubah.'], 403);
        }

        $oldValues = $verifikasi->toArray();

        $updateData = $request->only(['kategori', 'tahun', 'triwulan', 'periode', 'nominal_pelaporan']);

        if ($request->hasFile('lampiran')) {
            if ($verifikasi->lampiran_path) {
                Storage::disk('local')->delete($verifikasi->lampiran_path);
            }
            $file = $request->file('lampiran');
            $updateData['lampiran_path'] = $file->store('lampiran', 'local');
            $updateData['lampiran_nama_asli'] = $file->getClientOriginalName();
        }

        $verifikasi->update($updateData);

        AuditService::log(
            'update',
            VerifikasiBiayaRutin::class,
            $verifikasi->id,
            $oldValues,
            $verifikasi->fresh()->toArray(),
        );

        return response()->json([
            'message' => 'Data berhasil diperbarui.',
            'data' => $verifikasi->fresh()->load('operator:id,name,username'),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $verifikasi = VerifikasiBiayaRutin::findOrFail($id);

        if ($verifikasi->user_id !== $user->id) {
            return response()->json(['message' => 'Anda hanya dapat menghapus data milik Anda.'], 403);
        }

        if ($verifikasi->status_verifikasi !== 'menunggu') {
            return response()->json(['message' => 'Data yang sudah diverifikasi tidak dapat dihapus.'], 403);
        }

        AuditService::log(
            'delete',
            VerifikasiBiayaRutin::class,
            $verifikasi->id,
            $verifikasi->toArray(),
            null,
        );

        $verifikasi->delete();

        return response()->json(['message' => 'Data berhasil dihapus.']);
    }

    public function lampiran(Request $request, int $id)
    {
        $user = $request->user();
        $verifikasi = VerifikasiBiayaRutin::findOrFail($id);

        if ($user->isOperator() && $verifikasi->user_id !== $user->id) {
            return response()->json(['message' => 'Akses ditolak.'], 403);
        }

        $filePath = Storage::disk('local')->path($verifikasi->lampiran_path);

        if (!file_exists($filePath)) {
            return response()->json(['message' => 'File tidak ditemukan.'], 404);
        }

        return response()->file($filePath, [
            'Content-Disposition' => 'inline; filename="' . $verifikasi->lampiran_nama_asli . '"',
        ]);
    }

    public function keputusan(KeputusanRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        $verifikasi = VerifikasiBiayaRutin::findOrFail($id);

        $oldValues = [
            'hasil_kesesuaian' => $verifikasi->hasil_kesesuaian,
            'catatan_verifikator' => $verifikasi->catatan_verifikator,
            'hasil_entitas' => $verifikasi->hasil_entitas,
        ];

        $updateData = [
            'hasil_kesesuaian' => $request->hasil_kesesuaian,
            'catatan_verifikator' => $request->catatan_verifikator,
            'verifikator_id' => $user->id,
            'verified_at' => now(),
            'status_verifikasi' => 'selesai',
        ];

        // Apply entity corrections from verifier (e.g. corrected nominal)
        if ($request->filled('koreksi_entitas')) {
            $entitas = $verifikasi->hasil_entitas ?? [];
            foreach ($request->koreksi_entitas as $key => $value) {
                $entitas[$key] = (string)$value;
            }
            $updateData['hasil_entitas'] = $entitas;
        }

        $verifikasi->update($updateData);

        AuditService::log(
            'manual_verify',
            VerifikasiBiayaRutin::class,
            $verifikasi->id,
            $oldValues,
            [
                'hasil_kesesuaian' => $request->hasil_kesesuaian,
                'catatan_verifikator' => $request->catatan_verifikator,
                'koreksi_entitas' => $request->koreksi_entitas,
            ],
        );

        return response()->json([
            'message' => 'Keputusan berhasil ditetapkan.',
            'data' => $verifikasi->fresh()->load(['operator:id,name,username', 'verifikator:id,name,username']),
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $groupBy = $request->input('group_by', 'regional');

        if (!in_array($groupBy, ['regional', 'kcu', 'kpc'])) {
            return response()->json(['message' => 'group_by harus regional, kcu, atau kpc.'], 422);
        }

        $query = VerifikasiBiayaRutin::query();

        if ($request->filled('tahun')) $query->where('tahun', $request->tahun);
        if ($request->filled('triwulan')) $query->where('triwulan', $request->triwulan);
        if ($request->filled('regional')) $query->where('regional', $request->regional);
        if ($request->filled('kcu')) $query->where('kcu', $request->kcu);

        $subCount = match ($groupBy) {
            'regional' => 'COUNT(DISTINCT kcu)',
            'kcu' => 'COUNT(DISTINCT kpc)',
            'kpc' => '0',
        };

        $data = $query
            ->selectRaw("
                {$groupBy} as nama,
                COUNT(*) as total_dokumen,
                SUM(nominal_pelaporan) as total_biaya,
                SUM(CASE WHEN status_verifikasi = 'selesai' THEN 1 ELSE 0 END) as selesai,
                SUM(CASE WHEN status_verifikasi = 'menunggu' OR status_verifikasi = 'diproses' THEN 1 ELSE 0 END) as menunggu,
                SUM(CASE WHEN status_verifikasi = 'gagal' THEN 1 ELSE 0 END) as gagal,
                {$subCount} as jumlah_sub
            ")
            ->groupBy($groupBy)
            ->orderBy($groupBy)
            ->get();

        return response()->json($data);
    }

    public function stats(Request $request): JsonResponse
    {
        $statusCounts = VerifikasiBiayaRutin::selectRaw("status_verifikasi, COUNT(*) as count")
            ->groupBy('status_verifikasi')
            ->pluck('count', 'status_verifikasi')
            ->toArray();

        $kesesuaianCounts = VerifikasiBiayaRutin::selectRaw("hasil_kesesuaian, COUNT(*) as count")
            ->groupBy('hasil_kesesuaian')
            ->pluck('count', 'hasil_kesesuaian')
            ->toArray();

        return response()->json([
            'status_verifikasi' => [
                'menunggu' => $statusCounts['menunggu'] ?? 0,
                'diproses' => $statusCounts['diproses'] ?? 0,
                'selesai' => $statusCounts['selesai'] ?? 0,
                'gagal' => $statusCounts['gagal'] ?? 0,
            ],
            'hasil_kesesuaian' => [
                'sesuai' => $kesesuaianCounts['sesuai'] ?? 0,
                'tidak_sesuai' => $kesesuaianCounts['tidak_sesuai'] ?? 0,
                'belum_ditentukan' => $kesesuaianCounts['belum_ditentukan'] ?? 0,
            ],
        ]);
    }
}
