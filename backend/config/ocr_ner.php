<?php

return [
    'api_url' => env('OCR_NER_API_URL', 'http://localhost:8000/api/mock/ocr-ner'),
    'use_mock' => env('OCR_NER_USE_MOCK', true),
    'timeout' => 60,
];
