<?php

namespace App\Services;

class MatchingService
{
    private float $threshold = 80.0;

    public function match(array $inputData, array $entities): array
    {
        $results = [];
        $allMatch = true;
        $mismatches = [];

        // Define fields to compare: input_field => entity_key
        $fieldsToCompare = [
            'kategori' => 'kategori',
            'periode' => 'periode',
            'nominal_pelaporan' => 'nominal',
        ];

        foreach ($fieldsToCompare as $inputField => $entityKey) {
            $inputValue = $inputData[$inputField] ?? null;
            $entityValue = $entities[$entityKey] ?? null;

            if ($entityValue === null || $entityValue === '') {
                $results[$inputField] = [
                    'input' => $inputValue,
                    'extracted' => null,
                    'match' => false,
                    'note' => 'Tidak terdeteksi oleh NER',
                ];
                $allMatch = false;
                $mismatches[] = "{$inputField}: tidak terdeteksi oleh NER";
                continue;
            }

            if ($inputField === 'nominal_pelaporan') {
                $match = $this->matchNominal($inputValue, $entityValue);
            } else {
                $match = $this->matchString((string)$inputValue, (string)$entityValue);
            }

            $results[$inputField] = [
                'input' => $inputValue,
                'extracted' => $entityValue,
                'match' => $match,
                'note' => $match ? 'Cocok' : 'Tidak cocok',
            ];

            if (!$match) {
                $allMatch = false;
                $mismatches[] = "{$inputField} (input: {$inputValue}, dokumen: {$entityValue})";
            }
        }

        $catatan = $allMatch
            ? 'Semua field cocok berdasarkan OCR-NER'
            : 'Field tidak cocok: ' . implode('; ', $mismatches);

        return [
            'hasil_kesesuaian' => $allMatch ? 'sesuai' : 'tidak_sesuai',
            'catatan' => $catatan,
            'detail' => $results,
        ];
    }

    private function matchString(string $input, string $extracted): bool
    {
        $normalizedInput = $this->normalizeString($input);
        $normalizedExtracted = $this->normalizeString($extracted);

        if ($normalizedInput === $normalizedExtracted) {
            return true;
        }

        similar_text($normalizedInput, $normalizedExtracted, $percent);
        return $percent >= $this->threshold;
    }

    private function matchNominal($input, $extracted): bool
    {
        $normalizedInput = $this->normalizeNominal($input);
        $normalizedExtracted = $this->normalizeNominal($extracted);

        return $normalizedInput === $normalizedExtracted;
    }

    private function normalizeString(string $value): string
    {
        $value = mb_strtolower($value);
        $value = preg_replace('/\s+/', ' ', $value);
        return trim($value);
    }

    private function normalizeNominal($value): int
    {
        $cleaned = preg_replace('/[^0-9]/', '', (string)$value);
        return (int)$cleaned;
    }
}
