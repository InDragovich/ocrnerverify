<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OcrNerService
{
    public function extract(string $filePath, string $originalName): array
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
