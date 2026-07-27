<?php

return [
    // Default sengaja memakai 127.0.0.1: pada Windows, "localhost" dicoba lewat
    // IPv6 lebih dulu sedangkan Uvicorn hanya mendengarkan di IPv4, sehingga
    // setiap permintaan tertahan sekitar dua detik.
    'api_url' => env('OCR_NER_API_URL', 'http://127.0.0.1:5001/extract'),
    'use_mock' => env('OCR_NER_USE_MOCK', false),
    'timeout' => env('OCR_NER_TIMEOUT', 120),
];
