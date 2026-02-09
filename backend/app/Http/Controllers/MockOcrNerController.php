<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MockOcrNerController extends Controller
{
    private array $categories = ['Kebersihan', 'Telepon', 'Listrik', 'Air', 'Gas'];
    private array $months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    public function extract(Request $request): JsonResponse
    {
        $request->validate([
            'file_lampiran' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        // Simulate processing delay
        usleep(rand(500000, 2000000));

        $file = $request->file('file_lampiran');
        $fileName = $file->getClientOriginalName();

        $roll = rand(1, 100);

        if ($roll <= 10) {
            return response()->json([
                'text_ocr' => '',
                'entities' => [],
                'status' => 'failed',
                'error_message' => 'Dokumen tidak dapat diproses. File mungkin rusak atau kualitas scan terlalu rendah.',
            ]);
        }

        $mockData = $this->generateMockData($fileName);

        if ($roll <= 30) {
            $entities = $mockData['entities'];
            $nullKey = array_rand($entities);
            $entities[$nullKey] = null;

            return response()->json([
                'text_ocr' => $mockData['text_ocr'],
                'entities' => $entities,
                'status' => 'partial_success',
                'error_message' => "Entity '{$nullKey}' tidak terdeteksi.",
            ]);
        }

        return response()->json([
            'text_ocr' => $mockData['text_ocr'],
            'entities' => $mockData['entities'],
            'status' => 'success',
            'error_message' => null,
        ]);
    }

    private function generateMockData(string $fileName): array
    {
        $kategori = $this->extractCategory($fileName);
        $periode = $this->months[array_rand($this->months)];
        $nominal = rand(50000, 999999);

        $textOcr = "PT POS INDONESIA (PERSERO)\n"
            . "LAPORAN BIAYA RUTIN\n"
            . "================================\n"
            . "Kategori Biaya: {$kategori}\n"
            . "Periode: {$periode} 2025\n"
            . "Kantor Cabang Pembantu\n"
            . "Total Biaya: Rp " . number_format($nominal, 0, ',', '.') . "\n"
            . "================================\n"
            . "Dokumen ini dibuat secara otomatis.\n"
            . "Sumber: {$fileName}";

        return [
            'text_ocr' => $textOcr,
            'entities' => [
                'kategori' => $kategori,
                'periode' => $periode,
                'nominal' => (string) $nominal,
            ],
        ];
    }

    private function extractCategory(string $fileName): string
    {
        $fileNameLower = strtolower($fileName);
        foreach ($this->categories as $cat) {
            if (str_contains($fileNameLower, strtolower($cat))) {
                return $cat;
            }
        }
        return $this->categories[array_rand($this->categories)];
    }
}
