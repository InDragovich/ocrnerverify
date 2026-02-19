<?php

return [
    'api_url' => env('OCR_NER_API_URL', 'http://localhost:5001/extract'),
    'use_mock' => env('OCR_NER_USE_MOCK', false),
    'timeout' => env('OCR_NER_TIMEOUT', 120),
];
