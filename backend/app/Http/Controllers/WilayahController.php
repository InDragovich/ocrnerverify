<?php

namespace App\Http\Controllers;

use App\Services\WilayahService;
use Illuminate\Http\JsonResponse;

class WilayahController extends Controller
{
    /**
     * Daftar master wilayah bertingkat untuk mengisi pilihan di form input.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'struktur' => WilayahService::struktur(),
        ]);
    }
}
