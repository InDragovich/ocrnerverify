<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OcrNerService
{
    private array $months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    /**
     * @param  string  $filePath      Path to the attachment file
     * @param  string  $originalName  Original filename
     * @param  array   $inputData     Optional input data for mock: kategori, periode, nominal
     */
    public function extract(string $filePath, string $originalName, array $inputData = []): array
    {
        if (config('ocr_ner.use_mock', true)) {
            return $this->extractMock($originalName, $inputData);
        }

        return $this->extractApi($filePath, $originalName);
    }

    private function extractMock(string $originalName, array $inputData): array
    {
        // Simulate processing delay
        usleep(rand(100000, 500000));

        $roll = rand(1, 100);

        // 10% chance: total failure
        if ($roll <= 10) {
            return [
                'success' => false,
                'text_ocr' => '',
                'entities' => [],
                'status' => 'failed',
                'error_message' => 'Dokumen tidak dapat diproses. File mungkin rusak atau kualitas scan terlalu rendah.',
            ];
        }

        $mockData = $this->generateMockData($originalName, $inputData);

        // 20% chance: partial success (one entity null)
        if ($roll <= 30) {
            $entities = $mockData['entities'];
            $nullKey = array_rand($entities);
            $entities[$nullKey] = null;

            return [
                'success' => true,
                'text_ocr' => $mockData['text_ocr'],
                'entities' => $entities,
                'status' => 'partial_success',
                'error_message' => "Entity '{$nullKey}' tidak terdeteksi.",
            ];
        }

        // 70% chance: full success
        return [
            'success' => true,
            'text_ocr' => $mockData['text_ocr'],
            'entities' => $mockData['entities'],
            'status' => 'success',
            'error_message' => null,
        ];
    }

    private function generateMockData(string $fileName, array $inputData): array
    {
        // Use actual input data as base, with realistic deviations
        $kategori = $inputData['kategori'] ?? $this->guessCategory($fileName);
        $periode = $inputData['periode'] ?? $this->months[array_rand($this->months)];
        $inputNominal = $inputData['nominal'] ?? rand(50000, 999999);

        // Nominal: 70% exact match, 20% small deviation, 10% totally different
        $nominalRoll = rand(1, 100);
        if ($nominalRoll <= 70) {
            // Exact match — OCR reads the document correctly
            $nominal = $inputNominal;
        } elseif ($nominalRoll <= 90) {
            // Small deviation (±1-10%) — simulates minor OCR misread
            $deviation = $inputNominal * rand(1, 10) / 100;
            $nominal = rand(0, 1) ? $inputNominal + (int) $deviation : $inputNominal - (int) $deviation;
            $nominal = max(0, $nominal);
        } else {
            // Totally different — simulates wrong document or major error
            $nominal = rand(50000, 999999);
        }

        // Periode: 80% exact match, 20% different month
        $periodeRoll = rand(1, 100);
        if ($periodeRoll > 80) {
            $periode = $this->months[array_rand($this->months)];
        }

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

    private function guessCategory(string $fileName): string
    {
        $categories = ['Kebersihan', 'Telepon', 'Listrik', 'Air', 'Gas'];
        $fileNameLower = strtolower($fileName);
        foreach ($categories as $cat) {
            if (str_contains($fileNameLower, strtolower($cat))) {
                return $cat;
            }
        }
        return $categories[array_rand($categories)];
    }

    private function extractApi(string $filePath, string $originalName): array
    {
        $apiUrl = config('ocr_ner.api_url');
        $timeout = config('ocr_ner.timeout', 60);

        try {
            $response = Http::timeout($timeout)
                ->attach('file_lampiran', file_get_contents($filePath), $originalName)
                ->post($apiUrl);

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'success' => true,
                    'text_ocr' => $data['text_ocr'] ?? '',
                    'entities' => $data['entities'] ?? [],
                    'status' => $data['status'] ?? 'failed',
                    'error_message' => $data['error_message'] ?? null,
                ];
            }

            return [
                'success' => false,
                'text_ocr' => '',
                'entities' => [],
                'status' => 'failed',
                'error_message' => 'API returned HTTP ' . $response->status(),
            ];
        } catch (\Exception $e) {
            Log::error('OCR-NER API error: ' . $e->getMessage());
            return [
                'success' => false,
                'text_ocr' => '',
                'entities' => [],
                'status' => 'failed',
                'error_message' => 'API connection error: ' . $e->getMessage(),
            ];
        }
    }
}
